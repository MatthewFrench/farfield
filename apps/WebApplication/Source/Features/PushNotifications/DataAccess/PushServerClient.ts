import {
  type ApiCreatePushSubscriptionInput,
  type ApiCreatePushSubscriptionResponse,
  type ApiDeletePushSubscriptionInput,
  type ApiDeletePushSubscriptionResponse,
  type ApiPushLocalCaStatusResponse,
  type ApiPushReceiptLatestResponse,
  type ApiPushSendLatestResponse,
  type ApiPushStatusResponse,
  type ApiPushTestNotificationInput,
  type ApiPushTestResponse,
  type ApiPushVapidPublicKeyResponse,
  deletePushSubscription,
  getLatestPushReceipt,
  getLatestPushSend,
  getPushLocalCaStatus,
  getPushStatus,
  getPushVapidPublicKey,
  savePushSubscription,
  sendPushTestNotification
} from "./PushApi";
import { type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

/**
 * Owns push HTTP calls to the Farfield server.
 * Browser subscription lifecycle is managed by `PushClientStateManager`.
 */
export class PushServerClient {
  public async readPushStatus(options?: ApiRequestOptions): Promise<ApiPushStatusResponse> {
    return getPushStatus(options);
  }

  public async readPushVapidPublicKey(
    options?: ApiRequestOptions
  ): Promise<ApiPushVapidPublicKeyResponse> {
    return getPushVapidPublicKey(options);
  }

  public async readLatestPushReceipt(
    options?: ApiRequestOptions
  ): Promise<ApiPushReceiptLatestResponse> {
    return getLatestPushReceipt(options);
  }

  public async readLatestPushSend(options?: ApiRequestOptions): Promise<ApiPushSendLatestResponse> {
    return getLatestPushSend(options);
  }

  public async readPushLocalCertificateAuthorityStatus(
    options?: ApiRequestOptions
  ): Promise<ApiPushLocalCaStatusResponse> {
    return getPushLocalCaStatus(options);
  }

  public async savePushSubscription(
    input: ApiCreatePushSubscriptionInput,
    options?: ApiRequestOptions
  ): Promise<ApiCreatePushSubscriptionResponse> {
    return savePushSubscription(input, options);
  }

  public async deletePushSubscription(
    input: ApiDeletePushSubscriptionInput,
    options?: ApiRequestOptions
  ): Promise<ApiDeletePushSubscriptionResponse> {
    return deletePushSubscription(input, options);
  }

  public async sendPushTestNotification(
    input: ApiPushTestNotificationInput,
    options?: ApiRequestOptions
  ): Promise<ApiPushTestResponse> {
    return sendPushTestNotification(input, options);
  }
}
