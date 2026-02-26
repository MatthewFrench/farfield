import { z } from "zod";
import { NonEmptyStringSchema, NonNegativeIntSchema } from "./Common.js";
import { ProtocolValidationError } from "./Errors.js";
import { parseSchemaOrThrow } from "./ProtocolSchemaParsers.js";

const PushStateStoreVersion = 1;
const PushSendStoreVersion = 1;
const PushReceiptStoreVersion = 2;
const LegacyPushReceiptStoreVersion = 1;
const LegacyPushReceiptNotificationIdentifierPrefix = "legacy";

const Base64UrlValueSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, "Expected base64url value");

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
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
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
  .superRefine((state, ctx) => {
    if (state.version !== PushStateStoreVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported push state version: ${String(state.version)}`
      });
    }
  });

export const DeclarativePushNotificationSchema = z
  .object({
    title: NonEmptyStringSchema,
    body: z.string().optional(),
    navigate: z.string().min(1).optional(),
    icon: z.string().min(1).optional(),
    badge: z.string().min(1).optional(),
    tag: z.string().min(1).optional()
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
    url: z.string().min(1),
    createdAt: z.string().datetime(),
    web_push: DeclarativeWebPushSchema.optional()
  })
  .strict();

export const PushReceiptEventSchema = z.enum(["shown", "clicked", "error"]);

export const CreatePushReceiptBodySchema = z
  .object({
    notificationId: NonEmptyStringSchema,
    event: PushReceiptEventSchema,
    url: z.string().min(1),
    threadId: NonEmptyStringSchema.nullable().optional(),
    turnId: NonEmptyStringSchema.nullable().optional(),
    message: z.string().max(500).optional(),
    createdAt: z.string().datetime()
  })
  .strict();

export const PushReceiptSchema = z
  .object({
    notificationId: NonEmptyStringSchema,
    event: PushReceiptEventSchema,
    url: z.string().min(1),
    threadId: NonEmptyStringSchema.nullable(),
    turnId: NonEmptyStringSchema.nullable(),
    message: z.string().nullable(),
    createdAt: z.string().datetime()
  })
  .strict();

const LegacyPushReceiptSchema = z
  .object({
    event: PushReceiptEventSchema,
    url: z.string().min(1),
    threadId: NonEmptyStringSchema.nullable(),
    turnId: NonEmptyStringSchema.nullable(),
    message: z.string().nullable(),
    createdAt: z.string().datetime()
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
    sentAt: z.string().datetime(),
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
  .superRefine((state, ctx) => {
    if (state.version !== PushSendStoreVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported push send store version: ${String(state.version)}`
      });
    }
  });

export const PushReceiptStoreSchema = z
  .object({
    version: NonNegativeIntSchema,
    receipts: z.array(PushReceiptSchema)
  })
  .strict()
  .superRefine((state, ctx) => {
    if (state.version !== PushReceiptStoreVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported push receipt store version: ${String(state.version)}`
      });
    }
  });

const LegacyPushReceiptStoreSchema = z
  .object({
    version: z.literal(LegacyPushReceiptStoreVersion),
    receipts: z.array(LegacyPushReceiptSchema)
  })
  .strict();

export const PushLocalCaStatusResponseSchema = z
  .object({
    available: z.boolean(),
    downloadPath: z.string().min(1).nullable()
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
      version: PushReceiptStoreVersion,
      receipts: legacyResult.data.receipts.map((receipt, index) => ({
        notificationId:
          `${LegacyPushReceiptNotificationIdentifierPrefix}-${index + 1}-${receipt.createdAt}`,
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
