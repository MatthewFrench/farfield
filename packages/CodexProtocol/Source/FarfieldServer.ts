import { z } from "zod";
import {
  DebugErrorClearResponseSchema,
  DebugErrorCreateResponseSchema,
  DebugErrorDetailResponseSchema,
  DebugErrorListResponseSchema,
} from "./AppServer.js";
import { JsonValueSchema } from "./Common.js";
import { ThreadConversationStateSchema } from "./Contracts/Thread/ConversationStateContracts.js";
import { IpcFrameSchema } from "./Ipc.js";
import {
  CreatePushSubscriptionResponseSchema,
  DeletePushSubscriptionResponseSchema,
  PushLocalCaStatusResponseSchema,
  PushReceiptCreateResponseSchema,
  PushReceiptLatestResponseSchema,
  PushSendLatestResponseSchema,
  PushStatusResponseSchema,
  VapidPublicKeyResponseSchema,
} from "./Push.js";

const FarfieldProtocolStatusValue = {
  Success: true,
  Error: false,
} as const;

const FarfieldEventStreamEventType = {
  RuntimeStateChanged: "runtime-state-changed",
  ActivityHistoryAppended: "activity-history-appended",
  ThreadStreamDelta: "thread-stream-delta",
} as const;

const FarfieldRequestLifecyclePhaseValue = {
  Started: "started",
  Completed: "completed",
} as const;

const FarfieldRequestLifecycleOutcomeValues = ["success", "error"] as const;

const FarfieldSuccessResponseEnvelopeSchema = z.object({
  ok: z.literal(FarfieldProtocolStatusValue.Success),
});

export const FarfieldApiErrorResponseSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Error),
    error: z.string().min(1),
  })
  .strict();

export const FarfieldHealthStateSchema = z
  .object({
    appReady: z.boolean(),
    ipcConnected: z.boolean(),
    ipcInitialized: z.boolean(),
    workspaceDir: z.string().nullable().optional(),
    gitCommit: z.string().nullable().optional(),
    lastError: z.string().nullable(),
    historyCount: z.number().int().nonnegative(),
    threadOwnerCount: z.number().int().nonnegative(),
    pushSubscriptionCount: z.number().int().nonnegative().optional(),
  })
  // Health diagnostics may add keys over time; known fields stay typed while unknown keys pass through.
  .passthrough();

export const FarfieldHealthResponseSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    state: FarfieldHealthStateSchema,
  })
  .strict();

export const FarfieldEventsSessionResponseSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    authRequired: z.boolean(),
    bootstrapped: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
  })
  .strict();

export const FarfieldHistoryEntrySchema = z
  .object({
    id: z.string().min(1),
    at: z.string().datetime(),
    source: z.enum(["ipc", "app", "system"]),
    direction: z.enum(["in", "out", "system"]),
    payload: JsonValueSchema,
    meta: z.record(JsonValueSchema),
  })
  .strict();

export type FarfieldHistoryEntry = z.infer<typeof FarfieldHistoryEntrySchema>;

const FarfieldThreadLiveStateErrorSchema = z
  .object({
    kind: z.literal("reductionFailed"),
    message: z.string().min(1),
    eventIndex: z.number().int().nonnegative().nullable(),
    patchIndex: z.number().int().nonnegative().nullable(),
  })
  .strict();

const FarfieldNullableThreadConversationStateSchema: z.ZodUnion<
  [typeof ThreadConversationStateSchema, z.ZodNull]
> = z.union([ThreadConversationStateSchema, z.null()]);

export const FarfieldThreadLiveStateSnapshotSchema: z.ZodObject<
  {
    ok: z.ZodLiteral<typeof FarfieldProtocolStatusValue.Success>;
    threadId: z.ZodString;
    ownerClientId: z.ZodNullable<z.ZodString>;
    conversationState: typeof FarfieldNullableThreadConversationStateSchema;
    liveStateError: z.ZodNullable<typeof FarfieldThreadLiveStateErrorSchema>;
  },
  "strict"
> = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    threadId: z.string().min(1),
    ownerClientId: z.string().nullable(),
    conversationState: FarfieldNullableThreadConversationStateSchema,
    liveStateError: FarfieldThreadLiveStateErrorSchema.nullable(),
  })
  .strict();

export type FarfieldThreadLiveStateSnapshot = z.infer<typeof FarfieldThreadLiveStateSnapshotSchema>;

export const FarfieldThreadStreamEventsSnapshotSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    threadId: z.string().min(1),
    ownerClientId: z.string().nullable(),
    events: z.array(IpcFrameSchema),
    // Clients consume these fields as an append-or-reset cursor contract.
    nextSequence: z.number().int().nonnegative(),
    firstAvailableSequence: z.number().int().nonnegative(),
    resetRequired: z.boolean(),
  })
  .strict();

export type FarfieldThreadStreamEventsSnapshot = z.infer<
  typeof FarfieldThreadStreamEventsSnapshotSchema
>;

export const FarfieldNotificationEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    method: z.string().min(1),
    params: JsonValueSchema.nullable(),
    receivedAtMilliseconds: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldNotificationEventsSnapshotSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    events: z.array(FarfieldNotificationEventSchema),
    nextSequence: z.number().int().nonnegative(),
    firstAvailableSequence: z.number().int().nonnegative(),
    resetRequired: z.boolean(),
  })
  .strict();

export type FarfieldNotificationEvent = z.infer<typeof FarfieldNotificationEventSchema>;
export type FarfieldNotificationEventsSnapshot = z.infer<
  typeof FarfieldNotificationEventsSnapshotSchema
>;

export const FarfieldPendingServerRequestSchema = z
  .object({
    requestId: z.number().int().nonnegative(),
    method: z.string().min(1),
    params: JsonValueSchema.nullable(),
    receivedAtMilliseconds: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldPendingServerRequestsSnapshotSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    requests: z.array(FarfieldPendingServerRequestSchema),
  })
  .strict();

export type FarfieldPendingServerRequest = z.infer<typeof FarfieldPendingServerRequestSchema>;
export type FarfieldPendingServerRequestsSnapshot = z.infer<
  typeof FarfieldPendingServerRequestsSnapshotSchema
>;
export type FarfieldHealthState = z.infer<typeof FarfieldHealthStateSchema>;

export const FarfieldThreadStreamDeltaSchema: z.ZodObject<
  {
    threadId: z.ZodString;
    liveStateSnapshot: typeof FarfieldThreadLiveStateSnapshotSchema;
    streamEventsSnapshot: typeof FarfieldThreadStreamEventsSnapshotSchema;
    streamEventsSinceSequenceUsed: z.ZodNullable<z.ZodNumber>;
  },
  "strict"
> = z
  .object({
    // This identifier is duplicated outside nested snapshots so reducers can route deltas early.
    threadId: z.string().min(1),
    liveStateSnapshot: FarfieldThreadLiveStateSnapshotSchema,
    streamEventsSnapshot: FarfieldThreadStreamEventsSnapshotSchema,
    streamEventsSinceSequenceUsed: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type FarfieldRuntimeStateChangedEvent = {
  type: typeof FarfieldEventStreamEventType.RuntimeStateChanged;
  state: FarfieldHealthState;
};

export type FarfieldActivityHistoryAppendedEvent = {
  type: typeof FarfieldEventStreamEventType.ActivityHistoryAppended;
  entry: FarfieldHistoryEntry;
};

export type FarfieldThreadStreamDelta = z.infer<typeof FarfieldThreadStreamDeltaSchema>;

export type FarfieldThreadStreamDeltaEvent = {
  type: typeof FarfieldEventStreamEventType.ThreadStreamDelta;
  delta: FarfieldThreadStreamDelta;
};

export type FarfieldEventStreamEvent =
  | FarfieldRuntimeStateChangedEvent
  | FarfieldActivityHistoryAppendedEvent
  | FarfieldThreadStreamDeltaEvent;

export type FarfieldEventStreamEnvelope = {
  sequence: number;
  event: FarfieldEventStreamEvent;
};

export const FarfieldRuntimeStateChangedEventSchema = z
  .object({
    type: z.literal(FarfieldEventStreamEventType.RuntimeStateChanged),
    state: FarfieldHealthStateSchema,
  })
  .strict();

export const FarfieldActivityHistoryAppendedEventSchema = z
  .object({
    type: z.literal(FarfieldEventStreamEventType.ActivityHistoryAppended),
    entry: FarfieldHistoryEntrySchema,
  })
  .strict();

export const FarfieldThreadStreamDeltaEventSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"thread-stream-delta">;
    delta: typeof FarfieldThreadStreamDeltaSchema;
  },
  "strict"
> = z
  .object({
    type: z.literal(FarfieldEventStreamEventType.ThreadStreamDelta),
    delta: FarfieldThreadStreamDeltaSchema,
  })
  .strict();

export const FarfieldEventStreamEventSchema: z.ZodDiscriminatedUnion<
  "type",
  [
    typeof FarfieldRuntimeStateChangedEventSchema,
    typeof FarfieldActivityHistoryAppendedEventSchema,
    typeof FarfieldThreadStreamDeltaEventSchema,
  ]
> = z.discriminatedUnion("type", [
  FarfieldRuntimeStateChangedEventSchema,
  FarfieldActivityHistoryAppendedEventSchema,
  FarfieldThreadStreamDeltaEventSchema,
]);

export const FarfieldEventStreamEnvelopeSchema: z.ZodObject<
  {
    sequence: z.ZodNumber;
    event: typeof FarfieldEventStreamEventSchema;
  },
  "strict"
> = z
  .object({
    sequence: z.number().int().nonnegative(),
    event: FarfieldEventStreamEventSchema,
  })
  .strict();

export const FarfieldPushStatusEnvelopeSchema =
  FarfieldSuccessResponseEnvelopeSchema.merge(PushStatusResponseSchema).strict();

export const FarfieldPushVapidPublicKeyEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  VapidPublicKeyResponseSchema,
).strict();

