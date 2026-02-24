import { describe, expect, it, vi } from "vitest";
import { ThreadMutationActionCoordinator } from "../Source/Features/Threads/StateManagement/ThreadMutationActionCoordinator";

const buildActionRequestOptions = (actionName: string) => ({
  actionId: `action-${actionName}`,
  requestOptions: {
    actionId: `action-${actionName}`,
    actionName
  }
});

describe("ThreadMutationActionCoordinator", () => {
  it("rejects create-thread when project path is empty after trim", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onSetErrorMessage = vi.fn();
    const onMarkThreadPendingMaterialization = vi.fn();
    const onThreadSelected = vi.fn();
    const onSetMobileSidebarOpen = vi.fn();
    const refreshAll = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {})
    };

    await coordinator.createThread({
      projectPath: "   ",
      buildActionRequestOptions,
      onSetBusy,
      onSetErrorMessage,
      onMarkThreadPendingMaterialization,
      onThreadSelected,
      onSetMobileSidebarOpen,
      threadMutationClient,
      refreshAll,
      reportTrackedUserInterfaceError
    });

    expect(onSetErrorMessage).toHaveBeenCalledWith("Cannot create thread: missing project path");
    expect(onSetBusy).not.toHaveBeenCalled();
    expect(threadMutationClient.createThread).not.toHaveBeenCalled();
    expect(refreshAll).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("creates thread, marks materialization, selects it, and refreshes", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const markedThreadIdentifiers: string[] = [];
    const selectedThreadIdentifiers: string[] = [];
    const mobileSidebarOpenStates: boolean[] = [];
    const onSetErrorMessage = vi.fn();
    const refreshAll = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-55" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {})
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
      threadMutationClient,
      refreshAll,
      reportTrackedUserInterfaceError
    });

    expect(threadMutationClient.createThread).toHaveBeenCalledWith(
      {
        cwd: "/tmp/project",
        agentId: "codex"
      },
      {
        actionId: "action-create-thread",
        actionName: "create-thread"
      }
    );
    expect(onSetErrorMessage).not.toHaveBeenCalled();
    expect(markedThreadIdentifiers).toEqual(["thread-55"]);
    expect(selectedThreadIdentifiers).toEqual(["thread-55"]);
    expect(mobileSidebarOpenStates).toEqual([false]);
    expect(refreshAll).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("archives selected thread and switches selection to next active thread", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const selectedThreadIdentifiers: Array<string | null> = [];
    const onInvalidateThreadQueries = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {})
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
      onInvalidateThreadQueries,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError
    });

    expect(threadMutationClient.archiveThread).toHaveBeenCalledWith(
      "thread-1",
      {
        actionId: "action-archive-thread",
        actionName: "archive-thread"
      }
    );
    expect(selectedThreadIdentifiers).toEqual(["thread-2"]);
    expect(onInvalidateThreadQueries).toHaveBeenCalledTimes(1);
    expect(loadCoreData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });

  it("reports archive-thread failures and resets busy state", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const onSetBusy = vi.fn();
    const onThreadSelected = vi.fn();
    const onInvalidateThreadQueries = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {
        throw new Error("archive failed");
      }),
      unarchiveThread: vi.fn(async () => {})
    };

    await coordinator.archiveThread({
      threadId: "thread-1",
      selectedThreadId: "thread-4",
      activeThreadIdentifiersInOrder: ["thread-1", "thread-4"],
      buildActionRequestOptions,
      onSetBusy,
      onThreadSelected,
      onInvalidateThreadQueries,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError
    });

    expect(onSetBusy.mock.calls).toEqual([[true], [false]]);
    expect(onThreadSelected).not.toHaveBeenCalled();
    expect(onInvalidateThreadQueries).not.toHaveBeenCalled();
    expect(loadCoreData).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "archive-thread",
      actionId: "action-archive-thread",
      threadId: "thread-1",
      error: "archive failed"
    });
  });

  it("unarchives thread, selects it, closes sidebar, and reloads core data", async () => {
    const coordinator = new ThreadMutationActionCoordinator();
    const busyStates: boolean[] = [];
    const selectedThreadIdentifiers: string[] = [];
    const mobileSidebarOpenStates: boolean[] = [];
    const onInvalidateThreadQueries = vi.fn();
    const loadCoreData = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});
    const threadMutationClient = {
      createThread: vi.fn(async () => ({ threadId: "thread-1" })),
      archiveThread: vi.fn(async () => {}),
      unarchiveThread: vi.fn(async () => {})
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
      onInvalidateThreadQueries,
      loadCoreData,
      threadMutationClient,
      reportTrackedUserInterfaceError
    });

    expect(threadMutationClient.unarchiveThread).toHaveBeenCalledWith(
      "thread-7",
      {
        actionId: "action-unarchive-thread",
        actionName: "unarchive-thread"
      }
    );
    expect(selectedThreadIdentifiers).toEqual(["thread-7"]);
    expect(mobileSidebarOpenStates).toEqual([false]);
    expect(onInvalidateThreadQueries).toHaveBeenCalledTimes(1);
    expect(loadCoreData).toHaveBeenCalledTimes(1);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(busyStates).toEqual([true, false]);
  });
});
