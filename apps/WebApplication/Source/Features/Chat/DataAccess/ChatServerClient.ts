import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  type ApiInterruptThreadInput,
  type ApiLiveStateResponse,
  type ApiReadStreamEventsOptions,
  type ApiReadThreadOptions,
  type ApiReadThreadResponse,
  type ApiSendMessageInput,
  type ApiSetCollaborationModeInput,
  type ApiStreamEventsResponse,
  type ApiSubmitUserInputInput,
  type ApiUnsubscribeThreadStatus,
  getLiveState,
  getStreamEvents,
  interruptThread,
  readThread,
  sendMessage,
  setCollaborationMode,
  submitUserInput,
  unsubscribeThread,
} from "./ChatApi";

export type ChatReadThreadOptions = ApiReadThreadOptions;
export type ChatReadStreamEventsOptions = ApiReadStreamEventsOptions;
export type ChatReadThreadResponse = ApiReadThreadResponse;
export type ChatLiveStateResponse = ApiLiveStateResponse;
export type ChatStreamEventsResponse = ApiStreamEventsResponse;
export type ChatSendMessageInput = ApiSendMessageInput;
export type ChatSetCollaborationModeInput = ApiSetCollaborationModeInput;
export type ChatSubmitUserInputInput = ApiSubmitUserInputInput;
export type ChatInterruptThreadInput = ApiInterruptThreadInput;
export type ChatUnsubscribeThreadStatus = ApiUnsubscribeThreadStatus;

/**
 * Owns chat endpoint calls.
 * Concurrency, retry, and snapshot-merge policy are handled by state coordinators.
 */
export class ChatServerClient {
  public async readThread(
    threadId: string,
    options?: ChatReadThreadOptions,
  ): Promise<ChatReadThreadResponse> {
    return readThread(threadId, options);
  }

  public async readLiveState(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<ChatLiveStateResponse> {
    return getLiveState(threadId, options);
  }

  public async readStreamEvents(
    threadId: string,
    options?: ChatReadStreamEventsOptions,
  ): Promise<ChatStreamEventsResponse> {
    return getStreamEvents(threadId, options);
  }

  public async sendMessage(
    input: ChatSendMessageInput,
    options?: ApiRequestOptions,
  ): Promise<void> {
    return sendMessage(input, options);
  }

  public async setCollaborationMode(
    input: ChatSetCollaborationModeInput,
    options?: ApiRequestOptions,
  ): Promise<void> {
    return setCollaborationMode(input, options);
  }

  public async submitUserInput(
    input: ChatSubmitUserInputInput,
    options?: ApiRequestOptions,
  ): Promise<void> {
    return submitUserInput(input, options);
  }

  public async interruptThread(
    input: ChatInterruptThreadInput,
    options?: ApiRequestOptions,
  ): Promise<void> {
    return interruptThread(input, options);
  }

  public async unsubscribeThread(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<ChatUnsubscribeThreadStatus> {
    return unsubscribeThread(threadId, options);
  }
}
