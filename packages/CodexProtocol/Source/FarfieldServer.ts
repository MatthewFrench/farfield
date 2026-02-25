import { z } from "zod";
import {
  CreatePushSubscriptionResponseSchema,
  DeletePushSubscriptionResponseSchema,
  PushLocalCaStatusResponseSchema,
  PushReceiptCreateResponseSchema,
  PushReceiptLatestResponseSchema,
  PushSendLatestResponseSchema,
  PushStatusResponseSchema,
  VapidPublicKeyResponseSchema
} from "./Push.js";
import {
  DebugErrorCreateResponseSchema,
  DebugErrorDetailResponseSchema,
  DebugErrorListResponseSchema
} from "./AppServer.js";

export const FarfieldApiErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1)
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
    pushSubscriptionCount: z.number().int().nonnegative().optional()
  })
  .passthrough();

export const FarfieldHealthResponseSchema = z
  .object({
    ok: z.literal(true),
    state: FarfieldHealthStateSchema
  })
  .strict();

export const FarfieldEventsSessionResponseSchema = z
  .object({
    ok: z.literal(true),
    authRequired: z.boolean(),
    bootstrapped: z.boolean(),
    expiresAt: z.string().datetime().nullable()
  })
  .strict();

export const FarfieldPushStatusEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushStatusResponseSchema)
  .strict();

export const FarfieldPushVapidPublicKeyEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(VapidPublicKeyResponseSchema)
  .strict();

export const FarfieldCreatePushSubscriptionEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(CreatePushSubscriptionResponseSchema)
  .strict();

export const FarfieldDeletePushSubscriptionEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DeletePushSubscriptionResponseSchema)
  .strict();

export const FarfieldPushReceiptCreateEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushReceiptCreateResponseSchema)
  .strict();

export const FarfieldPushReceiptLatestEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushReceiptLatestResponseSchema)
  .strict();

export const FarfieldPushSendLatestEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushSendLatestResponseSchema)
  .strict();

export const FarfieldPushLocalCaStatusEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushLocalCaStatusResponseSchema)
  .strict();

export const FarfieldPushTestBodySchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    title: z.string().min(1).optional(),
    body: z.string().optional(),
    dryRun: z.boolean().optional()
  })
  .strict();

export const FarfieldPushTestEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    dryRun: z.boolean(),
    notificationId: z.string().nullable(),
    ready: z.boolean(),
    reason: z.string().min(1),
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative()
  })
  .strict();

export const FarfieldDebugErrorCreateEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorCreateResponseSchema)
  .strict();

export const FarfieldDebugErrorListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorListResponseSchema)
  .strict();

export const FarfieldDebugErrorDetailEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorDetailResponseSchema)
  .strict();

export const FarfieldThreadListAggregationCacheStatisticsSchema = z
  .object({
    hitCount: z.number().int().nonnegative(),
    missCount: z.number().int().nonnegative(),
    coalescedCount: z.number().int().nonnegative(),
    evictionCount: z.number().int().nonnegative(),
    invalidationCount: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(),
    inFlightCount: z.number().int().nonnegative()
  })
  .strict();

export const FarfieldThreadConcurrencyStatisticsSchema = z
  .object({
    queuedExecutionCount: z.number().int().nonnegative(),
    completedExecutionCount: z.number().int().nonnegative(),
    failedExecutionCount: z.number().int().nonnegative(),
    activeThreadCount: z.number().int().nonnegative()
  })
  .strict();

export const FarfieldPushDispatchConcurrencyStatisticsSchema = z
  .object({
    scheduledCheckCount: z.number().int().nonnegative(),
    startedCheckCount: z.number().int().nonnegative(),
    completedCheckCount: z.number().int().nonnegative(),
    skippedWhileInFlightCount: z.number().int().nonnegative(),
    activeTimerCount: z.number().int().nonnegative(),
    inFlightThreadCount: z.number().int().nonnegative()
  })
  .strict();

export const FarfieldPushMutationConcurrencyStatisticsSchema = z
  .object({
    queuedExecutionCount: z.number().int().nonnegative(),
    completedExecutionCount: z.number().int().nonnegative(),
    failedExecutionCount: z.number().int().nonnegative(),
    hasInFlightOperation: z.boolean()
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
    keepaliveWriteFailureCount: z.number().int().nonnegative()
  })
  .strict();

export const FarfieldThreadAdapterResolverStatisticsSchema = z
  .object({
    registeredLookupCount: z.number().int().nonnegative(),
    unregisteredDiscoveryAttemptCount: z.number().int().nonnegative(),
    unregisteredDiscoverySuccessCount: z.number().int().nonnegative(),
    unregisteredDiscoveryMissCount: z.number().int().nonnegative(),
    unregisteredDiscoveryMissCacheHitCount: z.number().int().nonnegative(),
    unregisteredDiscoveryAmbiguousCount: z.number().int().nonnegative(),
    unregisteredDiscoveryAlertCount: z.number().int().nonnegative()
  })
  .strict();

export const FarfieldDebugObservabilitySnapshotSchema = z
  .object({
    recordedAt: z.string().datetime(),
    cache: z.object({
      threadListAggregation: FarfieldThreadListAggregationCacheStatisticsSchema
    }).strict(),
    concurrency: z.object({
      thread: FarfieldThreadConcurrencyStatisticsSchema,
      pushDispatch: FarfieldPushDispatchConcurrencyStatisticsSchema,
      pushMutation: FarfieldPushMutationConcurrencyStatisticsSchema
    }).strict(),
    streaming: z.object({
      eventStream: FarfieldEventStreamClientRegistryStatisticsSchema
    }).strict(),
    routing: z.object({
      threadAdapterResolver: FarfieldThreadAdapterResolverStatisticsSchema
    }).strict()
  })
  .strict();

export const FarfieldDebugObservabilityEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    snapshot: FarfieldDebugObservabilitySnapshotSchema
  })
  .strict();
