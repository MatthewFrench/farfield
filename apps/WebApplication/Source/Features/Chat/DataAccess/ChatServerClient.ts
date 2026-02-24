import {
  type ApiInterruptThreadInput,
  type ApiLiveStateResponse,
  type ApiReadThreadOptions,
  type ApiReadThreadResponse,
  type ApiSendMessageInput,
  type ApiSetCollaborationModeInput,
  type ApiStreamEventsResponse,
  type ApiSubmitUserInputInput,
  getLiveState,
  getStreamEvents,
  interruptThread,
  readThread,
  sendMessage,
  setCollaborationMode,
  submitUserInput
} from "./ChatApi";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

export type ChatReadThreadOptions = ApiReadThreadOptions;
export type ChatReadThreadResponse = ApiReadThreadResponse;
export type ChatLiveStateResponse = ApiLiveStateResponse;
export type ChatStreamEventsResponse = ApiStreamEventsResponse;
export type ChatSendMessageInput = ApiSendMessageInput;
export type ChatSetCollaborationModeInput = ApiSetCollaborationModeInput;
export type ChatSubmitUserInputInput = ApiSubmitUserInputInput;
export type ChatInterruptThreadInput = ApiInterruptThreadInput;

export class ChatServerClient {
  public async readThread(threadId: string, options?: ApiReadThreadOptions): Promise<ApiReadThreadResponse> {
    return readThread(threadId, options);
  }

  public async readLiveState(threadId: string, options?: ApiRequestOptions): Promise<ApiLiveStateResponse> {
    return getLiveState(threadId, options);
  }

  public async readStreamEvents(
    threadId: string,
    options?: ApiRequestOptions
  ): Promise<ApiStreamEventsResponse> {
    return getStreamEvents(threadId, options);
  }

  public async sendMessage(input: ApiSendMessageInput, options?: ApiRequestOptions): Promise<void> {
    return sendMessage(input, options);
  }

  public async setCollaborationMode(
    input: ApiSetCollaborationModeInput,
    options?: ApiRequestOptions
  ): Promise<void> {
    return setCollaborationMode(input, options);
  }

  public async submitUserInput(
    input: ApiSubmitUserInputInput,
    options?: ApiRequestOptions
  ): Promise<void> {
    return submitUserInput(input, options);
  }

  public async interruptThread(
    input: ApiInterruptThreadInput,
    options?: ApiRequestOptions
  ): Promise<void> {
    return interruptThread(input, options);
  }
}
