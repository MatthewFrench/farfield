import {
  FarfieldEventStreamEnvelopeSchema,
  type FarfieldThreadStreamDelta
} from "@farfield/protocol";
import { z } from "zod";

const THREAD_STREAM_STATE_CHANGED_METHOD = "thread-stream-state-changed";
const EVENT_HISTORY_REFRESH_METADATA_STRING_SCHEMA = z.preprocess(
  (value) => (typeof value === "string" && value.length > 0 ? value : null),
  z.string().min(1).nullable()
);
const EVENT_HISTORY_REFRESH_METADATA_SCHEMA = z
  .object({
    method: EVENT_HISTORY_REFRESH_METADATA_STRING_SCHEMA,
    threadId: EVENT_HISTORY_REFRESH_METADATA_STRING_SCHEMA
  })
  .passthrough();

export interface EventStreamRefreshDecisionInput {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
  eventData: string;
}

export interface EventStreamRefreshDecision {
  refreshCore: boolean;
  refreshHistory: boolean;
  refreshSelectedThread: boolean;
  threadStreamDelta: FarfieldThreadStreamDelta | null;
}

/**
 * Parses event-stream payloads and decides the minimum refresh scope needed for UI consistency.
 */
export class EventStreamRefreshDecisionEngine {
  private readonly threadOnlyHistoryMethods: Set<string>;

  public constructor(threadOnlyHistoryMethods: readonly string[]) {
    this.threadOnlyHistoryMethods = new Set<string>(threadOnlyHistoryMethods);
  }

  public readDecision(input: EventStreamRefreshDecisionInput): EventStreamRefreshDecision {
    let refreshCore = false;
    let refreshHistory = false;
    let refreshSelectedThread = false;
    let threadStreamDelta: FarfieldThreadStreamDelta | null = null;

    try {
      const parseResult = FarfieldEventStreamEnvelopeSchema.safeParse(JSON.parse(input.eventData));
      if (!parseResult.success) {
        refreshCore = true;
        refreshHistory = input.activeTab === "debug";
      } else if (parseResult.data.event.type === "runtime-state-changed") {
        refreshCore = true;
      } else if (parseResult.data.event.type === "activity-history-appended") {
        refreshHistory = input.activeTab === "debug";
        const eventHistoryRefreshMetadata = EVENT_HISTORY_REFRESH_METADATA_SCHEMA.parse(
          parseResult.data.event.entry.meta
        );
        const eventMethod = eventHistoryRefreshMetadata.method;
        const eventThreadId = eventHistoryRefreshMetadata.threadId;
        const isThreadOnlyMethod = eventMethod !== null && this.threadOnlyHistoryMethods.has(eventMethod);

        if (
          !isThreadOnlyMethod
          && (parseResult.data.event.entry.source === "app" || parseResult.data.event.entry.source === "system")
        ) {
          refreshCore = true;
        }
        if (
          eventMethod !== THREAD_STREAM_STATE_CHANGED_METHOD
          && eventThreadId !== null
          && input.selectedThreadId
          && eventThreadId === input.selectedThreadId
        ) {
          refreshSelectedThread = true;
        }
        if (eventThreadId === null && !isThreadOnlyMethod) {
          refreshCore = true;
        }
      } else {
        if (
          input.selectedThreadId
          && parseResult.data.event.delta.threadId === input.selectedThreadId
        ) {
          threadStreamDelta = parseResult.data.event.delta;
        }
      }
    } catch {
      refreshCore = true;
      refreshHistory = input.activeTab === "debug";
    }

    return {
      refreshCore,
      refreshHistory,
      refreshSelectedThread,
      threadStreamDelta
    };
  }
}
