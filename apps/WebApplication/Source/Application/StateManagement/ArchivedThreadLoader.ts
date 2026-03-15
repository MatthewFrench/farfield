import { type Dispatch, type SetStateAction, startTransition } from "react";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import type { CoreDataThreadsResponse } from "./CoreDataSnapshotContracts";

const THREAD_LIST_UPDATED_AT_SORT_KEY = "updated_at" as const;

type ThreadsResponse = CoreDataThreadsResponse;

export interface ArchivedThreadLoaderDependencies {
  threadListStateController: ThreadListStateController;
  threadListLimit: number;
  archivedThreadListMaxPages: number;
  buildActionRequestOptions: (actionName: string) => {
    actionId: string;
    requestOptions: ApiRequestOptions;
  };
  setIsArchivedThreadsLoading: Dispatch<SetStateAction<boolean>>;
  setArchivedThreads: Dispatch<SetStateAction<ThreadsResponse["data"]>>;
  setArchivedThreadsTruncated: Dispatch<SetStateAction<boolean>>;
  setHasLoadedArchivedThreads: Dispatch<SetStateAction<boolean>>;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

const ARCHIVED_THREAD_REVALIDATE_OPERATION = "runtime-refresh.threads.archived.revalidate";

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
      const archivedState = await this.readArchivedThreadState(true);
      this.applyArchivedThreadState(archivedState);
      this.deps.setIsArchivedThreadsLoading(false);
      if (!archivedState.loadedFromCache) {
        return;
      }
      const revalidatedArchivedState = await this.readArchivedThreadState(false);
      this.applyArchivedThreadState(revalidatedArchivedState);
    } catch (error) {
      this.deps.handleRuntimeRequestError(error);
    } finally {
      this.deps.setIsArchivedThreadsLoading(false);
    }
  }

  private async readArchivedThreadState(readFromCache: boolean) {
    return await this.deps.threadListStateController.loadArchivedThreadState({
      limit: this.deps.threadListLimit,
      maxPages: this.deps.archivedThreadListMaxPages,
      sortKey: THREAD_LIST_UPDATED_AT_SORT_KEY,
      readFromCache,
      ...(readFromCache ? {} : this.readArchivedThreadRevalidateActionMetadata()),
    });
  }

  private readArchivedThreadRevalidateActionMetadata(): {
    actionId: string;
    actionName?: string;
  } {
    const actionRequestOptions = this.deps.buildActionRequestOptions(
      ARCHIVED_THREAD_REVALIDATE_OPERATION,
    );
    const actionMetadata: {
      actionId: string;
      actionName?: string;
    } = {
      actionId: actionRequestOptions.actionId,
    };
    if (actionRequestOptions.requestOptions.actionName !== undefined) {
      actionMetadata.actionName = actionRequestOptions.requestOptions.actionName;
    }
    return actionMetadata;
  }

  private applyArchivedThreadState(archivedState: {
    didChangeArchivedThreads: boolean;
    nextArchivedThreads: ThreadsResponse["data"];
    isTruncated: boolean;
  }): void {
    startTransition(() => {
      if (archivedState.didChangeArchivedThreads) {
        this.deps.setArchivedThreads(archivedState.nextArchivedThreads);
      }
      this.deps.setArchivedThreadsTruncated(archivedState.isTruncated);
      this.deps.setHasLoadedArchivedThreads(true);
    });
  }
}
