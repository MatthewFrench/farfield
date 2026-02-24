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
    return archiveThread(threadId, options);
  }

  public async unarchiveThread(threadId: string, options?: ApiRequestOptions): Promise<void> {
    return unarchiveThread(threadId, options);
  }
}
