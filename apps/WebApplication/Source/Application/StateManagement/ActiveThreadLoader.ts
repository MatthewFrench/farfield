import { type Dispatch, type MutableRefObject, type SetStateAction, startTransition } from "react";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { CoreDataThreadsResponse } from "./CoreDataSnapshotContracts";
import { applyActiveThreadSnapshot } from "./CoreDataSnapshotStateSectionAppliers";

const THREAD_LIST_UPDATED_AT_SORT_KEY = "updated_at" as const;

type ThreadsResponse = CoreDataThreadsResponse;

export interface ActiveThreadLoaderDependencies {
  threadListStateController: ThreadListStateController;
  threadListLimit: number;
  threadListMaxPages: number;
  selectedThreadIdRef: MutableRefObject<string | null>;
  unreadThreadIdsRef: MutableRefObject<Record<string, true>>;
  setThreads: Dispatch<SetStateAction<ThreadsResponse["data"]>>;
  setUnreadThreadIds: Dispatch<SetStateAction<Record<string, true>>>;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

export interface LoadActiveThreadsInput {
  readFromCache: boolean;
  actionId?: string;
  actionName?: string;
}

/**
 * Owns active-thread list-only hydration so mutation-driven sidebar refreshes can avoid the
 * broader deferred startup capability fan-out.
 */
export class ActiveThreadLoader {
  private deps: ActiveThreadLoaderDependencies;

  public constructor(dependencies: ActiveThreadLoaderDependencies) {
    this.deps = dependencies;
  }

  public updateDependencies(dependencies: ActiveThreadLoaderDependencies): void {
    this.deps = dependencies;
  }

  public async loadActiveThreads(input: LoadActiveThreadsInput): Promise<void> {
    try {
      const nextActiveThreadState = await this.deps.threadListStateController.loadActiveThreadState(
        {
          limit: this.deps.threadListLimit,
          maxPages: this.deps.threadListMaxPages,
          sortKey: THREAD_LIST_UPDATED_AT_SORT_KEY,
          previousUnreadThreadIdentifiers: this.deps.unreadThreadIdsRef.current,
          selectedThreadIdentifier: this.deps.selectedThreadIdRef.current,
          readFromCache: input.readFromCache,
          ...(input.actionId !== undefined ? { actionId: input.actionId } : {}),
          ...(input.actionName !== undefined ? { actionName: input.actionName } : {}),
        },
      );

      startTransition(() => {
        applyActiveThreadSnapshot({
          nextActiveThreadState,
          setThreads: this.deps.setThreads,
          setUnreadThreadIds: this.deps.setUnreadThreadIds,
        });
      });
    } catch (error) {
      this.deps.handleRuntimeRequestError(error);
    }
  }
}
