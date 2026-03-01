import {
  FarfieldEventStreamEnvelopeSchema,
  type FarfieldThreadStreamDelta,
} from "@farfield/protocol";
import { z } from "zod";

const DEBUG_ACTIVE_TAB = "debug";
const EVENT_TYPE_RUNTIME_STATE_CHANGED = "runtime-state-changed";
const EVENT_TYPE_ACTIVITY_HISTORY_APPENDED = "activity-history-appended";
const EVENT_TYPE_THREAD_STREAM_DELTA = "thread-stream-delta";
const THREAD_STREAM_STATE_CHANGED_METHOD = "thread-stream-state-changed";
const THREAD_STATUS_CHANGED_NOTIFICATION_METHOD = "thread/status/changed";
const THREAD_STARTED_NOTIFICATION_METHOD = "thread/started";
const THREAD_COMPACTED_NOTIFICATION_METHOD = "thread/compacted";
const THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION_METHOD = "thread/tokenUsage/updated";
const MODEL_REROUTED_NOTIFICATION_METHOD = "model/rerouted";
const ACCOUNT_UPDATED_NOTIFICATION_METHOD = "account/updated";
const ACCOUNT_RATE_LIMITS_UPDATED_NOTIFICATION_METHOD = "account/rateLimits/updated";
const APP_LIST_UPDATED_NOTIFICATION_METHOD = "app/list/updated";
const CORE_REFRESH_HISTORY_ENTRY_SOURCES = new Set(["app", "system"]);
const RUNTIME_NOTIFICATION_PROJECTION_METHODS = new Set([
  THREAD_STATUS_CHANGED_NOTIFICATION_METHOD,
  THREAD_STARTED_NOTIFICATION_METHOD,
  THREAD_COMPACTED_NOTIFICATION_METHOD,
  THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION_METHOD,
  MODEL_REROUTED_NOTIFICATION_METHOD,
  ACCOUNT_UPDATED_NOTIFICATION_METHOD,
  ACCOUNT_RATE_LIMITS_UPDATED_NOTIFICATION_METHOD,
  APP_LIST_UPDATED_NOTIFICATION_METHOD,
]);
const EVENT_HISTORY_REFRESH_METADATA_STRING_SCHEMA = z.preprocess(
  (value) => (typeof value === "string" && value.length > 0 ? value : null),
  z.string().min(1).nullable(),
);
const EVENT_HISTORY_REFRESH_METADATA_SCHEMA = z
  .object({
    method: EVENT_HISTORY_REFRESH_METADATA_STRING_SCHEMA,
    threadId: EVENT_HISTORY_REFRESH_METADATA_STRING_SCHEMA,
  })
  .passthrough();
const EVENT_STREAM_TYPE_ENVELOPE_SCHEMA = z
  .object({
    sequence: z.number().int().nonnegative(),
    event: z
      .object({
        type: z.enum([
          EVENT_TYPE_RUNTIME_STATE_CHANGED,
          EVENT_TYPE_ACTIVITY_HISTORY_APPENDED,
          EVENT_TYPE_THREAD_STREAM_DELTA,
        ]),
      })
      .passthrough(),
  })
  .strict();
