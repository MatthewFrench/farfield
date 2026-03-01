import {
  ApplyPatchApprovalRequestMethod,
  ChatGptAuthTokensRefreshRequestMethod,
  CommandExecutionApprovalRequestMethod,
  ExecuteCommandApprovalRequestMethod,
  FileChangeApprovalRequestMethod,
  ToolCallRequestMethod,
  UserInputRequestMethod,
} from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  type ChatRequestActionChatClient,
  ChatRequestActionCoordinator,
  type ChatRequestActionThreadMutationClient,
} from "../Source/Features/Chat/StateManagement/ChatRequestActionCoordinator";

const DEFAULT_AGENT_ID = "codex";
const DEFAULT_THREAD_ID = "thread-1";
const EXISTING_THREAD_ID = "thread-4";
const SKIP_REQUEST_ID = 17;

const buildActionRequestOptions = (actionName: string) => ({
  actionId: `action-${actionName}`,
  requestOptions: {
    actionId: `action-${actionName}`,
    actionName,
  },
});

function createChatClient(overrides?: {
  sendMessage?: () => Promise<void>;
  submitUserInput?: () => Promise<void>;
  interruptThread?: () => Promise<void>;
}): ChatRequestActionChatClient {
  return {
    sendMessage: vi.fn(overrides?.sendMessage ?? (async () => {})),
    submitUserInput: vi.fn(overrides?.submitUserInput ?? (async () => {})),
    interruptThread: vi.fn(overrides?.interruptThread ?? (async () => {})),
  };
}

function createThreadMutationClient(
  threadId: string = DEFAULT_THREAD_ID,
): ChatRequestActionThreadMutationClient {
  return {
    createThread: vi.fn(async () => ({ threadId })),
  };
}

function createActionCallbacks() {
  const busyStates: boolean[] = [];
  return {
    busyStates,
    onSetBusy: (isBusy: boolean) => {
      busyStates.push(isBusy);
    },
    onInvalidateActiveThreadQuery: vi.fn(),
    onRefreshThreadData: vi.fn(async (_threadId: string) => {}),
    reportTrackedUserInterfaceError: vi.fn(async () => {}),
  };
}