export const FarfieldCreatePushSubscriptionEnvelopeSchema =
  FarfieldSuccessResponseEnvelopeSchema.merge(CreatePushSubscriptionResponseSchema).strict();

export const FarfieldDeletePushSubscriptionEnvelopeSchema =
  FarfieldSuccessResponseEnvelopeSchema.merge(DeletePushSubscriptionResponseSchema).strict();

export const FarfieldPushReceiptCreateEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  PushReceiptCreateResponseSchema,
).strict();

export const FarfieldPushReceiptLatestEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  PushReceiptLatestResponseSchema,
).strict();

export const FarfieldPushSendLatestEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  PushSendLatestResponseSchema,
).strict();

export const FarfieldPushLocalCaStatusEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  PushLocalCaStatusResponseSchema,
).strict();

export const FarfieldPushTestBodySchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    title: z.string().min(1).optional(),
    body: z.string().optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

export const FarfieldPushTestEnvelopeSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    dryRun: z.boolean(),
    notificationId: z.string().nullable(),
    ready: z.boolean(),
    reason: z.string().min(1),
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldDebugErrorCreateEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  DebugErrorCreateResponseSchema,
).strict();

export const FarfieldDebugErrorClearEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  DebugErrorClearResponseSchema,
).strict();

export const FarfieldDebugErrorListEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  DebugErrorListResponseSchema,
).strict();

export const FarfieldDebugErrorDetailEnvelopeSchema = FarfieldSuccessResponseEnvelopeSchema.merge(
  DebugErrorDetailResponseSchema,
).strict();

