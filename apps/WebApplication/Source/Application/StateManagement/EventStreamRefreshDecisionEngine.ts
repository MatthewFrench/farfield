import {
  FarfieldEventStreamEnvelopeSchema,
  type FarfieldThreadStreamDelta
} from "@farfield/protocol";
import { z } from "zod";

const DEBUG_ACTIVE_TAB = "debug";
const EVENT_TYPE_RUNTIME_STATE_CHANGED = "runtime-state-changed";
const EVENT_TYPE_ACTIVITY_HISTORY_APPENDED = "activity-history-appended";
const THREAD_STREAM_STATE_CHANGED_METHOD = "thread-stream-state-changed";
const CORE_REFRESH_HISTORY_ENTRY_SOURCES = new Set(["app", "system"]);
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
 * Parses event-stream payloads and decides the smallest refresh scope that keeps UI state coherent.
 * History refresh is intentionally debug-tab-only because history data powers the debug workspace.
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
    const refreshHistoryForDebugTab = input.activeTab === DEBUG_ACTIVE_TAB;

    try {
      const parseResult = FarfieldEventStreamEnvelopeSchema.safeParse(JSON.parse(input.eventData));
      if (!parseResult.success) {
        refreshCore = true;
        refreshHistory = refreshHistoryForDebugTab;
      } else if (parseResult.data.event.type === EVENT_TYPE_RUNTIME_STATE_CHANGED) {
        refreshCore = true;
      } else if (parseResult.data.event.type === EVENT_TYPE_ACTIVITY_HISTORY_APPENDED) {
        refreshHistory = refreshHistoryForDebugTab;
        const eventHistoryRefreshMetadata = EVENT_HISTORY_REFRESH_METADATA_SCHEMA.parse(
          parseResult.data.event.entry.meta
        );
        const eventMethod = eventHistoryRefreshMetadata.method;
        const eventThreadId = eventHistoryRefreshMetadata.threadId;
        const isThreadOnlyMethod = eventMethod !== null && this.threadOnlyHistoryMethods.has(eventMethod);

        if (
          !isThreadOnlyMethod
          && CORE_REFRESH_HISTORY_ENTRY_SOURCES.has(parseResult.data.event.entry.source)
        ) {
          refreshCore = true;
        }
        // This method has its own delta channel; skipping selected-thread refresh avoids duplicate work.
        if (
          eventMethod !== THREAD_STREAM_STATE_CHANGED_METHOD
          && eventThreadId !== null
          && input.selectedThreadId !== null
          && input.selectedThreadId.length > 0
          && eventThreadId === input.selectedThreadId
        ) {
          refreshSelectedThread = true;
        }
        // Non-thread-only history without thread metadata cannot be scoped to one thread.
        if (eventThreadId === null && !isThreadOnlyMethod) {
          refreshCore = true;
        }
      } else {
        if (
          input.selectedThreadId !== null
          && input.selectedThreadId.length > 0
          && parseResult.data.event.delta.threadId === input.selectedThreadId
        ) {
          threadStreamDelta = parseResult.data.event.delta;
        }
      }
    } catch {
      refreshCore = true;
      refreshHistory = refreshHistoryForDebugTab;
    }

    return {
      refreshCore,
      refreshHistory,
      refreshSelectedThread,
      threadStreamDelta
    };
  }
}
