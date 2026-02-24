import { describe, expect, it, vi } from "vitest";
import { ChatRequestActionCoordinator } from "../Source/Features/Chat/StateManagement/ChatRequestActionCoordinator";

describe("ChatRequestActionCoordinator", () => {
  it("auto-creates thread for send-message when no thread is selected", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const busyStates: boolean[] = [];
    const markedThreads: string[] = [];
    const clearedThreads: string[] = [];
    const selectedThreads: string[] = [];
    const refreshAll = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const chatClient = {
      sendMessage: vi.fn(async () => {}),
      submitUserInput: vi.fn(async () => {}),
      interruptThread: vi.fn(async () => {})
    };
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" }))
    };

    await coordinator.sendMessage({
      draft: "hello world",
      selectedThreadId: null,
      selectedAgentId: "codex",
      buildActionRequestOptions: (actionName) => ({
        actionId: `action-${actionName}`,
        requestOptions: {
          actionId: `action-${actionName}`,
          actionName
        }
      }),
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
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
      refreshAll,
      reportTrackedUserInterfaceError
    });

    expect(threadMutationClient.createThread).toHaveBeenCalledWith(
      { agentId: "codex" },
      { actionId: "action-send-message", actionName: "send-message" }
    );
    expect(chatClient.sendMessage).toHaveBeenCalledWith(
      { threadId: "thread-1", text: "hello world" },
      { actionId: "action-send-message", actionName: "send-message" }
    );
    expect(markedThreads).toEqual(["thread-1"]);
    expect(selectedThreads).toEqual(["thread-1"]);
    expect(clearedThreads).toEqual(["thread-1"]);
    expect(refreshAll).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("skips submit-user-input when no selected thread exists", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const chatClient = {
      sendMessage: vi.fn(async () => {}),
      submitUserInput: vi.fn(async () => {}),
      interruptThread: vi.fn(async () => {})
    };
    const refreshAll = vi.fn(async () => {});
    const onSetBusy = vi.fn();
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.submitPendingUserInput({
      selectedThreadId: null,
      requestId: 12,
      answers: {},
      buildActionRequestOptions: (actionName) => ({
        actionId: `action-${actionName}`,
        requestOptions: {
          actionId: `action-${actionName}`,
          actionName
        }
      }),
      onSetBusy,
      chatClient,
      refreshAll,
      reportTrackedUserInterfaceError
    });

    expect(onSetBusy).not.toHaveBeenCalled();
    expect(chatClient.submitUserInput).not.toHaveBeenCalled();
    expect(refreshAll).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("reports skip-user-input errors and resets busy state", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const onSetBusy = vi.fn();
    const refreshAll = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const chatClient = {
      sendMessage: vi.fn(async () => {}),
      submitUserInput: vi.fn(async () => {
        throw new Error("skip failed");
      }),
      interruptThread: vi.fn(async () => {})
    };

    await coordinator.skipPendingUserInput({
      selectedThreadId: "thread-2",
      requestId: 17,
      buildActionRequestOptions: (actionName) => ({
        actionId: `action-${actionName}`,
        requestOptions: {
          actionId: `action-${actionName}`,
          actionName
        }
      }),
      onSetBusy,
      chatClient,
      refreshAll,
      reportTrackedUserInterfaceError
    });

    expect(chatClient.submitUserInput).toHaveBeenCalledWith(
      {
        threadId: "thread-2",
        requestId: 17,
        response: { answers: {} }
      },
      {
        actionId: "action-skip-user-input",
        actionName: "skip-user-input"
      }
    );
    expect(refreshAll).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "skip-user-input",
      actionId: "action-skip-user-input",
      threadId: "thread-2",
      error: "skip failed",
      details: {
        requestId: 17
      }
    });
    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
  });

  it("interrupts selected thread and refreshes data", async () => {
    const coordinator = new ChatRequestActionCoordinator();
    const onSetBusy = vi.fn();
    const refreshAll = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const chatClient = {
      sendMessage: vi.fn(async () => {}),
      submitUserInput: vi.fn(async () => {}),
      interruptThread: vi.fn(async () => {})
    };

    await coordinator.interruptThread({
      selectedThreadId: "thread-4",
      buildActionRequestOptions: (actionName) => ({
        actionId: `action-${actionName}`,
        requestOptions: {
          actionId: `action-${actionName}`,
          actionName
        }
      }),
      onSetBusy,
      chatClient,
      refreshAll,
      reportTrackedUserInterfaceError
    });

    expect(chatClient.interruptThread).toHaveBeenCalledWith(
      { threadId: "thread-4" },
      { actionId: "action-interrupt-thread", actionName: "interrupt-thread" }
    );
    expect(refreshAll).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
  });
});
