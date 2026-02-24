import type { ThreadMutationCreateThreadInput } from "../DataAccess/ThreadMutationServerClient";
import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";

export interface ThreadMutationActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export interface ThreadMutationActionErrorReportInput {
  operation: string;
  actionId: string;
  threadId: string | null;
  error: Error | string | number | boolean | bigint | symbol | null | undefined | object;
  details?: Record<string, string | number | boolean | null>;
}

export interface ThreadMutationActionClient {
  createThread(
    input?: ThreadMutationCreateThreadInput,
    options?: ApiRequestOptions
  ): Promise<{ threadId: string }>;
  archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void>;
  unarchiveThread(threadId: string, options?: ApiRequestOptions): Promise<void>;
}

export interface CreateThreadActionInput {
  projectPath: string;
  agentId?: AgentId;
  buildActionRequestOptions: (actionName: string) => ThreadMutationActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  onSetErrorMessage: (errorMessage: string) => void;
  onMarkThreadPendingMaterialization: (threadId: string) => void;
  onThreadSelected: (threadId: string) => void;
  onSetMobileSidebarOpen: (isOpen: boolean) => void;
  onInvalidateActiveThreadQuery: () => void;
  threadMutationClient: ThreadMutationActionClient;
  onRefreshCreatedThreadData: (threadId: string) => Promise<void>;
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
}

interface ComputeNextSelectedThreadIdentifierInput {
  selectedThreadId: string | null;
  archivedThreadId: string;
  activeThreadIdentifiersInOrder: string[];
}

export interface ArchiveThreadActionInput {
  threadId: string;
  selectedThreadId: string | null;
  activeThreadIdentifiersInOrder: string[];
  buildActionRequestOptions: (actionName: string) => ThreadMutationActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  onThreadSelected: (threadId: string | null) => void;
  onInvalidateActiveThreadQuery: () => void;
  onInvalidateArchivedThreadQuery: () => void;
  loadCoreData: () => Promise<void>;
  threadMutationClient: ThreadMutationActionClient;
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
}

export interface UnarchiveThreadActionInput {
  threadId: string;
  buildActionRequestOptions: (actionName: string) => ThreadMutationActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  onThreadSelected: (threadId: string) => void;
  onSetMobileSidebarOpen: (isOpen: boolean) => void;
  onInvalidateActiveThreadQuery: () => void;
  onInvalidateArchivedThreadQuery: () => void;
  loadCoreData: () => Promise<void>;
  threadMutationClient: ThreadMutationActionClient;
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
}

export class ThreadMutationActionCoordinator {
  public async createThread(input: CreateThreadActionInput): Promise<void> {
    const trimmedProjectPath = input.projectPath.trim();
    if (!trimmedProjectPath) {
      input.onSetErrorMessage("Cannot create thread: missing project path");
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions("create-thread");
    input.onSetBusy(true);
    try {
      const created = await input.threadMutationClient.createThread({
        cwd: trimmedProjectPath,
        ...(input.agentId ? { agentId: input.agentId } : {})
      }, requestOptions);
      input.onMarkThreadPendingMaterialization(created.threadId);
      input.onThreadSelected(created.threadId);
      input.onSetMobileSidebarOpen(false);
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshCreatedThreadData(created.threadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: "create-thread",
        actionId,
        threadId: null,
        error: toErrorMessage(error),
        details: {
          projectPath: trimmedProjectPath
        }
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async archiveThread(input: ArchiveThreadActionInput): Promise<void> {
    const { actionId, requestOptions } = input.buildActionRequestOptions("archive-thread");
    input.onSetBusy(true);
    try {
      const nextSelectedThreadIdentifier = this.computeNextSelectedThreadIdentifier({
        selectedThreadId: input.selectedThreadId,
        archivedThreadId: input.threadId,
        activeThreadIdentifiersInOrder: input.activeThreadIdentifiersInOrder
      });
      await input.threadMutationClient.archiveThread(input.threadId, requestOptions);
      input.onThreadSelected(nextSelectedThreadIdentifier);
      input.onInvalidateActiveThreadQuery();
      input.onInvalidateArchivedThreadQuery();
      await input.loadCoreData();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: "archive-thread",
        actionId,
        threadId: input.threadId,
        error: toErrorMessage(error)
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async unarchiveThread(input: UnarchiveThreadActionInput): Promise<void> {
    const { actionId, requestOptions } = input.buildActionRequestOptions("unarchive-thread");
    input.onSetBusy(true);
    try {
      await input.threadMutationClient.unarchiveThread(input.threadId, requestOptions);
      input.onThreadSelected(input.threadId);
      input.onSetMobileSidebarOpen(false);
      input.onInvalidateActiveThreadQuery();
      input.onInvalidateArchivedThreadQuery();
      await input.loadCoreData();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: "unarchive-thread",
        actionId,
        threadId: input.threadId,
        error: toErrorMessage(error)
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  private computeNextSelectedThreadIdentifier(
    input: ComputeNextSelectedThreadIdentifierInput
  ): string | null {
    if (input.selectedThreadId !== input.archivedThreadId) {
      return input.selectedThreadId;
    }
    return input.activeThreadIdentifiersInOrder.find(
      (threadIdentifier) => threadIdentifier !== input.archivedThreadId
    ) ?? null;
  }
}
