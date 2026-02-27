import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import type { ThreadMutationCreateThreadInput } from "../DataAccess/ThreadMutationServerClient";

const CREATE_THREAD_OPERATION_NAME = "create-thread";
const ARCHIVE_THREAD_OPERATION_NAME = "archive-thread";
const UNARCHIVE_THREAD_OPERATION_NAME = "unarchive-thread";
const MISSING_PROJECT_PATH_MESSAGE = "Cannot create thread: missing project path";

export type ThreadMutationOperationName =
  | typeof CREATE_THREAD_OPERATION_NAME
  | typeof ARCHIVE_THREAD_OPERATION_NAME
  | typeof UNARCHIVE_THREAD_OPERATION_NAME;

export interface ThreadMutationActionRequestOptions {
  actionId: string;
  requestOptions: ApiRequestOptions;
}

export interface ThreadMutationActionErrorReportInput {
  operation: ThreadMutationOperationName;
  actionId: string;
  threadId: string | null;
  error: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface ThreadMutationActionClient {
  createThread(
    input?: ThreadMutationCreateThreadInput,
    options?: ApiRequestOptions,
  ): Promise<{ threadId: string }>;
  archiveThread(threadId: string, options?: ApiRequestOptions): Promise<void>;
  unarchiveThread(threadId: string, options?: ApiRequestOptions): Promise<void>;
}

export interface CreateThreadActionInput {
  projectPath: string;
  agentId?: AgentId;
  buildActionRequestOptions: (
    actionName: ThreadMutationOperationName,
  ) => ThreadMutationActionRequestOptions;
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
  buildActionRequestOptions: (
    actionName: ThreadMutationOperationName,
  ) => ThreadMutationActionRequestOptions;
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
  buildActionRequestOptions: (
    actionName: ThreadMutationOperationName,
  ) => ThreadMutationActionRequestOptions;
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
    if (trimmedProjectPath.length === 0) {
      input.onSetErrorMessage(MISSING_PROJECT_PATH_MESSAGE);
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(
      CREATE_THREAD_OPERATION_NAME,
    );
    input.onSetBusy(true);
    try {
      const created = await input.threadMutationClient.createThread(
        this.buildCreateThreadMutationInput(trimmedProjectPath, input.agentId),
        requestOptions,
      );
      input.onMarkThreadPendingMaterialization(created.threadId);
      input.onThreadSelected(created.threadId);
      input.onSetMobileSidebarOpen(false);
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshCreatedThreadData(created.threadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: CREATE_THREAD_OPERATION_NAME,
        actionId,
        threadId: null,
        error: toErrorMessage(error),
        details: {
          projectPath: trimmedProjectPath,
        },
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async archiveThread(input: ArchiveThreadActionInput): Promise<void> {
    const { actionId, requestOptions } = input.buildActionRequestOptions(
      ARCHIVE_THREAD_OPERATION_NAME,
    );
    input.onSetBusy(true);
    try {
      const nextSelectedThreadIdentifier = this.computeNextSelectedThreadIdentifier({
        selectedThreadId: input.selectedThreadId,
        archivedThreadId: input.threadId,
        activeThreadIdentifiersInOrder: input.activeThreadIdentifiersInOrder,
      });
      await input.threadMutationClient.archiveThread(input.threadId, requestOptions);
      input.onThreadSelected(nextSelectedThreadIdentifier);
      input.onInvalidateActiveThreadQuery();
      input.onInvalidateArchivedThreadQuery();
      await input.loadCoreData();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: ARCHIVE_THREAD_OPERATION_NAME,
        actionId,
        threadId: input.threadId,
        error: toErrorMessage(error),
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async unarchiveThread(input: UnarchiveThreadActionInput): Promise<void> {
    const { actionId, requestOptions } = input.buildActionRequestOptions(
      UNARCHIVE_THREAD_OPERATION_NAME,
    );
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
        operation: UNARCHIVE_THREAD_OPERATION_NAME,
        actionId,
        threadId: input.threadId,
        error: toErrorMessage(error),
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  private buildCreateThreadMutationInput(
    projectPath: string,
    agentId?: AgentId,
  ): ThreadMutationCreateThreadInput {
    const createThreadInput: ThreadMutationCreateThreadInput = {
      cwd: projectPath,
    };
    if (agentId !== undefined) {
      createThreadInput.agentId = agentId;
    }
    return createThreadInput;
  }

  private computeNextSelectedThreadIdentifier(
    input: ComputeNextSelectedThreadIdentifierInput,
  ): string | null {
    if (input.selectedThreadId !== input.archivedThreadId) {
      return input.selectedThreadId;
    }
    return (
      input.activeThreadIdentifiersInOrder.find(
        (threadIdentifier) => threadIdentifier !== input.archivedThreadId,
      ) ?? null
    );
  }
}
