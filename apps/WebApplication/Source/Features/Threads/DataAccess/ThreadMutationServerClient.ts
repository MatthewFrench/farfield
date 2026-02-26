import { z } from "zod";
import {
  archiveThread,
  createThread,
  type ApiCreateThreadInput,
  type ApiCreateThreadResponse,
  unarchiveThread
} from "./ThreadApi";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

export type ThreadMutationCreateThreadInput = ApiCreateThreadInput;
export type ThreadMutationCreateThreadResponse = ApiCreateThreadResponse;

const ThreadIdentifierSchema = z.string().trim().min(1);
const INVALID_THREAD_IDENTIFIER_MESSAGE =
  "ThreadMutationServerClient requires threadId to be a non-empty string";

/**
 * Owns thread mutation endpoints.
 * Mutation orchestration, selection updates, and cache invalidation policy remain in state-management owners.
 */
export class ThreadMutationServerClient {
  public async createThread(
    input?: ThreadMutationCreateThreadInput,
    options?: ApiRequestOptions
  ): Promise<ThreadMutationCreateThreadResponse> {
    return createThread(input, options);
  }

  public async archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
    return archiveThread(readThreadIdentifier(threadId), options);
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
