import { describe, expect, it, vi } from "vitest";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { CollaborationModeActionCoordinator } from "../Source/Features/Chat/StateManagement/CollaborationModeActionCoordinator";

const modeSelectionStateResolver = new ModeSelectionStateResolver();

const buildActionRequestOptions = (actionName: string) => ({
  actionId: `action-${actionName}`,
  requestOptions: {
    actionId: `action-${actionName}`,
    actionName
  }
});

describe("CollaborationModeActionCoordinator", () => {
  it("returns when no selected thread is available", async () => {
    const coordinator = new CollaborationModeActionCoordinator(modeSelectionStateResolver);
    let modeSignature = "";
    const onSetModeSyncing = vi.fn();
    const chatClient = {
      setCollaborationMode: vi.fn(async () => {})
    };
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "default",
        modelId: "",
        reasoningEffort: ""
      },
      selectedThreadId: null,
      modes: [],
      isModeSyncing: false,
      readLastAppliedModeSignature: () => modeSignature,
      writeLastAppliedModeSignature: (nextModeSignature) => {
        modeSignature = nextModeSignature;
      },
      buildActionRequestOptions,
      onSetModeSyncing,
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError
    });

    expect(onSetModeSyncing).not.toHaveBeenCalled();
    expect(chatClient.setCollaborationMode).not.toHaveBeenCalled();
    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("returns when selected mode cannot be resolved", async () => {
    const coordinator = new CollaborationModeActionCoordinator(modeSelectionStateResolver);
    let modeSignature = "";
    const onSetModeSyncing = vi.fn();
    const chatClient = {
      setCollaborationMode: vi.fn(async () => {})
    };
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "missing",
        modelId: "",
        reasoningEffort: ""
      },
      selectedThreadId: "thread-1",
      modes: [
        {
          mode: "default",
          developer_instructions: null
        }
      ],
      isModeSyncing: false,
      readLastAppliedModeSignature: () => modeSignature,
      writeLastAppliedModeSignature: (nextModeSignature) => {
        modeSignature = nextModeSignature;
      },
      buildActionRequestOptions,
      onSetModeSyncing,
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError
    });

    expect(onSetModeSyncing).not.toHaveBeenCalled();
    expect(chatClient.setCollaborationMode).not.toHaveBeenCalled();
    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("does not submit mode update when signature is already applied and not syncing", async () => {
    const coordinator = new CollaborationModeActionCoordinator(modeSelectionStateResolver);
    const modeSignature = modeSelectionStateResolver.buildModeSignature("default", "gpt-5", "medium");
    const onSetModeSyncing = vi.fn();
    const chatClient = {
      setCollaborationMode: vi.fn(async () => {})
    };
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "default",
        modelId: "gpt-5",
        reasoningEffort: "medium"
      },
      selectedThreadId: "thread-1",
      modes: [
        {
          mode: "default",
          developer_instructions: "Use short answers."
        }
      ],
      isModeSyncing: false,
      readLastAppliedModeSignature: () => modeSignature,
      writeLastAppliedModeSignature: vi.fn(),
      buildActionRequestOptions,
      onSetModeSyncing,
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError
    });

    expect(onSetModeSyncing).not.toHaveBeenCalled();
    expect(chatClient.setCollaborationMode).not.toHaveBeenCalled();
    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("applies collaboration mode and refreshes selected thread", async () => {
    const coordinator = new CollaborationModeActionCoordinator(modeSelectionStateResolver);
    let modeSignature = "previous-signature";
    const modeSignatureUpdates: string[] = [];
    const modeSyncingStates: boolean[] = [];
    const chatClient = {
      setCollaborationMode: vi.fn(async () => {})
    };
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "default",
        modelId: "",
        reasoningEffort: "high"
      },
      selectedThreadId: "thread-2",
      modes: [
        {
          mode: "default",
          developer_instructions: "Use explicit reasoning."
        }
      ],
      isModeSyncing: false,
      readLastAppliedModeSignature: () => modeSignature,
      writeLastAppliedModeSignature: (nextModeSignature) => {
        modeSignatureUpdates.push(nextModeSignature);
        modeSignature = nextModeSignature;
      },
      buildActionRequestOptions,
      onSetModeSyncing: (isModeSyncing) => {
        modeSyncingStates.push(isModeSyncing);
      },
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError
    });

    expect(chatClient.setCollaborationMode).toHaveBeenCalledWith(
      {
        threadId: "thread-2",
        collaborationMode: {
          mode: "default",
          settings: {
            model: null,
            reasoning_effort: "high",
            developer_instructions: "Use explicit reasoning."
          }
        }
      },
      {
        actionId: "action-set-collaboration-mode",
        actionName: "set-collaboration-mode"
      }
    );
    expect(onReloadSelectedThread).toHaveBeenCalledWith("thread-2");
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(modeSignatureUpdates).toEqual([
      modeSelectionStateResolver.buildModeSignature("default", "", "high")
    ]);
    expect(modeSyncingStates).toEqual([true, false]);
  });

  it("restores previous signature and reports errors on mutation failure", async () => {
    const coordinator = new CollaborationModeActionCoordinator(modeSelectionStateResolver);
    let modeSignature = "stable-signature";
    const modeSignatureUpdates: string[] = [];
    const modeSyncingStates: boolean[] = [];
    const chatClient = {
      setCollaborationMode: vi.fn(async () => {
        throw new Error("set mode failed");
      })
    };
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "plan",
        modelId: "gpt-5",
        reasoningEffort: "medium"
      },
      selectedThreadId: "thread-3",
      modes: [
        {
          mode: "plan",
          developer_instructions: null
        }
      ],
      isModeSyncing: false,
      readLastAppliedModeSignature: () => modeSignature,
      writeLastAppliedModeSignature: (nextModeSignature) => {
        modeSignatureUpdates.push(nextModeSignature);
        modeSignature = nextModeSignature;
      },
      buildActionRequestOptions,
      onSetModeSyncing: (isModeSyncing) => {
        modeSyncingStates.push(isModeSyncing);
      },
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError
    });

    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "set-collaboration-mode",
      actionId: "action-set-collaboration-mode",
      threadId: "thread-3",
      error: "set mode failed",
      details: {
        modeKey: "plan"
      }
    });
    expect(modeSignature).toBe("stable-signature");
    expect(modeSignatureUpdates).toEqual([
      modeSelectionStateResolver.buildModeSignature("plan", "gpt-5", "medium"),
      "stable-signature"
    ]);
    expect(modeSyncingStates).toEqual([true, false]);
  });
});
