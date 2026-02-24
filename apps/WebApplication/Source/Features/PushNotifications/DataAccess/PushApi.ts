import {
  CreatePushSubscriptionBodySchema,
  CreatePushSubscriptionResponseSchema,
  DeletePushSubscriptionBodySchema,
  DeletePushSubscriptionResponseSchema,
  FarfieldCreatePushSubscriptionEnvelopeSchema,
  FarfieldDeletePushSubscriptionEnvelopeSchema,
  FarfieldPushLocalCaStatusEnvelopeSchema,
  FarfieldPushReceiptLatestEnvelopeSchema,
  FarfieldPushSendLatestEnvelopeSchema,
  FarfieldPushStatusEnvelopeSchema,
  FarfieldPushTestEnvelopeSchema,
  FarfieldPushVapidPublicKeyEnvelopeSchema
} from "@farfield/protocol";
import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  applyRequestOptions,
  request,
  requestInitWithOptions
} from "@/Shared/Transport/FarfieldHttpTransport";

const PushStatusEnvelopeSchema = FarfieldPushStatusEnvelopeSchema;
export type ApiPushStatusResponse = z.infer<typeof PushStatusEnvelopeSchema>;

const PushVapidPublicKeyEnvelopeSchema = FarfieldPushVapidPublicKeyEnvelopeSchema;
export type ApiPushVapidPublicKeyResponse = z.infer<typeof PushVapidPublicKeyEnvelopeSchema>;

const PushReceiptLatestEnvelopeSchema = FarfieldPushReceiptLatestEnvelopeSchema;
export type ApiPushReceiptLatestResponse = z.infer<typeof PushReceiptLatestEnvelopeSchema>;

const PushSendLatestEnvelopeSchema = FarfieldPushSendLatestEnvelopeSchema;
export type ApiPushSendLatestResponse = z.infer<typeof PushSendLatestEnvelopeSchema>;

const PushLocalCaStatusEnvelopeSchema = FarfieldPushLocalCaStatusEnvelopeSchema;
export type ApiPushLocalCaStatusResponse = z.infer<typeof PushLocalCaStatusEnvelopeSchema>;

const PushTestResponseSchema = FarfieldPushTestEnvelopeSchema;
export type ApiPushTestResponse = z.infer<typeof PushTestResponseSchema>;

export type ApiCreatePushSubscriptionInput = z.infer<typeof CreatePushSubscriptionBodySchema>;
export type ApiCreatePushSubscriptionResponse = z.infer<typeof CreatePushSubscriptionResponseSchema>;
export type ApiDeletePushSubscriptionInput = z.infer<typeof DeletePushSubscriptionBodySchema>;
export type ApiDeletePushSubscriptionResponse = z.infer<typeof DeletePushSubscriptionResponseSchema>;

export interface ApiPushTestNotificationInput {
  threadId: string;
  turnId: string;
  title?: string;
  body?: string;
  dryRun?: boolean;
}

export async function getPushStatus(options?: ApiRequestOptions): Promise<ApiPushStatusResponse> {
  const data = await request("/api/push/status", requestInitWithOptions(options));
  return PushStatusEnvelopeSchema.parse(data);
}

export async function getPushVapidPublicKey(
  options?: ApiRequestOptions
): Promise<ApiPushVapidPublicKeyResponse> {
  const data = await request("/api/push/vapid-public-key", requestInitWithOptions(options));
  return PushVapidPublicKeyEnvelopeSchema.parse(data);
}

export async function getLatestPushReceipt(
  options?: ApiRequestOptions
): Promise<ApiPushReceiptLatestResponse> {
  const data = await request("/api/push/receipts/latest", requestInitWithOptions(options));
  return PushReceiptLatestEnvelopeSchema.parse(data);
}

export async function getLatestPushSend(options?: ApiRequestOptions): Promise<ApiPushSendLatestResponse> {
  const data = await request("/api/push/sends/latest", requestInitWithOptions(options));
  return PushSendLatestEnvelopeSchema.parse(data);
}

export async function getPushLocalCaStatus(
  options?: ApiRequestOptions
): Promise<ApiPushLocalCaStatusResponse> {
  const data = await request("/api/push/local-ca", requestInitWithOptions(options));
  return PushLocalCaStatusEnvelopeSchema.parse(data);
}

export async function savePushSubscription(
  input: ApiCreatePushSubscriptionInput,
  options?: ApiRequestOptions
): Promise<ApiCreatePushSubscriptionResponse> {
  const body = CreatePushSubscriptionBodySchema.parse(input);
  const data = await request(
    "/api/push/subscriptions",
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
  const parsed = FarfieldCreatePushSubscriptionEnvelopeSchema.parse(data);
  return {
    subscriptionId: parsed.subscriptionId
  };
}

export async function deletePushSubscription(
  input: ApiDeletePushSubscriptionInput,
  options?: ApiRequestOptions
): Promise<ApiDeletePushSubscriptionResponse> {
  const body = DeletePushSubscriptionBodySchema.parse(input);
  const data = await request(
    "/api/push/subscriptions",
    applyRequestOptions(
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      options
    )
  );
  const parsed = FarfieldDeletePushSubscriptionEnvelopeSchema.parse(data);
  return {
    deleted: parsed.deleted
  };
}

export async function sendPushTestNotification(
  input: ApiPushTestNotificationInput,
  options?: ApiRequestOptions
): Promise<ApiPushTestResponse> {
  const data = await request(
    "/api/push/test",
    applyRequestOptions(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      },
      options
    )
  );
  return PushTestResponseSchema.parse(data);
}
