import { z } from "zod";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import {
  type ApiCreateThreadInput,
  type ApiCreateThreadResponse,
  archiveThread,
  cleanThreadBackgroundTerminals,
  compactThread,
  createThread,
  forkThread,
  forkThreadFromMessage,
  rollbackThread,
  setThreadName,
  startThreadReview,
  unarchiveThread,
} from "./ThreadApi";

export type ThreadMutationCreateThreadInput = ApiCreateThreadInput;
export type ThreadMutationCreateThreadResponse = ApiCreateThreadResponse;
export type ThreadMutationForkThreadResponse = {
  threadId: string;
  sourceThreadId: string;
};
export type ThreadMutationForkThreadFromMessageResponse = {
  threadId: string;
  sourceThreadId: string;
  sourceMessageId: string;
};
export type ThreadMutationStartThreadReviewResponse = {
  reviewThreadId: string;
  reviewTurnId: string;
};

const ThreadIdentifierSchema = z.string().trim().min(1);
const MessageIdentifierSchema = z.string().trim().min(1);
const INVALID_THREAD_IDENTIFIER_MESSAGE =
  "ThreadMutationServerClient requires threadId to be a non-empty string";
const INVALID_MESSAGE_IDENTIFIER_MESSAGE =
  "ThreadMutationServerClient requires messageId to be a non-empty string";

/**
 * Owns thread mutation endpoints.
 * Mutation orchestration, selection updates, and cache invalidation policy remain in state-management owners.
 */
export class ThreadMutationServerClient {
  public async createThread(
    input?: ThreadMutationCreateThreadInput,
    options?: ApiRequestOptions,
  ): Promise<ThreadMutationCreateThreadResponse> {
    return createThread(input, options);
  }

  public async archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
    return archiveThread(readThreadIdentifier(threadId), options);
  }

  public async forkThread(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<ThreadMutationForkThreadResponse> {
    return forkThread(readThreadIdentifier(threadId), options);
  }

  public async forkThreadFromMessage(
    threadId: string,
    messageId: string,
    options?: ApiRequestOptions,
  ): Promise<ThreadMutationForkThreadFromMessageResponse> {
    return forkThreadFromMessage(
      {
        threadId: readThreadIdentifier(threadId),
        messageId: readMessageIdentifier(messageId),
      },
      options,
    );
  }

  public async setThreadName(
    threadId: string,
    name: string,
    options?: ApiRequestOptions,
  ): Promise<void> {
    return setThreadName(
      {
        threadId: readThreadIdentifier(threadId),
        name,
      },
      options,
    );
  }

  public async rollbackThread(
    threadId: string,
    numTurns: number,
    options?: ApiRequestOptions,
  ): Promise<void> {
    return rollbackThread(
      {
        threadId: readThreadIdentifier(threadId),
        numTurns,
      },
      options,
    );
  }

  public async compactThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
    return compactThread(readThreadIdentifier(threadId), options);
  }

  public async cleanThreadBackgroundTerminals(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<void> {
    return cleanThreadBackgroundTerminals(readThreadIdentifier(threadId), options);
  }

  public async startThreadReview(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<ThreadMutationStartThreadReviewResponse> {
    return startThreadReview(readThreadIdentifier(threadId), options);
  }

  public async unarchiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
    return unarchiveThread(readThreadIdentifier(threadId), options);
  }
}

function readThreadIdentifier(value: string): string {
  const parsedValue = ThreadIdentifierSchema.safeParse(value);
  if (!parsedValue.success) {
    throw new Error(INVALID_THREAD_IDENTIFIER_MESSAGE);
  }
  return parsedValue.data;
}

function readMessageIdentifier(value: string): string {
  const parsedValue = MessageIdentifierSchema.safeParse(value);
  if (!parsedValue.success) {
    throw new Error(INVALID_MESSAGE_IDENTIFIER_MESSAGE);
  }
  return parsedValue.data;
}
