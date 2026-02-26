import { z } from "zod";
import { NonEmptyStringSchema, NonNegativeIntSchema } from "./Common.js";
import { ProtocolValidationError } from "./Errors.js";
import { parseSchemaOrThrow } from "./ProtocolSchemaParsers.js";

const PushStoreVersion = {
  state: 1,
  send: 1,
  receipt: 2,
  legacyReceipt: 1
} as const;
const PushStoreVersionLabel = {
  state: "push state",
  send: "push send store",
  receipt: "push receipt store"
} as const;
const LegacyPushReceiptNotificationIdentifierPrefix = "legacy";
const Base64UrlPattern = /^[A-Za-z0-9_-]+$/;
const Base64UrlValidationMessage = "Expected base64url value";
const IsoDateTimeStringSchema = z.string().datetime();
const NullableNonEmptyStringSchema = NonEmptyStringSchema.nullable();
const OptionalNullableNonEmptyStringSchema = NullableNonEmptyStringSchema.optional();
const PushReceiptEventValues = ["shown", "clicked", "error"] as const;

type VersionedPushStore = {
  version: number;
};

function createUnsupportedPushStoreVersionMessage(
  storeLabel: string,
  actualVersion: number
): string {
  return `Unsupported ${storeLabel} version: ${String(actualVersion)}`;
}

function createPushStoreVersionRefinement(
  expectedVersion: number,
  storeLabel: string
): (state: VersionedPushStore, ctx: z.RefinementCtx) => void {
  // Keep the version field numeric before refinement so diagnostics can include
  // the received version number and remain stable across all push store contracts.
  return (state, ctx) => {
    if (state.version !== expectedVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: createUnsupportedPushStoreVersionMessage(storeLabel, state.version)
      });
    }
  };
}

function buildLegacyPushReceiptNotificationIdentifier(
  receiptIndex: number,
  createdAt: string
): string {
  // Legacy receipt records do not include notification identifiers; synthesize a deterministic value
  // from persisted order and timestamp so migration stays stable for repeated parses.
  return `${LegacyPushReceiptNotificationIdentifierPrefix}-${receiptIndex + 1}-${createdAt}`;
}

const Base64UrlValueSchema = z
  .string()
  .min(1)
  .regex(Base64UrlPattern, Base64UrlValidationMessage);

export const PushSubscriptionKeysSchema = z
  .object({
    p256dh: Base64UrlValueSchema,
    auth: Base64UrlValueSchema
  })
  .strict();

export const PushSubscriptionSchema = z
  .object({
    endpoint: z.string().url(),
    keys: PushSubscriptionKeysSchema
  })
  .strict();

export const PushSettingsSchema = z
  .object({
    privateMode: z.boolean()
  })
  .strict();

export const CreatePushSubscriptionBodySchema = z
  .object({
    subscription: PushSubscriptionSchema,
    settings: PushSettingsSchema.optional()
  })
  .strict();

export const DeletePushSubscriptionBodySchema = z
  .object({
    endpoint: z.string().url()
  })
  .strict();

export const StoredPushSubscriptionSchema = z
  .object({
    id: NonEmptyStringSchema,
    subscription: PushSubscriptionSchema,
    settings: PushSettingsSchema,
    createdAt: IsoDateTimeStringSchema,
    updatedAt: IsoDateTimeStringSchema
  })
  .strict();

export const CompletionWatermarkSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    marker: NonEmptyStringSchema
  })
  .strict();

export const PushStateStoreSchema = z
  .object({
    version: NonNegativeIntSchema,
    subscriptions: z.array(StoredPushSubscriptionSchema),
    completionWatermarks: z.array(CompletionWatermarkSchema)
  })
  .strict()
  .superRefine(
    createPushStoreVersionRefinement(PushStoreVersion.state, PushStoreVersionLabel.state)
  );

export const DeclarativePushNotificationSchema = z
  .object({
    title: NonEmptyStringSchema,
    body: z.string().optional(),
    navigate: NonEmptyStringSchema.optional(),
    icon: NonEmptyStringSchema.optional(),
    badge: NonEmptyStringSchema.optional(),
    tag: NonEmptyStringSchema.optional()
  })
  .strict();

export const DeclarativeWebPushSchema = z
  .object({
    notification: DeclarativePushNotificationSchema
  })
  .strict();

export const PushNotificationPayloadSchema = z
  .object({
    notificationId: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    body: z.string(),
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    url: NonEmptyStringSchema,
    createdAt: IsoDateTimeStringSchema,
    web_push: DeclarativeWebPushSchema.optional()
  })
  .strict();

export const PushReceiptEventSchema = z.enum(PushReceiptEventValues);

