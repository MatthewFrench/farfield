import type { AgentId, ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import type { ThreadMutationCreateThreadInput } from "../DataAccess/ThreadMutationServerClient";

const CREATE_THREAD_OPERATION_NAME = "create-thread";
const ARCHIVE_THREAD_OPERATION_NAME = "archive-thread";
const UNARCHIVE_THREAD_OPERATION_NAME = "unarchive-thread";
const FORK_THREAD_OPERATION_NAME = "fork-thread";
const SET_THREAD_NAME_OPERATION_NAME = "set-thread-name";
const ROLLBACK_THREAD_OPERATION_NAME = "rollback-thread";
const MISSING_PROJECT_PATH_MESSAGE = "Cannot create thread: missing project path";
const MISSING_THREAD_NAME_MESSAGE = "Cannot rename thread: missing name";
const INVALID_ROLLBACK_TURN_COUNT_MESSAGE =
  "Cannot rollback thread: numTurns must be greater than zero";

export type ThreadMutationOperationName =
  | typeof CREATE_THREAD_OPERATION_NAME
  | typeof ARCHIVE_THREAD_OPERATION_NAME
  | typeof UNARCHIVE_THREAD_OPERATION_NAME
  | typeof FORK_THREAD_OPERATION_NAME
  | typeof SET_THREAD_NAME_OPERATION_NAME
  | typeof ROLLBACK_THREAD_OPERATION_NAME;

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
  forkThread(
    threadId: string,
    options?: ApiRequestOptions,
  ): Promise<{ threadId: string; sourceThreadId: string }>;
  setThreadName(threadId: string, name: string, options?: ApiRequestOptions): Promise<void>;
  rollbackThread(threadId: string, numTurns: number, options?: ApiRequestOptions): Promise<void>;
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

export interface ForkThreadActionInput {
  threadId: string;
  buildActionRequestOptions: (
    actionName: ThreadMutationOperationName,
  ) => ThreadMutationActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  onMarkThreadPendingMaterialization: (threadId: string) => void;
  onThreadSelected: (threadId: string) => void;
  onSetMobileSidebarOpen: (isOpen: boolean) => void;
  onInvalidateActiveThreadQuery: () => void;
  onRefreshCreatedThreadData: (threadId: string) => Promise<void>;
  threadMutationClient: ThreadMutationActionClient;
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
}

export interface SetThreadNameActionInput {
  threadId: string;
  name: string;
  buildActionRequestOptions: (
    actionName: ThreadMutationOperationName,
  ) => ThreadMutationActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  onSetErrorMessage: (errorMessage: string) => void;
  onInvalidateActiveThreadQuery: () => void;
  onInvalidateArchivedThreadQuery: () => void;
  onThreadNameUpdated?: (threadId: string, threadName: string) => void;
  loadCoreData: () => Promise<void>;
  threadMutationClient: ThreadMutationActionClient;
  reportTrackedUserInterfaceError: (input: ThreadMutationActionErrorReportInput) => Promise<void>;
}

export interface RollbackThreadActionInput {
  threadId: string;
  numTurns: number;
  selectedThreadId: string | null;
  buildActionRequestOptions: (
    actionName: ThreadMutationOperationName,
  ) => ThreadMutationActionRequestOptions;
  onSetBusy: (isBusy: boolean) => void;
  onSetErrorMessage: (errorMessage: string) => void;
  onInvalidateActiveThreadQuery: () => void;
  loadCoreData: () => Promise<void>;
  onRefreshRolledBackThreadData: (threadId: string) => Promise<void>;
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

  public async forkThread(input: ForkThreadActionInput): Promise<void> {
    const { actionId, requestOptions } = input.buildActionRequestOptions(
      FORK_THREAD_OPERATION_NAME,
    );
    input.onSetBusy(true);
    try {
      const forkResult = await input.threadMutationClient.forkThread(
        input.threadId,
        requestOptions,
      );
      input.onMarkThreadPendingMaterialization(forkResult.threadId);
      input.onThreadSelected(forkResult.threadId);
      input.onSetMobileSidebarOpen(false);
      input.onInvalidateActiveThreadQuery();
      await input.onRefreshCreatedThreadData(forkResult.threadId);
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: FORK_THREAD_OPERATION_NAME,
        actionId,
        threadId: input.threadId,
        error: toErrorMessage(error),
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async setThreadName(input: SetThreadNameActionInput): Promise<void> {
    const trimmedName = input.name.trim();
    if (trimmedName.length === 0) {
      input.onSetErrorMessage(MISSING_THREAD_NAME_MESSAGE);
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(
      SET_THREAD_NAME_OPERATION_NAME,
    );
    input.onSetBusy(true);
    try {
      await input.threadMutationClient.setThreadName(input.threadId, trimmedName, requestOptions);
      input.onThreadNameUpdated?.(input.threadId, trimmedName);
      input.onInvalidateActiveThreadQuery();
      input.onInvalidateArchivedThreadQuery();
      await input.loadCoreData();
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: SET_THREAD_NAME_OPERATION_NAME,
        actionId,
        threadId: input.threadId,
        error: toErrorMessage(error),
        details: {
          nameLength: trimmedName.length,
        },
      });
    } finally {
      input.onSetBusy(false);
    }
  }

  public async rollbackThread(input: RollbackThreadActionInput): Promise<void> {
    if (input.numTurns <= 0) {
      input.onSetErrorMessage(INVALID_ROLLBACK_TURN_COUNT_MESSAGE);
      return;
    }

    const { actionId, requestOptions } = input.buildActionRequestOptions(
      ROLLBACK_THREAD_OPERATION_NAME,
    );
    input.onSetBusy(true);
    try {
      await input.threadMutationClient.rollbackThread(
        input.threadId,
        input.numTurns,
        requestOptions,
      );
      input.onInvalidateActiveThreadQuery();
      if (input.selectedThreadId === input.threadId) {
        await input.onRefreshRolledBackThreadData(input.threadId);
      } else {
        await input.loadCoreData();
      }
    } catch (error) {
      await input.reportTrackedUserInterfaceError({
        operation: ROLLBACK_THREAD_OPERATION_NAME,
        actionId,
        threadId: input.threadId,
        error: toErrorMessage(error),
        details: {
          numTurns: input.numTurns,
        },
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
