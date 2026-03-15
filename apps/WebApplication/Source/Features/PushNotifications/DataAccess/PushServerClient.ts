import { type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
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
  sendPushTestNotification,
} from "./PushApi";

export type PushRequestOptions = ApiRequestOptions;
export type PushStatusResponse = ApiPushStatusResponse;
export type PushVapidPublicKeyResponse = ApiPushVapidPublicKeyResponse;
export type PushReceiptLatestResponse = ApiPushReceiptLatestResponse;
export type PushSendLatestResponse = ApiPushSendLatestResponse;
export type PushLocalCertificateAuthorityStatusResponse = ApiPushLocalCaStatusResponse;
export type PushCreateSubscriptionInput = ApiCreatePushSubscriptionInput;
export type PushCreateSubscriptionResponse = ApiCreatePushSubscriptionResponse;
export type PushDeleteSubscriptionInput = ApiDeletePushSubscriptionInput;
export type PushDeleteSubscriptionResponse = ApiDeletePushSubscriptionResponse;
export type PushTestNotificationInput = ApiPushTestNotificationInput;
export type PushTestResponse = ApiPushTestResponse;

/**
 * Owns push HTTP calls to the Farfield server.
 * Browser subscription lifecycle is managed by `PushClientStateManager`.
 */
export class PushServerClient {
  public async readPushStatus(options?: PushRequestOptions): Promise<PushStatusResponse> {
    return getPushStatus(options);
  }

  public async readPushVapidPublicKey(
    options?: PushRequestOptions,
  ): Promise<PushVapidPublicKeyResponse> {
    return getPushVapidPublicKey(options);
  }

  public async readLatestPushReceipt(
    options?: PushRequestOptions,
  ): Promise<PushReceiptLatestResponse> {
    return getLatestPushReceipt(options);
  }

  public async readLatestPushSend(options?: PushRequestOptions): Promise<PushSendLatestResponse> {
    return getLatestPushSend(options);
  }

  public async readPushLocalCertificateAuthorityStatus(
    options?: PushRequestOptions,
  ): Promise<PushLocalCertificateAuthorityStatusResponse> {
    return getPushLocalCaStatus(options);
  }

  public async savePushSubscription(
    input: PushCreateSubscriptionInput,
    options?: PushRequestOptions,
  ): Promise<PushCreateSubscriptionResponse> {
    return savePushSubscription(input, options);
  }

  public async deletePushSubscription(
    input: PushDeleteSubscriptionInput,
    options?: PushRequestOptions,
  ): Promise<PushDeleteSubscriptionResponse> {
    return deletePushSubscription(input, options);
  }

  public async sendPushTestNotification(
    input: PushTestNotificationInput,
    options?: PushRequestOptions,
  ): Promise<PushTestResponse> {
    return sendPushTestNotification(input, options);
  }
}
