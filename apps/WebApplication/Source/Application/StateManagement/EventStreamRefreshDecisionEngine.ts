import {
  FarfieldEventStreamEnvelopeSchema,
  type FarfieldThreadStreamDelta
} from "@farfield/protocol";

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
        const eventMethodValue = parseResult.data.event.entry.meta["method"];
        const eventThreadIdValue = parseResult.data.event.entry.meta["threadId"];
        const eventMethod = typeof eventMethodValue === "string" ? eventMethodValue : null;
        const eventThreadId = typeof eventThreadIdValue === "string" ? eventThreadIdValue : null;
        const isThreadOnlyMethod = typeof eventMethod === "string"
          && this.threadOnlyHistoryMethods.has(eventMethod);

        if (
          !isThreadOnlyMethod
          && (parseResult.data.event.entry.source === "app" || parseResult.data.event.entry.source === "system")
        ) {
          refreshCore = true;
        }
        if (
          eventMethod !== "thread-stream-state-changed"
          && eventThreadId
          && input.selectedThreadId
          && eventThreadId === input.selectedThreadId
        ) {
          refreshSelectedThread = true;
        }
        if (!eventThreadId && !isThreadOnlyMethod) {
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