const EVENT_STREAM_ACTIVITY_HISTORY_ENVELOPE_SCHEMA = z
  .object({
    sequence: z.number().int().nonnegative(),
    event: z
      .object({
        type: z.literal(EVENT_TYPE_ACTIVITY_HISTORY_APPENDED),
        entry: z
          .object({
            source: z.string().min(1),
            meta: z.object({}).passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .strict();
const EVENT_STREAM_DELTA_THREAD_IDENTIFIER_ENVELOPE_SCHEMA = z
  .object({
    sequence: z.number().int().nonnegative(),
    event: z
      .object({
        type: z.literal(EVENT_TYPE_THREAD_STREAM_DELTA),
        delta: z
          .object({
            threadId: z.string().min(1),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .strict();

export interface EventStreamRefreshDecisionInput {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
  eventData: string;
}

export interface EventStreamRefreshDecision {
  refreshCore: boolean;
  refreshHistory: boolean;
  refreshSelectedThread: boolean;
  refreshNotificationProjections: boolean;
  threadStreamDelta: FarfieldThreadStreamDelta | null;
}

export interface EventStreamRefreshDecisionReader {
  readDecision(
    input: EventStreamRefreshDecisionInput,
  ): EventStreamRefreshDecision | Promise<EventStreamRefreshDecision>;
}

/**
 * Parses event-stream payloads and decides the smallest refresh scope that keeps UI state coherent.
 * History refresh is intentionally debug-tab-only because history data powers the debug workspace.
 */
export class EventStreamRefreshDecisionEngine implements EventStreamRefreshDecisionReader {
  private readonly threadOnlyHistoryMethods: Set<string>;

  public constructor(threadOnlyHistoryMethods: readonly string[]) {
    this.threadOnlyHistoryMethods = new Set<string>(threadOnlyHistoryMethods);
  }

  public readDecision(input: EventStreamRefreshDecisionInput): EventStreamRefreshDecision {
    let refreshCore = false;
    let refreshHistory = false;
    let refreshSelectedThread = false;
    let refreshNotificationProjections = false;
    let threadStreamDelta: FarfieldThreadStreamDelta | null = null;
    const refreshHistoryForDebugTab = input.activeTab === DEBUG_ACTIVE_TAB;

    try {
      const parsedEventPayload = JSON.parse(input.eventData);
      const eventTypeEnvelopeResult =
        EVENT_STREAM_TYPE_ENVELOPE_SCHEMA.safeParse(parsedEventPayload);
      if (!eventTypeEnvelopeResult.success) {
        refreshCore = true;
        refreshHistory = refreshHistoryForDebugTab;
      } else if (eventTypeEnvelopeResult.data.event.type === EVENT_TYPE_RUNTIME_STATE_CHANGED) {
        refreshCore = true;
      } else if (eventTypeEnvelopeResult.data.event.type === EVENT_TYPE_ACTIVITY_HISTORY_APPENDED) {
        const activityHistoryEnvelopeResult =
          EVENT_STREAM_ACTIVITY_HISTORY_ENVELOPE_SCHEMA.safeParse(parsedEventPayload);
        if (!activityHistoryEnvelopeResult.success) {
          refreshCore = true;
          refreshHistory = refreshHistoryForDebugTab;
          return {
            refreshCore,
            refreshHistory,
            refreshSelectedThread,
            refreshNotificationProjections,
            threadStreamDelta,
          };
        }

        refreshHistory = refreshHistoryForDebugTab;
        const eventHistoryRefreshMetadata = EVENT_HISTORY_REFRESH_METADATA_SCHEMA.parse(
          activityHistoryEnvelopeResult.data.event.entry.meta,
        );
        const eventMethod = eventHistoryRefreshMetadata.method;
        const eventThreadId = eventHistoryRefreshMetadata.threadId;
        if (eventMethod !== null && RUNTIME_NOTIFICATION_PROJECTION_METHODS.has(eventMethod)) {
          refreshNotificationProjections = true;
        }
        const isThreadOnlyMethod =
          eventMethod !== null && this.threadOnlyHistoryMethods.has(eventMethod);

        if (
          !isThreadOnlyMethod &&
          CORE_REFRESH_HISTORY_ENTRY_SOURCES.has(
            activityHistoryEnvelopeResult.data.event.entry.source,
          )
        ) {
          refreshCore = true;
        }
        // This method has its own delta channel; skipping selected-thread refresh avoids duplicate work.
        if (
          eventMethod !== THREAD_STREAM_STATE_CHANGED_METHOD &&
          eventThreadId !== null &&
          input.selectedThreadId !== null &&
          input.selectedThreadId.length > 0 &&
          eventThreadId === input.selectedThreadId
        ) {
          refreshSelectedThread = true;
        }
        // Non-thread-only history without thread metadata cannot be scoped to one thread.
        if (eventThreadId === null && !isThreadOnlyMethod) {
          refreshCore = true;
        }
      } else {
        const threadIdentifierEnvelopeResult =
          EVENT_STREAM_DELTA_THREAD_IDENTIFIER_ENVELOPE_SCHEMA.safeParse(parsedEventPayload);
        if (!threadIdentifierEnvelopeResult.success) {
          refreshCore = true;
          refreshHistory = refreshHistoryForDebugTab;
          return {
            refreshCore,
            refreshHistory,
            refreshSelectedThread,
            refreshNotificationProjections,
            threadStreamDelta,
          };
        }

        if (
          input.selectedThreadId !== null &&
          input.selectedThreadId.length > 0 &&
          threadIdentifierEnvelopeResult.data.event.delta.threadId === input.selectedThreadId
        ) {
          const fullEnvelopeResult =
            FarfieldEventStreamEnvelopeSchema.safeParse(parsedEventPayload);
          if (!fullEnvelopeResult.success) {
            refreshCore = true;
            refreshHistory = refreshHistoryForDebugTab;
          } else if (fullEnvelopeResult.data.event.type === EVENT_TYPE_THREAD_STREAM_DELTA) {
            threadStreamDelta = fullEnvelopeResult.data.event.delta;
          } else {
            refreshCore = true;
            refreshHistory = refreshHistoryForDebugTab;
          }
        } else {
          refreshCore = true;
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
      refreshNotificationProjections,
      threadStreamDelta,
    };
  }
}
