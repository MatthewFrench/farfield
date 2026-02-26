import { startTransition, type Dispatch, type SetStateAction } from "react";
import {
  ThreadListStateController
} from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { CoreDataThreadsResponse } from "./CoreDataSnapshotContracts";

const THREAD_LIST_UPDATED_AT_SORT_KEY = "updated_at" as const;

type ThreadsResponse = CoreDataThreadsResponse;

export interface ArchivedThreadLoaderDependencies {
  threadListStateController: ThreadListStateController;
  threadListLimit: number;
  archivedThreadListMaxPages: number;
  setIsArchivedThreadsLoading: Dispatch<SetStateAction<boolean>>;
  setArchivedThreads: Dispatch<SetStateAction<ThreadsResponse["data"]>>;
  setArchivedThreadsTruncated: Dispatch<SetStateAction<boolean>>;
  setHasLoadedArchivedThreads: Dispatch<SetStateAction<boolean>>;
  handleRuntimeRequestError: <ErrorType,>(error: ErrorType) => void;
}

/**
 * Owns archived-thread list hydration for the application shell.
 */
export class ArchivedThreadLoader {
  private deps: ArchivedThreadLoaderDependencies;

  public constructor(dependencies: ArchivedThreadLoaderDependencies) {
    this.deps = dependencies;
  }

  public updateDependencies(dependencies: ArchivedThreadLoaderDependencies): void {
    this.deps = dependencies;
  }

  public async loadArchivedThreads(): Promise<void> {
    this.deps.setIsArchivedThreadsLoading(true);
    try {
      const archivedState = await this.deps.threadListStateController.loadArchivedThreadState({
        limit: this.deps.threadListLimit,
        maxPages: this.deps.archivedThreadListMaxPages,
        sortKey: THREAD_LIST_UPDATED_AT_SORT_KEY,
        readFromCache: true
      });

      startTransition(() => {
        if (archivedState.didChangeArchivedThreads) {
          this.deps.setArchivedThreads(archivedState.nextArchivedThreads);
        }
        this.deps.setArchivedThreadsTruncated(archivedState.isTruncated);
        this.deps.setHasLoadedArchivedThreads(true);
      });
    } catch (error) {
      this.deps.handleRuntimeRequestError(error);
    } finally {
      this.deps.setIsArchivedThreadsLoading(false);
    }
  }
}
