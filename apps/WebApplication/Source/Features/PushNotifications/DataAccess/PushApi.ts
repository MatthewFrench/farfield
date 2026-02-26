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
const PUSH_ROUTE_PATH = "/api/push";
const PUSH_STATUS_ROUTE_SEGMENT = "status";
const PUSH_VAPID_PUBLIC_KEY_ROUTE_SEGMENT = "vapid-public-key";
const PUSH_RECEIPT_LATEST_ROUTE_SEGMENT = "receipts/latest";
const PUSH_SEND_LATEST_ROUTE_SEGMENT = "sends/latest";
const PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_ROUTE_SEGMENT = "local-ca";
const PUSH_SUBSCRIPTIONS_ROUTE_SEGMENT = "subscriptions";
const PUSH_TEST_ROUTE_SEGMENT = "test";
const REQUEST_METHOD_POST = "POST";
const REQUEST_METHOD_DELETE = "DELETE";
const REQUEST_CONTENT_TYPE_HEADER_NAME = "Content-Type";
const REQUEST_CONTENT_TYPE_HEADER_VALUE = "application/json";
const NON_EMPTY_TRIMMED_TEXT_MIN_LENGTH = 1;

type PushRouteSegment =
  | typeof PUSH_STATUS_ROUTE_SEGMENT
  | typeof PUSH_VAPID_PUBLIC_KEY_ROUTE_SEGMENT
  | typeof PUSH_RECEIPT_LATEST_ROUTE_SEGMENT
  | typeof PUSH_SEND_LATEST_ROUTE_SEGMENT
  | typeof PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_ROUTE_SEGMENT
  | typeof PUSH_SUBSCRIPTIONS_ROUTE_SEGMENT
  | typeof PUSH_TEST_ROUTE_SEGMENT;
type PushMutationRequestMethod = typeof REQUEST_METHOD_POST | typeof REQUEST_METHOD_DELETE;

const APPLICATION_JSON_REQUEST_HEADERS = {
  [REQUEST_CONTENT_TYPE_HEADER_NAME]: REQUEST_CONTENT_TYPE_HEADER_VALUE
};
const PUSH_STATUS_ENDPOINT = buildPushRoutePath(PUSH_STATUS_ROUTE_SEGMENT);
const PUSH_VAPID_PUBLIC_KEY_ENDPOINT = buildPushRoutePath(PUSH_VAPID_PUBLIC_KEY_ROUTE_SEGMENT);
const PUSH_RECEIPT_LATEST_ENDPOINT = buildPushRoutePath(PUSH_RECEIPT_LATEST_ROUTE_SEGMENT);
const PUSH_SEND_LATEST_ENDPOINT = buildPushRoutePath(PUSH_SEND_LATEST_ROUTE_SEGMENT);
const PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_ENDPOINT = buildPushRoutePath(
  PUSH_LOCAL_CERTIFICATE_AUTHORITY_STATUS_ROUTE_SEGMENT
);
const PUSH_SUBSCRIPTIONS_ENDPOINT = buildPushRoutePath(PUSH_SUBSCRIPTIONS_ROUTE_SEGMENT);
const PUSH_TEST_ENDPOINT = buildPushRoutePath(PUSH_TEST_ROUTE_SEGMENT);

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
    threadId: z.string().trim().min(NON_EMPTY_TRIMMED_TEXT_MIN_LENGTH),
    turnId: z.string().trim().min(NON_EMPTY_TRIMMED_TEXT_MIN_LENGTH),
    title: z.string().optional(),
    body: z.string().optional(),
    dryRun: z.boolean().optional()
  })
  .strict();

function buildPushRoutePath(routeSegment: PushRouteSegment): string {
  return `${PUSH_ROUTE_PATH}/${routeSegment}`;
}

function buildPushJsonMutationRequestInit(
  method: PushMutationRequestMethod,
  body: string,
  options?: ApiRequestOptions
): RequestInit {
  return applyRequestOptions(
    {
      method,
      headers: APPLICATION_JSON_REQUEST_HEADERS,
      body
    },
    options
  );
}

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
    buildPushJsonMutationRequestInit(REQUEST_METHOD_POST, JSON.stringify(body), options)
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
    buildPushJsonMutationRequestInit(REQUEST_METHOD_DELETE, JSON.stringify(body), options)
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
    buildPushJsonMutationRequestInit(REQUEST_METHOD_POST, JSON.stringify(body), options)
  );
  return PushTestNotificationResponseSchema.parse(data);
}
