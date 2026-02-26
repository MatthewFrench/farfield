import {
  CreatePushSubscriptionBodySchema,
  DeletePushSubscriptionBodySchema,
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

/**
 * Owns push HTTP boundary parsing and envelope normalization.
 * All transport envelopes are parsed once and mapped to push-owned response contracts before leaving this module.
 */
const JSON_CONTENT_TYPE_HEADERS = {
  "Content-Type": "application/json"
};
const PUSH_STATUS_ENDPOINT = "/api/push/status";
const PUSH_VAPID_PUBLIC_KEY_ENDPOINT = "/api/push/vapid-public-key";
const PUSH_RECEIPT_LATEST_ENDPOINT = "/api/push/receipts/latest";
const PUSH_SEND_LATEST_ENDPOINT = "/api/push/sends/latest";
const PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_ENDPOINT = "/api/push/local-ca";
const PUSH_SUBSCRIPTIONS_ENDPOINT = "/api/push/subscriptions";
const PUSH_TEST_ENDPOINT = "/api/push/test";

const PushStatusResponseSchema = FarfieldPushStatusEnvelopeSchema.transform(
  ({ ok: _ok, ...pushStatusResponse }) => pushStatusResponse
);
export type ApiPushStatusResponse = z.infer<typeof PushStatusResponseSchema>;

const PushVapidPublicKeyResponseSchema = FarfieldPushVapidPublicKeyEnvelopeSchema.transform(
  ({ ok: _ok, ...pushVapidPublicKeyResponse }) => pushVapidPublicKeyResponse
);
export type ApiPushVapidPublicKeyResponse = z.infer<typeof PushVapidPublicKeyResponseSchema>;

const PushReceiptLatestResponseSchema = FarfieldPushReceiptLatestEnvelopeSchema.transform(
  ({ ok: _ok, ...pushReceiptLatestResponse }) => pushReceiptLatestResponse
);
export type ApiPushReceiptLatestResponse = z.infer<typeof PushReceiptLatestResponseSchema>;

const PushSendLatestResponseSchema = FarfieldPushSendLatestEnvelopeSchema.transform(
  ({ ok: _ok, ...pushSendLatestResponse }) => pushSendLatestResponse
);
export type ApiPushSendLatestResponse = z.infer<typeof PushSendLatestResponseSchema>;

const PushLocalCertificateAuthorityStatusResponseSchema =
  FarfieldPushLocalCaStatusEnvelopeSchema.transform(
    ({ ok: _ok, ...pushLocalCertificateAuthorityStatusResponse }) =>
      pushLocalCertificateAuthorityStatusResponse
  );
export type ApiPushLocalCaStatusResponse = z.infer<
  typeof PushLocalCertificateAuthorityStatusResponseSchema
>;

const CreatePushSubscriptionResponseSchema = FarfieldCreatePushSubscriptionEnvelopeSchema.transform(
  ({ ok: _ok, ...createPushSubscriptionResponse }) => createPushSubscriptionResponse
);
const DeletePushSubscriptionResponseSchema = FarfieldDeletePushSubscriptionEnvelopeSchema.transform(
  ({ ok: _ok, ...deletePushSubscriptionResponse }) => deletePushSubscriptionResponse
);
const PushTestNotificationResponseSchema = FarfieldPushTestEnvelopeSchema.transform(
  ({ ok: _ok, ...pushTestNotificationResponse }) => pushTestNotificationResponse
);

export type ApiCreatePushSubscriptionInput = z.infer<typeof CreatePushSubscriptionBodySchema>;
export type ApiCreatePushSubscriptionResponse = z.infer<typeof CreatePushSubscriptionResponseSchema>;
export type ApiDeletePushSubscriptionInput = z.infer<typeof DeletePushSubscriptionBodySchema>;
export type ApiDeletePushSubscriptionResponse = z.infer<typeof DeletePushSubscriptionResponseSchema>;
export type ApiPushTestResponse = z.infer<typeof PushTestNotificationResponseSchema>;

export interface ApiPushTestNotificationInput {
  threadId: string;
  turnId: string;
  title?: string;
  body?: string;
  dryRun?: boolean;
}

const PushTestNotificationInputSchema = z
  .object({
    threadId: z.string().trim().min(1),
    turnId: z.string().trim().min(1),
    title: z.string().optional(),
    body: z.string().optional(),
    dryRun: z.boolean().optional()
  })
  .strict();

export async function getPushStatus(options?: ApiRequestOptions): Promise<ApiPushStatusResponse> {
  const data = await request(PUSH_STATUS_ENDPOINT, requestInitWithOptions(options));
  return PushStatusResponseSchema.parse(data);
}

export async function getPushVapidPublicKey(
  options?: ApiRequestOptions
): Promise<ApiPushVapidPublicKeyResponse> {
  const data = await request(PUSH_VAPID_PUBLIC_KEY_ENDPOINT, requestInitWithOptions(options));
  return PushVapidPublicKeyResponseSchema.parse(data);
}

export async function getLatestPushReceipt(
  options?: ApiRequestOptions
): Promise<ApiPushReceiptLatestResponse> {
  const data = await request(PUSH_RECEIPT_LATEST_ENDPOINT, requestInitWithOptions(options));
  return PushReceiptLatestResponseSchema.parse(data);
}

export async function getLatestPushSend(options?: ApiRequestOptions): Promise<ApiPushSendLatestResponse> {
  const data = await request(PUSH_SEND_LATEST_ENDPOINT, requestInitWithOptions(options));
  return PushSendLatestResponseSchema.parse(data);
}

export async function getPushLocalCaStatus(
  options?: ApiRequestOptions
): Promise<ApiPushLocalCaStatusResponse> {
  const data = await request(
    PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_ENDPOINT,
    requestInitWithOptions(options)
  );
  return PushLocalCertificateAuthorityStatusResponseSchema.parse(data);
}

export async function savePushSubscription(
  input: ApiCreatePushSubscriptionInput,
  options?: ApiRequestOptions
): Promise<ApiCreatePushSubscriptionResponse> {
  const body = CreatePushSubscriptionBodySchema.parse(input);
  const data = await request(
    PUSH_SUBSCRIPTIONS_ENDPOINT,
    applyRequestOptions(
      {
        method: "POST",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify(body)
      },
      options
    )
  );
  return CreatePushSubscriptionResponseSchema.parse(data);
}

export async function deletePushSubscription(
  input: ApiDeletePushSubscriptionInput,
  options?: ApiRequestOptions
): Promise<ApiDeletePushSubscriptionResponse> {
  const body = DeletePushSubscriptionBodySchema.parse(input);
  const data = await request(
    PUSH_SUBSCRIPTIONS_ENDPOINT,
    applyRequestOptions(
      {
        method: "DELETE",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify(body)
      },
      options
    )
  );
  return DeletePushSubscriptionResponseSchema.parse(data);
}

export async function sendPushTestNotification(
  input: ApiPushTestNotificationInput,
  options?: ApiRequestOptions
): Promise<ApiPushTestResponse> {
  const body = PushTestNotificationInputSchema.parse(input);
  const data = await request(
    PUSH_TEST_ENDPOINT,
    applyRequestOptions(
      {
        method: "POST",
        headers: JSON_CONTENT_TYPE_HEADERS,
        body: JSON.stringify(body)
      },
      options
    )
  );
  return PushTestNotificationResponseSchema.parse(data);
}