export const CreatePushReceiptBodySchema = z
  .object({
    notificationId: NonEmptyStringSchema,
    event: PushReceiptEventSchema,
    url: NonEmptyStringSchema,
    threadId: OptionalNullableNonEmptyStringSchema,
    turnId: OptionalNullableNonEmptyStringSchema,
    message: z.string().max(500).optional(),
    createdAt: IsoDateTimeStringSchema
  })
  .strict();

export const PushReceiptSchema = z
  .object({
    notificationId: NonEmptyStringSchema,
    event: PushReceiptEventSchema,
    url: NonEmptyStringSchema,
    threadId: NullableNonEmptyStringSchema,
    turnId: NullableNonEmptyStringSchema,
    message: z.string().nullable(),
    createdAt: IsoDateTimeStringSchema
  })
  .strict();

const LegacyPushReceiptSchema = z
  .object({
    event: PushReceiptEventSchema,
    url: NonEmptyStringSchema,
    threadId: NullableNonEmptyStringSchema,
    turnId: NullableNonEmptyStringSchema,
    message: z.string().nullable(),
    createdAt: IsoDateTimeStringSchema
  })
  .strict();

export const PushReceiptCreateResponseSchema = z
  .object({
    recorded: z.literal(true)
  })
  .strict();

export const PushReceiptLatestResponseSchema = z
  .object({
    latest: PushReceiptSchema.nullable(),
    count: NonNegativeIntSchema
  })
  .strict();

export const PushSendSummarySchema = z
  .object({
    notificationId: NonEmptyStringSchema,
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    sentAt: IsoDateTimeStringSchema,
    attempted: NonNegativeIntSchema,
    delivered: NonNegativeIntSchema,
    failures: NonNegativeIntSchema
  })
  .strict();

export const PushSendLatestResponseSchema = z
  .object({
    latest: PushSendSummarySchema.nullable()
  })
  .strict();

export const PushSendStoreSchema = z
  .object({
    version: NonNegativeIntSchema,
    latest: PushSendSummarySchema.nullable()
  })
  .strict()
  .superRefine(createPushStoreVersionRefinement(PushStoreVersion.send, PushStoreVersionLabel.send));

export const PushReceiptStoreSchema = z
  .object({
    version: NonNegativeIntSchema,
    receipts: z.array(PushReceiptSchema)
  })
  .strict()
  .superRefine(
    createPushStoreVersionRefinement(PushStoreVersion.receipt, PushStoreVersionLabel.receipt)
  );

const LegacyPushReceiptStoreSchema = z
  .object({
    version: z.literal(PushStoreVersion.legacyReceipt),
    receipts: z.array(LegacyPushReceiptSchema)
  })
  .strict();

export const PushLocalCaStatusResponseSchema = z
  .object({
    available: z.boolean(),
    downloadPath: NullableNonEmptyStringSchema
  })
  .strict();

export const VapidPublicKeyResponseSchema = z
  .object({
    publicKey: Base64UrlValueSchema
  })
  .strict();

export const PushStatusResponseSchema = z
  .object({
    enabled: z.boolean(),
    permissionRequired: z.boolean(),
    subscriptionCount: NonNegativeIntSchema,
    privateModeDefault: z.boolean()
  })
  .strict();

export const CreatePushSubscriptionResponseSchema = z
  .object({
    subscriptionId: NonEmptyStringSchema
  })
  .strict();

export const DeletePushSubscriptionResponseSchema = z
  .object({
    deleted: z.boolean()
  })
  .strict();

export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;
export type PushSettings = z.infer<typeof PushSettingsSchema>;
export type CreatePushSubscriptionBody = z.infer<typeof CreatePushSubscriptionBodySchema>;
export type DeletePushSubscriptionBody = z.infer<typeof DeletePushSubscriptionBodySchema>;
export type StoredPushSubscription = z.infer<typeof StoredPushSubscriptionSchema>;
export type CompletionWatermark = z.infer<typeof CompletionWatermarkSchema>;
export type PushStateStore = z.infer<typeof PushStateStoreSchema>;
export type DeclarativePushNotification = z.infer<typeof DeclarativePushNotificationSchema>;
export type DeclarativeWebPush = z.infer<typeof DeclarativeWebPushSchema>;
export type PushNotificationPayload = z.infer<typeof PushNotificationPayloadSchema>;
export type PushReceiptEvent = z.infer<typeof PushReceiptEventSchema>;
export type CreatePushReceiptBody = z.infer<typeof CreatePushReceiptBodySchema>;
export type PushReceipt = z.infer<typeof PushReceiptSchema>;
export type PushReceiptCreateResponse = z.infer<typeof PushReceiptCreateResponseSchema>;
export type PushReceiptLatestResponse = z.infer<typeof PushReceiptLatestResponseSchema>;
export type PushSendSummary = z.infer<typeof PushSendSummarySchema>;
export type PushSendLatestResponse = z.infer<typeof PushSendLatestResponseSchema>;
export type PushSendStore = z.infer<typeof PushSendStoreSchema>;
export type PushReceiptStore = z.infer<typeof PushReceiptStoreSchema>;
export type PushLocalCaStatusResponse = z.infer<typeof PushLocalCaStatusResponseSchema>;
export type PushStatusResponse = z.infer<typeof PushStatusResponseSchema>;
export type CreatePushSubscriptionResponse = z.infer<typeof CreatePushSubscriptionResponseSchema>;
export type DeletePushSubscriptionResponse = z.infer<typeof DeletePushSubscriptionResponseSchema>;
export type VapidPublicKeyResponse = z.infer<typeof VapidPublicKeyResponseSchema>;

