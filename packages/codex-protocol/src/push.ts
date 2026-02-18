import { z } from "zod";
import { NonEmptyStringSchema, NonNegativeIntSchema } from "./common.js";
import { ProtocolValidationError } from "./errors.js";

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
    if (state.version !== 1) {
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
    title: NonEmptyStringSchema,
    body: z.string(),
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    url: z.string().min(1),
    createdAt: z.string().datetime(),
    web_push: DeclarativeWebPushSchema.optional()
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
export type PushStatusResponse = z.infer<typeof PushStatusResponseSchema>;
export type CreatePushSubscriptionResponse = z.infer<typeof CreatePushSubscriptionResponseSchema>;
export type DeletePushSubscriptionResponse = z.infer<typeof DeletePushSubscriptionResponseSchema>;

export function parseCreatePushSubscriptionBody(value: z.input<typeof CreatePushSubscriptionBodySchema>): CreatePushSubscriptionBody {
  const result = CreatePushSubscriptionBodySchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("CreatePushSubscriptionBody", result.error);
  }
  return result.data;
}

export function parseDeletePushSubscriptionBody(value: z.input<typeof DeletePushSubscriptionBodySchema>): DeletePushSubscriptionBody {
  const result = DeletePushSubscriptionBodySchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("DeletePushSubscriptionBody", result.error);
  }
  return result.data;
}

export function parsePushStateStore(value: z.input<typeof PushStateStoreSchema>): PushStateStore {
  const result = PushStateStoreSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("PushStateStore", result.error);
  }
  return result.data;
}

export function parsePushNotificationPayload(value: z.input<typeof PushNotificationPayloadSchema>): PushNotificationPayload {
  const result = PushNotificationPayloadSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("PushNotificationPayload", result.error);
  }
  return result.data;
}

export function parseVapidPublicKeyResponse(value: z.input<typeof VapidPublicKeyResponseSchema>): z.infer<typeof VapidPublicKeyResponseSchema> {
  const result = VapidPublicKeyResponseSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("VapidPublicKeyResponse", result.error);
  }
  return result.data;
}