export const FarfieldThreadListAggregationCacheStatisticsSchema = z
  .object({
    hitCount: z.number().int().nonnegative(),
    missCount: z.number().int().nonnegative(),
    coalescedCount: z.number().int().nonnegative(),
    evictionCount: z.number().int().nonnegative(),
    invalidationCount: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(),
    inFlightCount: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldSidebarThreadSyncSnapshotCacheStatisticsSchema = z
  .object({
    hitCount: z.number().int().nonnegative(),
    missCount: z.number().int().nonnegative(),
    writeCount: z.number().int().nonnegative(),
    invalidationCount: z.number().int().nonnegative(),
    evictionCount: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldThreadConcurrencyStatisticsSchema = z
  .object({
    queuedExecutionCount: z.number().int().nonnegative(),
    completedExecutionCount: z.number().int().nonnegative(),
    failedExecutionCount: z.number().int().nonnegative(),
    activeThreadCount: z.number().int().nonnegative(),
    inFlightThreadCount: z.number().int().nonnegative(),
    pendingExecutionCount: z.number().int().nonnegative(),
    blockedExecutionCount: z.number().int().nonnegative(),
    lastBlockedWaitMs: z.number().nonnegative(),
    p95BlockedWaitMs: z.number().nonnegative(),
    maxBlockedWaitMs: z.number().nonnegative(),
  })
  .strict();

export const FarfieldPushDispatchConcurrencyStatisticsSchema = z
  .object({
    scheduledCheckCount: z.number().int().nonnegative(),
    startedCheckCount: z.number().int().nonnegative(),
    completedCheckCount: z.number().int().nonnegative(),
    skippedWhileInFlightCount: z.number().int().nonnegative(),
    activeTimerCount: z.number().int().nonnegative(),
    inFlightThreadCount: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldPushMutationConcurrencyStatisticsSchema = z
  .object({
    queuedExecutionCount: z.number().int().nonnegative(),
    completedExecutionCount: z.number().int().nonnegative(),
    failedExecutionCount: z.number().int().nonnegative(),
    hasInFlightOperation: z.boolean(),
    pendingExecutionCount: z.number().int().nonnegative(),
    blockedExecutionCount: z.number().int().nonnegative(),
    lastBlockedWaitMs: z.number().nonnegative(),
    p95BlockedWaitMs: z.number().nonnegative(),
    maxBlockedWaitMs: z.number().nonnegative(),
  })
  .strict();

export const FarfieldEventStreamClientRegistryStatisticsSchema = z
  .object({
    activeClientCount: z.number().int().nonnegative(),
    keepaliveEnabled: z.boolean(),
    addedClientCount: z.number().int().nonnegative(),
    removedClientCount: z.number().int().nonnegative(),
    broadcastEventCount: z.number().int().nonnegative(),
    broadcastDeliveryAttemptCount: z.number().int().nonnegative(),
    eventWriteFailureCount: z.number().int().nonnegative(),
    keepaliveWriteFailureCount: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldThreadAdapterResolverStatisticsSchema = z
  .object({
    registeredLookupCount: z.number().int().nonnegative(),
    unregisteredDiscoveryAttemptCount: z.number().int().nonnegative(),
    unregisteredDiscoverySuccessCount: z.number().int().nonnegative(),
    unregisteredDiscoveryMissCount: z.number().int().nonnegative(),
    unregisteredDiscoveryMissCacheHitCount: z.number().int().nonnegative(),
    unregisteredDiscoveryProbeFailureCount: z.number().int().nonnegative().optional().default(0),
    unregisteredDiscoveryAmbiguousCount: z.number().int().nonnegative(),
    unregisteredDiscoveryAlertCount: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldRouteTimingSummarySchema = z
  .object({
    route: z.string().trim().min(1),
    method: z.string().trim().min(1),
    requestCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    lastDurationMs: z.number().nonnegative(),
    p50DurationMs: z.number().nonnegative(),
    p95DurationMs: z.number().nonnegative(),
    p99DurationMs: z.number().nonnegative(),
    lastQueueDelayMs: z.number().nonnegative(),
    p95QueueDelayMs: z.number().nonnegative(),
    maxQueueDelayMs: z.number().nonnegative(),
  })
  .strict();

export const FarfieldStartupRequestTimingSummarySchema = z
  .object({
    requestId: z.string().trim().min(1),
    actionId: z.string().trim().min(1).nullable(),
    actionName: z.string().trim().min(1),
    description: z.string().trim().min(1),
    method: z.string().trim().min(1),
    pathname: z.string().trim().min(1),
    statusCode: z.number().int().min(100).max(599),
    durationMs: z.number().nonnegative(),
    queueDelayMs: z.number().nonnegative(),
    completedAt: z.string().datetime(),
  })
  .strict();

export const FarfieldRequestLifecycleStartedEventSchema = z
  .object({
    phase: z.literal(FarfieldRequestLifecyclePhaseValue.Started),
    requestId: z.string().trim().min(1),
    actionId: z.string().trim().min(1).nullable(),
    actionName: z.string().trim().min(1).nullable(),
    method: z.string().trim().min(1),
    pathname: z.string().trim().min(1),
    startedAt: z.string().datetime(),
    queueDelayMs: z.number().nonnegative(),
  })
  .strict();

const FarfieldRequestLifecycleOutcomeSchema = z.enum(FarfieldRequestLifecycleOutcomeValues);

export const FarfieldRequestLifecycleCompletedEventSchema = z
  .object({
    phase: z.literal(FarfieldRequestLifecyclePhaseValue.Completed),
    requestId: z.string().trim().min(1),
    actionId: z.string().trim().min(1).nullable(),
    actionName: z.string().trim().min(1).nullable(),
    method: z.string().trim().min(1),
    pathname: z.string().trim().min(1),
    startedAt: z.string().datetime(),
    statusCode: z.number().int().min(100).max(599),
    durationMs: z.number().nonnegative(),
    queueDelayMs: z.number().nonnegative(),
    completedAt: z.string().datetime(),
    outcome: FarfieldRequestLifecycleOutcomeSchema,
  })
  .strict();

export const FarfieldRequestLifecycleEventSchema: z.ZodDiscriminatedUnion<
  "phase",
  [
    typeof FarfieldRequestLifecycleStartedEventSchema,
    typeof FarfieldRequestLifecycleCompletedEventSchema,
  ]
> = z.discriminatedUnion("phase", [
  FarfieldRequestLifecycleStartedEventSchema,
  FarfieldRequestLifecycleCompletedEventSchema,
]);

export const FarfieldRequestObservabilitySnapshotSchema = z
  .object({
    totalRequestCount: z.number().int().nonnegative(),
    totalErrorCount: z.number().int().nonnegative(),
    inFlightRequestCount: z.number().int().nonnegative(),
    routeTimings: z.array(FarfieldRouteTimingSummarySchema),
    startupRequestTimings: z.array(FarfieldStartupRequestTimingSummarySchema),
    requestLifecycleEvents: z.array(FarfieldRequestLifecycleEventSchema),
  })
  .strict();

export const FarfieldEventLoopLagStatisticsSchema = z
  .object({
    sampleIntervalMs: z.number().int().positive(),
    sampleCount: z.number().int().nonnegative(),
    lastLagMs: z.number().nonnegative(),
    p50LagMs: z.number().nonnegative(),
    p95LagMs: z.number().nonnegative(),
    p99LagMs: z.number().nonnegative(),
    maxLagMs: z.number().nonnegative(),
  })
  .strict();

export const FarfieldThreadSendProgressObservabilityStatisticsSchema = z
  .object({
    activeThreadCount: z.number().int().nonnegative(),
    inboundSampleCount: z.number().int().nonnegative(),
    publishedDeltaSampleCount: z.number().int().nonnegative(),
    assistantVisibleSampleCount: z.number().int().nonnegative(),
    lastAcceptedToFirstInboundThreadStreamStateChangedMs: z.number().nonnegative(),
    p50AcceptedToFirstInboundThreadStreamStateChangedMs: z.number().nonnegative(),
    p95AcceptedToFirstInboundThreadStreamStateChangedMs: z.number().nonnegative(),
    lastAcceptedToFirstPublishedThreadDeltaMs: z.number().nonnegative(),
    p50AcceptedToFirstPublishedThreadDeltaMs: z.number().nonnegative(),
    p95AcceptedToFirstPublishedThreadDeltaMs: z.number().nonnegative(),
    lastAcceptedToFirstAssistantVisibleProgressMs: z.number().nonnegative(),
    p50AcceptedToFirstAssistantVisibleProgressMs: z.number().nonnegative(),
    p95AcceptedToFirstAssistantVisibleProgressMs: z.number().nonnegative(),
  })
  .strict();

export const FarfieldActivityHistoryRetentionStatisticsSchema = z
  .object({
    historyEntryCount: z.number().int().nonnegative(),
    detailPayloadEntryCount: z.number().int().nonnegative(),
    replayPayloadEntryCount: z.number().int().nonnegative(),
    totalDetailPayloadBytes: z.number().int().nonnegative(),
    totalReplayPayloadBytes: z.number().int().nonnegative(),
    historyLimit: z.number().int().positive(),
    detailRetentionMaximumBytes: z.number().int().positive(),
    replayRetentionMaximumBytes: z.number().int().positive(),
    historyEntryEvictionCount: z.number().int().nonnegative(),
    detailPayloadEvictionCount: z.number().int().nonnegative(),
    replayPayloadEvictionCount: z.number().int().nonnegative(),
  })
  .strict();

export const FarfieldDebugObservabilitySnapshotSchema = z
  .object({
    recordedAt: z.string().datetime(),
    cache: z
      .object({
        threadListAggregation: FarfieldThreadListAggregationCacheStatisticsSchema,
        sidebarThreadSyncSnapshot: FarfieldSidebarThreadSyncSnapshotCacheStatisticsSchema,
      })
      .strict(),
    concurrency: z
      .object({
        thread: FarfieldThreadConcurrencyStatisticsSchema,
        pushDispatch: FarfieldPushDispatchConcurrencyStatisticsSchema,
        pushMutation: FarfieldPushMutationConcurrencyStatisticsSchema,
      })
      .strict(),
    streaming: z
      .object({
        eventStream: FarfieldEventStreamClientRegistryStatisticsSchema,
      })
      .strict(),
    routing: z
      .object({
        threadAdapterResolver: FarfieldThreadAdapterResolverStatisticsSchema,
      })
      .strict(),
    performance: z
      .object({
        requestRouting: FarfieldRequestObservabilitySnapshotSchema,
        eventLoop: FarfieldEventLoopLagStatisticsSchema,
        threadSendProgression: FarfieldThreadSendProgressObservabilityStatisticsSchema,
        activityHistory: FarfieldActivityHistoryRetentionStatisticsSchema,
      })
      .strict(),
  })
  .strict();

export const FarfieldDebugObservabilityEnvelopeSchema = z
  .object({
    ok: z.literal(FarfieldProtocolStatusValue.Success),
    snapshot: FarfieldDebugObservabilitySnapshotSchema,
  })
  .strict();