describe("ChatRequestActionCoordinator", () => {
  it("auto-creates thread for send-message when no thread is selected", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const markedThreads: string[] = [];
    const clearedThreads: string[] = [];
    const selectedThreads: string[] = [];
    const chatClient = createChatClient();
    const threadMutationClient = createThreadMutationClient();

    await coordinator.sendMessage({
      draft: "hello world",
      selectedThreadId: null,
      selectedAgentId: DEFAULT_AGENT_ID,
      buildActionRequestOptions,
      onSetBusy,
      onThreadSelected: (threadId) => {
        selectedThreads.push(threadId);
      },
      onMarkThreadPendingMaterialization: (threadId) => {
        markedThreads.push(threadId);
      },
      onClearThreadPendingMaterialization: (threadId) => {
        clearedThreads.push(threadId);
      },
      chatClient,
      threadMutationClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.createThread).toHaveBeenCalledWith(
      { agentId: DEFAULT_AGENT_ID },
      { actionId: "action-send-message", actionName: "send-message" },
    );
    expect(chatClient.sendMessage).toHaveBeenCalledWith(
      { threadId: DEFAULT_THREAD_ID, text: "hello world" },
      { actionId: "action-send-message", actionName: "send-message" },
    );
    expect(markedThreads).toEqual([DEFAULT_THREAD_ID]);
    expect(selectedThreads).toEqual([DEFAULT_THREAD_ID]);
    expect(clearedThreads).toEqual([DEFAULT_THREAD_ID]);
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(onRefreshThreadData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("skips send-message when draft is blank after trimming", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const onThreadSelected = vi.fn();
    const onMarkThreadPendingMaterialization = vi.fn();
    const onClearThreadPendingMaterialization = vi.fn();
    const chatClient = createChatClient();
    const threadMutationClient = createThreadMutationClient();

    await coordinator.sendMessage({
      draft: "   ",
      selectedThreadId: null,
      selectedAgentId: DEFAULT_AGENT_ID,
      buildActionRequestOptions,
      onSetBusy,
      onThreadSelected,
      onMarkThreadPendingMaterialization,
      onClearThreadPendingMaterialization,
      chatClient,
      threadMutationClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onThreadSelected).not.toHaveBeenCalled();
    expect(onMarkThreadPendingMaterialization).not.toHaveBeenCalled();
    expect(onClearThreadPendingMaterialization).not.toHaveBeenCalled();
    expect(threadMutationClient.createThread).not.toHaveBeenCalled();
    expect(chatClient.sendMessage).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("sends steering messages for existing threads", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.steerMessage({
      draft: "adjust the active turn",
      selectedThreadId: EXISTING_THREAD_ID,
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.sendMessage).toHaveBeenCalledWith(
      {
        threadId: EXISTING_THREAD_ID,
        text: "adjust the active turn",
        isSteering: true,
      },
      {
        actionId: "action-steer-message",
        actionName: "steer-message",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(EXISTING_THREAD_ID);
    expect(onRefreshThreadData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("skips steering when no selected thread exists", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const onSetBusy = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const chatClient = createChatClient();

    await coordinator.steerMessage({
      draft: "adjust the active turn",
      selectedThreadId: null,
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy).not.toHaveBeenCalled();
    expect(chatClient.sendMessage).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("skips submit-user-input when no selected thread exists", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const chatClient = createChatClient();
    const onRefreshThreadData = vi.fn(async (_threadId: string) => {});
    const onInvalidateActiveThreadQuery = vi.fn();
    const onSetBusy = vi.fn();
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.submitPendingUserInput({
      selectedThreadId: null,
      requestId: 12,
      answers: {},
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy).not.toHaveBeenCalled();
    expect(chatClient.submitUserInput).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("submits pending user input and refreshes selected thread", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();
    const answers = {
      question_1: {
        answers: ["alpha"],
      },
    };

    await coordinator.submitPendingUserInput({
      selectedThreadId: DEFAULT_THREAD_ID,
      requestId: 12,
      answers,
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        requestId: 12,
        response: {
          method: UserInputRequestMethod,
          payload: {
            answers,
          },
        },
      },
      {
        actionId: "action-submit-user-input",
        actionName: "submit-user-input",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(onRefreshThreadData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("reports skip-user-input errors and resets busy state", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient({
      submitUserInput: async () => {
        throw new Error("skip failed");
      },
    });

    await coordinator.skipPendingUserInput({
      selectedThreadId: "thread-2",
      requestId: SKIP_REQUEST_ID,
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: "thread-2",
        requestId: SKIP_REQUEST_ID,
        response: {
          method: UserInputRequestMethod,
          payload: {
            answers: {},
          },
        },
      },
      {
        actionId: "action-skip-user-input",
        actionName: "skip-user-input",
      },
    );
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "skip-user-input",
      actionId: "action-skip-user-input",
      threadId: "thread-2",
      error: "skip failed",
      details: {
        requestId: SKIP_REQUEST_ID,
      },
    });
    expect(busyStates).toEqual([true, false]);
  });

  it("submits auth-token refresh requests and refreshes selected thread", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.submitAuthTokenRefreshRequest({
      selectedThreadId: DEFAULT_THREAD_ID,
      requestId: 44,
      accessToken: "token-44",
      chatgptAccountId: "account-44",
      chatgptPlanType: "pro",
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        requestId: 44,
        response: {
          method: ChatGptAuthTokensRefreshRequestMethod,
          payload: {
            accessToken: "token-44",
            chatgptAccountId: "account-44",
            chatgptPlanType: "pro",
          },
        },
      },
      {
        actionId: "action-submit-auth-token-refresh",
        actionName: "submit-auth-token-refresh",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(onRefreshThreadData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("skips auth-token refresh submit when no selected thread exists", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const onSetBusy = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const chatClient = createChatClient();

    await coordinator.submitAuthTokenRefreshRequest({
      selectedThreadId: null,
      requestId: 55,
      accessToken: "token-55",
      chatgptAccountId: "account-55",
      chatgptPlanType: null,
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy).not.toHaveBeenCalled();
    expect(chatClient.submitUserInput).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("submits command-execution approval requests and refreshes selected thread", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.submitCommandExecutionApprovalRequest({
      selectedThreadId: DEFAULT_THREAD_ID,
      requestId: 61,
      decision: "acceptForSession",
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        requestId: 61,
        response: {
          method: CommandExecutionApprovalRequestMethod,
          payload: {
            decision: "acceptForSession",
          },
        },
      },
      {
        actionId: "action-submit-command-execution-approval",
        actionName: "submit-command-execution-approval",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("submits file-change approval requests and refreshes selected thread", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.submitFileChangeApprovalRequest({
      selectedThreadId: DEFAULT_THREAD_ID,
      requestId: 62,
      decision: "decline",
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        requestId: 62,
        response: {
          method: FileChangeApprovalRequestMethod,
          payload: {
            decision: "decline",
          },
        },
      },
      {
        actionId: "action-submit-file-change-approval",
        actionName: "submit-file-change-approval",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("submits tool-call responses and refreshes selected thread", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.submitToolCallResponseRequest({
      selectedThreadId: DEFAULT_THREAD_ID,
      requestId: 63,
      payload: {
        success: true,
        contentItems: [
          {
            type: "inputText",
            text: "ready",
          },
        ],
      },
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        requestId: 63,
        response: {
          method: ToolCallRequestMethod,
          payload: {
            success: true,
            contentItems: [
              {
                type: "inputText",
                text: "ready",
              },
            ],
          },
        },
      },
      {
        actionId: "action-submit-tool-call-response",
        actionName: "submit-tool-call-response",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("skips tool-call response submit when no selected thread exists", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const onSetBusy = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const chatClient = createChatClient();

    await coordinator.submitToolCallResponseRequest({
      selectedThreadId: null,
      requestId: 64,
      payload: {
        success: false,
        contentItems: [],
      },
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy).not.toHaveBeenCalled();
    expect(chatClient.submitUserInput).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("submits apply-patch approval decisions and refreshes selected thread", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.submitApplyPatchApprovalRequest({
      selectedThreadId: DEFAULT_THREAD_ID,
      requestId: 65,
      decision: "approved",
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        requestId: 65,
        response: {
          method: ApplyPatchApprovalRequestMethod,
          payload: {
            decision: "approved",
          },
        },
      },
      {
        actionId: "action-submit-apply-patch-approval",
        actionName: "submit-apply-patch-approval",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("submits execute-command approval decisions and refreshes selected thread", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.submitExecuteCommandApprovalRequest({
      selectedThreadId: DEFAULT_THREAD_ID,
      requestId: 66,
      decision: {
        approved_execpolicy_amendment: {
          proposed_execpolicy_amendment: ["git status", "npm test"],
        },
      },
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        requestId: 66,
        response: {
          method: ExecuteCommandApprovalRequestMethod,
          payload: {
            decision: {
              approved_execpolicy_amendment: {
                proposed_execpolicy_amendment: ["git status", "npm test"],
              },
            },
          },
        },
      },
      {
        actionId: "action-submit-execute-command-approval",
        actionName: "submit-execute-command-approval",
      },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("interrupts selected thread and refreshes data", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const {
      busyStates,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    } = createActionCallbacks();
    const chatClient = createChatClient();

    await coordinator.interruptThread({
      selectedThreadId: EXISTING_THREAD_ID,
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.interruptThread).toHaveBeenCalledWith(
      { threadId: EXISTING_THREAD_ID },
      { actionId: "action-interrupt-thread", actionName: "interrupt-thread" },
    );
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshThreadData).toHaveBeenCalledWith(EXISTING_THREAD_ID);
    expect(onRefreshThreadData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("skips interrupt-thread when no selected thread exists", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const onSetBusy = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const chatClient = createChatClient();

    await coordinator.interruptThread({
      selectedThreadId: null,
      buildActionRequestOptions,
      onSetBusy,
      chatClient,
      onInvalidateActiveThreadQuery,
      onRefreshThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy).not.toHaveBeenCalled();
    expect(chatClient.interruptThread).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });
});