const ParseContext = {
  createPushSubscriptionBody: "CreatePushSubscriptionBody",
  deletePushSubscriptionBody: "DeletePushSubscriptionBody",
  pushStateStore: "PushStateStore",
  pushNotificationPayload: "PushNotificationPayload",
  createPushReceiptBody: "CreatePushReceiptBody",
  pushSendLatestResponse: "PushSendLatestResponse",
  pushSendStore: "PushSendStore",
  pushReceiptStore: "PushReceiptStore",
  pushLocalCaStatusResponse: "PushLocalCaStatusResponse",
  vapidPublicKeyResponse: "VapidPublicKeyResponse"
} as const;

export function parseCreatePushSubscriptionBody(
  value: z.input<typeof CreatePushSubscriptionBodySchema>
): CreatePushSubscriptionBody {
  return parseSchemaOrThrow(
    CreatePushSubscriptionBodySchema,
    value,
    ParseContext.createPushSubscriptionBody
  );
}

export function parseDeletePushSubscriptionBody(
  value: z.input<typeof DeletePushSubscriptionBodySchema>
): DeletePushSubscriptionBody {
  return parseSchemaOrThrow(
    DeletePushSubscriptionBodySchema,
    value,
    ParseContext.deletePushSubscriptionBody
  );
}

export function parsePushStateStore(value: z.input<typeof PushStateStoreSchema>): PushStateStore {
  return parseSchemaOrThrow(PushStateStoreSchema, value, ParseContext.pushStateStore);
}

export function parsePushNotificationPayload(
  value: z.input<typeof PushNotificationPayloadSchema>
): PushNotificationPayload {
  return parseSchemaOrThrow(
    PushNotificationPayloadSchema,
    value,
    ParseContext.pushNotificationPayload
  );
}

export function parseCreatePushReceiptBody(
  value: z.input<typeof CreatePushReceiptBodySchema>
): CreatePushReceiptBody {
  return parseSchemaOrThrow(
    CreatePushReceiptBodySchema,
    value,
    ParseContext.createPushReceiptBody
  );
}

export function parsePushSendLatestResponse(
  value: z.input<typeof PushSendLatestResponseSchema>
): PushSendLatestResponse {
  return parseSchemaOrThrow(
    PushSendLatestResponseSchema,
    value,
    ParseContext.pushSendLatestResponse
  );
}

export function parsePushSendStore(value: z.input<typeof PushSendStoreSchema>): PushSendStore {
  return parseSchemaOrThrow(PushSendStoreSchema, value, ParseContext.pushSendStore);
}

export function parsePushReceiptStore(
  value: z.input<typeof PushReceiptStoreSchema>
): PushReceiptStore {
  const currentResult = PushReceiptStoreSchema.safeParse(value);
  if (currentResult.success) {
    return currentResult.data;
  }

  const legacyResult = LegacyPushReceiptStoreSchema.safeParse(value);
  if (legacyResult.success) {
    return {
      version: PushStoreVersion.receipt,
      receipts: legacyResult.data.receipts.map((receipt, index) => ({
        notificationId: buildLegacyPushReceiptNotificationIdentifier(index, receipt.createdAt),
        event: receipt.event,
        url: receipt.url,
        threadId: receipt.threadId,
        turnId: receipt.turnId,
        message: receipt.message,
        createdAt: receipt.createdAt
      }))
    };
  }

  throw ProtocolValidationError.fromZod(ParseContext.pushReceiptStore, currentResult.error);
}

export function parsePushLocalCaStatusResponse(
  value: z.input<typeof PushLocalCaStatusResponseSchema>
): PushLocalCaStatusResponse {
  return parseSchemaOrThrow(
    PushLocalCaStatusResponseSchema,
    value,
    ParseContext.pushLocalCaStatusResponse
  );
}

export function parseVapidPublicKeyResponse(
  value: z.input<typeof VapidPublicKeyResponseSchema>
): VapidPublicKeyResponse {
  return parseSchemaOrThrow(
    VapidPublicKeyResponseSchema,
    value,
    ParseContext.vapidPublicKeyResponse
  );
}
