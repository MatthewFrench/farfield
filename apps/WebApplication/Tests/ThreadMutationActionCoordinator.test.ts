import { describe, expect, it, vi } from "vitest";
import { ThreadMutationActionCoordinator } from "../Source/Features/Threads/StateManagement/ThreadMutationActionCoordinator";

const buildActionRequestOptions = (actionName: string) => ({
  actionId: `action-${actionName}`,
  requestOptions: {
    actionId: `action-${actionName}`,
    actionName,
  },
});

describe("ThreadMutationActionCoordinator", () => {
  it("rejects create-thread when project path is empty after trim", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onSetErrorMessage = vi.fn();
    const onMarkThreadPendingMaterialization = vi.fn();
    const onThreadSelected = vi.fn();
    const onSetMobileSidebarOpen = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshCreatedThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.createThread({
      projectPath: "   ",
      buildActionRequestOptions,
      onSetBusy,
      onSetErrorMessage,
      onMarkThreadPendingMaterialization,
      onThreadSelected,
      onSetMobileSidebarOpen,
      onInvalidateActiveThreadQuery,
      threadMutationClient,
      onRefreshCreatedThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onSetErrorMessage).toHaveBeenCalledWith("Cannot create thread: missing project path");
    expect(onSetBusy).not.toHaveBeenCalled();
    expect(threadMutationClient.createThread).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshCreatedThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("creates thread, marks materialization, selects it, and refreshes", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const markedThreadIdentifiers: string[] = [];
    const selectedThreadIdentifiers: string[] = [];
    const mobileSidebarOpenStates: boolean[] = [];
    const onSetErrorMessage = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshCreatedThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-55" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.createThread({
      projectPath: "  /tmp/project  ",
      agentId: "codex",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onSetErrorMessage,
      onMarkThreadPendingMaterialization: (threadId) => {
        markedThreadIdentifiers.push(threadId);
      },
      onThreadSelected: (threadId) => {
        selectedThreadIdentifiers.push(threadId);
      },
      onSetMobileSidebarOpen: (isOpen) => {
        mobileSidebarOpenStates.push(isOpen);
      },
      onInvalidateActiveThreadQuery,
      threadMutationClient,
      onRefreshCreatedThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.createThread).toHaveBeenCalledWith(
      {
        cwd: "/tmp/project",
        agentId: "codex",
      },
      {
        actionId: "action-create-thread",
        actionName: "create-thread",
      },
    );
    expect(onSetErrorMessage).not.toHaveBeenCalled();
    expect(markedThreadIdentifiers).toEqual(["thread-55"]);
    expect(selectedThreadIdentifiers).toEqual(["thread-55"]);
    expect(mobileSidebarOpenStates).toEqual([false]);
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshCreatedThreadData).toHaveBeenCalledWith("thread-55");
    expect(onRefreshCreatedThreadData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("archives selected thread and switches selection to next active thread", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const selectedThreadIdentifiers: Array<string | null> = [];
    const onInvalidateActiveThreadQuery = vi.fn();
    const onInvalidateArchivedThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.archiveThread({
      threadId: "thread-1",
      selectedThreadId: "thread-1",
      activeThreadIdentifiersInOrder: ["thread-1", "thread-2", "thread-3"],
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onThreadSelected: (threadId) => {
        selectedThreadIdentifiers.push(threadId);
      },
      onInvalidateActiveThreadQuery,
      onInvalidateArchivedThreadQuery,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.archiveThread).toHaveBeenCalledWith("thread-1", {
      actionId: "action-archive-thread",
      actionName: "archive-thread",
    });
    expect(selectedThreadIdentifiers).toEqual(["thread-2"]);
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onInvalidateArchivedThreadQuery).toHaveBeenCalledTimes(1);
    expect(loadCoreData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("reports archive-thread failures and resets busy state", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onThreadSelected = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onInvalidateArchivedThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {
        throw new Error("archive failed");
      }),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.archiveThread({
      threadId: "thread-1",
      selectedThreadId: "thread-4",
      activeThreadIdentifiersInOrder: ["thread-1", "thread-4"],
      buildActionRequestOptions,
      onSetBusy,
      onThreadSelected,
      onInvalidateActiveThreadQuery,
      onInvalidateArchivedThreadQuery,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
    expect(onThreadSelected).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onInvalidateArchivedThreadQuery).not.toHaveBeenCalled();
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "archive-thread",
      actionId: "action-archive-thread",
      threadId: "thread-1",
      error: "archive failed",
    });
  });

  it("unarchives thread, selects it, closes sidebar, and reloads core data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const selectedThreadIdentifiers: string[] = [];
    const mobileSidebarOpenStates: boolean[] = [];
    const onInvalidateActiveThreadQuery = vi.fn();
    const onInvalidateArchivedThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.unarchiveThread({
      threadId: "thread-7",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onThreadSelected: (threadId) => {
        selectedThreadIdentifiers.push(threadId);
      },
      onSetMobileSidebarOpen: (isOpen) => {
        mobileSidebarOpenStates.push(isOpen);
      },
      onInvalidateActiveThreadQuery,
      onInvalidateArchivedThreadQuery,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.unarchiveThread).toHaveBeenCalledWith("thread-7", {
      actionId: "action-unarchive-thread",
      actionName: "unarchive-thread",
    });
    expect(selectedThreadIdentifiers).toEqual(["thread-7"]);
    expect(mobileSidebarOpenStates).toEqual([false]);
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onInvalidateArchivedThreadQuery).toHaveBeenCalledTimes(1);
    expect(loadCoreData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("reports create-thread failures with trimmed project path details and resets busy state", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onSetErrorMessage = vi.fn();
    const onMarkThreadPendingMaterialization = vi.fn();
    const onThreadSelected = vi.fn();
    const onSetMobileSidebarOpen = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshCreatedThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => {
        throw new Error("create failed");
      }),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.createThread({
      projectPath: "  /tmp/project  ",
      buildActionRequestOptions,
      onSetBusy,
      onSetErrorMessage,
      onMarkThreadPendingMaterialization,
      onThreadSelected,
      onSetMobileSidebarOpen,
      onInvalidateActiveThreadQuery,
      threadMutationClient,
      onRefreshCreatedThreadData,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
    expect(onSetErrorMessage).not.toHaveBeenCalled();
    expect(onMarkThreadPendingMaterialization).not.toHaveBeenCalled();
    expect(onThreadSelected).not.toHaveBeenCalled();
    expect(onSetMobileSidebarOpen).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshCreatedThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "create-thread",
      actionId: "action-create-thread",
      threadId: null,
      error: "create failed",
      details: {
        projectPath: "/tmp/project",
      },
    });
  });

  it("keeps selection unchanged when archiving a non-selected thread", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const selectedThreadIdentifiers: Array<string | null> = [];
    const onInvalidateActiveThreadQuery = vi.fn();
    const onInvalidateArchivedThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.archiveThread({
      threadId: "thread-1",
      selectedThreadId: "thread-4",
      activeThreadIdentifiersInOrder: ["thread-1", "thread-4"],
      buildActionRequestOptions,
      onSetBusy: () => {},
      onThreadSelected: (threadId) => {
        selectedThreadIdentifiers.push(threadId);
      },
      onInvalidateActiveThreadQuery,
      onInvalidateArchivedThreadQuery,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(selectedThreadIdentifiers).toEqual(["thread-4"]);
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onInvalidateArchivedThreadQuery).toHaveBeenCalledTimes(1);
    expect(loadCoreData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("forks thread, selects forked thread, and refreshes forked data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const markedThreadIdentifiers: string[] = [];
    const selectedThreadIdentifiers: string[] = [];
    const mobileSidebarOpenStates: boolean[] = [];
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshCreatedThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-8", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.forkThread({
      threadId: "thread-1",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onMarkThreadPendingMaterialization: (threadId) => {
        markedThreadIdentifiers.push(threadId);
      },
      onThreadSelected: (threadId) => {
        selectedThreadIdentifiers.push(threadId);
      },
      onSetMobileSidebarOpen: (isOpen) => {
        mobileSidebarOpenStates.push(isOpen);
      },
      onInvalidateActiveThreadQuery,
      onRefreshCreatedThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.forkThread).toHaveBeenCalledWith("thread-1", {
      actionId: "action-fork-thread",
      actionName: "fork-thread",
    });
    expect(markedThreadIdentifiers).toEqual(["thread-8"]);
    expect(selectedThreadIdentifiers).toEqual(["thread-8"]);
    expect(mobileSidebarOpenStates).toEqual([false]);
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshCreatedThreadData).toHaveBeenCalledWith("thread-8");
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("rolls back selected thread and refreshes selected thread data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const onSetErrorMessage = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const onRefreshRolledBackThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.rollbackThread({
      threadId: "thread-1",
      numTurns: 1,
      selectedThreadId: "thread-1",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onSetErrorMessage,
      onInvalidateActiveThreadQuery,
      loadCoreData,
      onRefreshRolledBackThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.rollbackThread).toHaveBeenCalledWith("thread-1", 1, {
      actionId: "action-rollback-thread",
      actionName: "rollback-thread",
    });
    expect(onSetErrorMessage).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshRolledBackThreadData).toHaveBeenCalledWith("thread-1");
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("rejects rollback when turn count is invalid", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onSetErrorMessage = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const onRefreshRolledBackThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.rollbackThread({
      threadId: "thread-1",
      numTurns: 0,
      selectedThreadId: "thread-1",
      buildActionRequestOptions,
      onSetBusy,
      onSetErrorMessage,
      onInvalidateActiveThreadQuery,
      loadCoreData,
      onRefreshRolledBackThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(onSetErrorMessage).toHaveBeenCalledWith(
      "Cannot rollback thread: numTurns must be greater than zero",
    );
    expect(onSetBusy).not.toHaveBeenCalled();
    expect(threadMutationClient.rollbackThread).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshRolledBackThreadData).not.toHaveBeenCalled();
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("sets thread name, invalidates thread queries, and reloads core data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const onSetErrorMessage = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onInvalidateArchivedThreadQuery = vi.fn();
    const onThreadNameUpdated = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-1",
        reviewTurnId: "turn-review-1",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.setThreadName({
      threadId: "thread-1",
      name: "  New title  ",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onSetErrorMessage,
      onInvalidateActiveThreadQuery,
      onInvalidateArchivedThreadQuery,
      onThreadNameUpdated,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.setThreadName).toHaveBeenCalledWith("thread-1", "New title", {
      actionId: "action-set-thread-name",
      actionName: "set-thread-name",
    });
    expect(onSetErrorMessage).not.toHaveBeenCalled();
    expect(onThreadNameUpdated).toHaveBeenCalledWith("thread-1", "New title");
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onInvalidateArchivedThreadQuery).toHaveBeenCalledTimes(1);
    expect(loadCoreData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("starts thread compaction and refreshes selected thread data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const onInvalidateActiveThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const onRefreshCompactedThreadData = vi.fn(async (_threadId: string) => {});
    const onReportSuccess = vi.fn();
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-9",
        reviewTurnId: "turn-review-9",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.compactThread({
      threadId: "thread-1",
      selectedThreadId: "thread-1",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onInvalidateActiveThreadQuery,
      loadCoreData,
      onRefreshCompactedThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
      onReportSuccess,
    });

    expect(threadMutationClient.compactThread).toHaveBeenCalledWith("thread-1", {
      actionId: "action-compact-thread",
      actionName: "compact-thread",
    });
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshCompactedThreadData).toHaveBeenCalledWith("thread-1");
    expect(onRefreshCompactedThreadData).toHaveBeenCalledTimes(1);
    expect(onReportSuccess).toHaveBeenCalledWith({
      operation: "compact-thread",
      actionId: "action-compact-thread",
      threadId: "thread-1",
    });
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("reports compact-thread failures and resets busy state", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const onRefreshCompactedThreadData = vi.fn(async (_threadId: string) => {});
    const onReportSuccess = vi.fn();
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {
        throw new Error("compact failed");
      }),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-9",
        reviewTurnId: "turn-review-9",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.compactThread({
      threadId: "thread-1",
      selectedThreadId: "thread-7",
      buildActionRequestOptions,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      loadCoreData,
      onRefreshCompactedThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
      onReportSuccess,
    });

    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshCompactedThreadData).not.toHaveBeenCalled();
    expect(onReportSuccess).not.toHaveBeenCalled();
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "compact-thread",
      actionId: "action-compact-thread",
      threadId: "thread-1",
      error: "compact failed",
    });
  });

  it("cleans background terminals and refreshes selected thread data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const onInvalidateActiveThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const onRefreshCleanedThreadData = vi.fn(async (_threadId: string) => {});
    const onReportSuccess = vi.fn();
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-9",
        reviewTurnId: "turn-review-9",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.cleanThreadBackgroundTerminals({
      threadId: "thread-1",
      selectedThreadId: "thread-1",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onInvalidateActiveThreadQuery,
      loadCoreData,
      onRefreshCleanedThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
      onReportSuccess,
    });

    expect(threadMutationClient.cleanThreadBackgroundTerminals).toHaveBeenCalledWith("thread-1", {
      actionId: "action-clean-thread-background-terminals",
      actionName: "clean-thread-background-terminals",
    });
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshCleanedThreadData).toHaveBeenCalledWith("thread-1");
    expect(onRefreshCleanedThreadData).toHaveBeenCalledTimes(1);
    expect(onReportSuccess).toHaveBeenCalledWith({
      operation: "clean-thread-background-terminals",
      actionId: "action-clean-thread-background-terminals",
      threadId: "thread-1",
    });
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("reports background-terminal cleanup failures and resets busy state", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const onRefreshCleanedThreadData = vi.fn(async (_threadId: string) => {});
    const onReportSuccess = vi.fn();
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {
        throw new Error("background terminal cleanup failed");
      }),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-9",
        reviewTurnId: "turn-review-9",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.cleanThreadBackgroundTerminals({
      threadId: "thread-1",
      selectedThreadId: "thread-7",
      buildActionRequestOptions,
      onSetBusy,
      onInvalidateActiveThreadQuery,
      loadCoreData,
      onRefreshCleanedThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
      onReportSuccess,
    });

    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshCleanedThreadData).not.toHaveBeenCalled();
    expect(onReportSuccess).not.toHaveBeenCalled();
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "clean-thread-background-terminals",
      actionId: "action-clean-thread-background-terminals",
      threadId: "thread-1",
      error: "background terminal cleanup failed",
    });
  });

  it("starts thread review, selects the review thread, and refreshes review data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const selectedThreadIdentifiers: string[] = [];
    const mobileSidebarOpenStates: boolean[] = [];
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshReviewThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review-9",
        reviewTurnId: "turn-review-9",
      })),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.startThreadReview({
      threadId: "thread-1",
      buildActionRequestOptions,
      onSetBusy: (isBusy) => {
        busyStates.push(isBusy);
      },
      onThreadSelected: (threadId) => {
        selectedThreadIdentifiers.push(threadId);
      },
      onSetMobileSidebarOpen: (isOpen) => {
        mobileSidebarOpenStates.push(isOpen);
      },
      onInvalidateActiveThreadQuery,
      onRefreshReviewThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(threadMutationClient.startThreadReview).toHaveBeenCalledWith("thread-1", {
      actionId: "action-start-thread-review",
      actionName: "start-thread-review",
    });
    expect(selectedThreadIdentifiers).toEqual(["thread-review-9"]);
    expect(mobileSidebarOpenStates).toEqual([false]);
    expect(onInvalidateActiveThreadQuery).toHaveBeenCalledTimes(1);
    expect(onRefreshReviewThreadData).toHaveBeenCalledWith("thread-review-9");
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("reports start-review failures and resets busy state", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onThreadSelected = vi.fn();
    const onSetMobileSidebarOpen = vi.fn();
    const onInvalidateActiveThreadQuery = vi.fn();
    const onRefreshReviewThreadData = vi.fn(async (_threadId: string) => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({ threadId: "thread-forked", sourceThreadId: "thread-1" })),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => {
        throw new Error("review failed");
      }),
      setThreadName: vi.fn(async () => {}),
    };

    await coordinator.startThreadReview({
      threadId: "thread-1",
      buildActionRequestOptions,
      onSetBusy,
      onThreadSelected,
      onSetMobileSidebarOpen,
      onInvalidateActiveThreadQuery,
      onRefreshReviewThreadData,
      threadMutationClient,
      reportTrackedUserInterfaceError,
    });

    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
    expect(onThreadSelected).not.toHaveBeenCalled();
    expect(onSetMobileSidebarOpen).not.toHaveBeenCalled();
    expect(onInvalidateActiveThreadQuery).not.toHaveBeenCalled();
    expect(onRefreshReviewThreadData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "start-thread-review",
      actionId: "action-start-thread-review",
      threadId: "thread-1",
      error: "review failed",
    });
  });
});
