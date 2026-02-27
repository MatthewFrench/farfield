import { describe, expect, it, vi } from "vitest";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import {
  type CollaborationModeActionChatClient,
  CollaborationModeActionCoordinator,
  type CollaborationModeActionModeOption,
} from "../Source/Features/Chat/StateManagement/CollaborationModeActionCoordinator";

const modeSelectionStateResolver = new ModeSelectionStateResolver();
const DEFAULT_THREAD_ID = "thread-1";
const APPLY_THREAD_ID = "thread-2";
const FAILED_THREAD_ID = "thread-3";

const DEFAULT_MODE_OPTIONS: CollaborationModeActionModeOption[] = [
  {
    mode: "default",
    developer_instructions: "Use explicit reasoning.",
  },
];
const PLAN_MODE_OPTIONS: CollaborationModeActionModeOption[] = [
  {
    mode: "plan",
    developer_instructions: null,
  },
];

const buildActionRequestOptions = (actionName: string) => ({
  actionId: `action-${actionName}`,
  requestOptions: {
    actionId: `action-${actionName}`,
    actionName,
  },
});

function createCoordinator(): CollaborationModeActionCoordinator {
  return new CollaborationModeActionCoordinator(modeSelectionStateResolver);
}

function createChatClient(
  setCollaborationModeImplementation?: () => Promise<void>,
): CollaborationModeActionChatClient {
  return {
    setCollaborationMode: vi.fn(setCollaborationModeImplementation ?? (async () => {})),
  };
}

describe("CollaborationModeActionCoordinator", () => {
  it("returns when no selected thread is available", async () => {
    const coordinator = createCoordinator();
    let modeSignature = "";
    const onSetModeSyncing = vi.fn();
    const chatClient = createChatClient();
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "default",
        modelId: "",
        reasoningEffort: "",
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
      reportTrackedUserInterfaceError,
    });

    expect(onSetModeSyncing).not.toHaveBeenCalled();
    expect(chatClient.setCollaborationMode).not.toHaveBeenCalled();
    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("returns when selected mode cannot be resolved", async () => {
    const coordinator = createCoordinator();
    let modeSignature = "";
    const onSetModeSyncing = vi.fn();
    const chatClient = createChatClient();
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "missing",
        modelId: "",
        reasoningEffort: "",
      },
      selectedThreadId: DEFAULT_THREAD_ID,
      modes: [
        {
          mode: "default",
          developer_instructions: null,
        },
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
      reportTrackedUserInterfaceError,
    });

    expect(onSetModeSyncing).not.toHaveBeenCalled();
    expect(chatClient.setCollaborationMode).not.toHaveBeenCalled();
    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("does not submit mode update when signature is already applied and not syncing", async () => {
    const coordinator = createCoordinator();
    const modeSignature = modeSelectionStateResolver.buildModeSignature(
      "default",
      "gpt-5",
      "medium",
    );
    const onSetModeSyncing = vi.fn();
    const chatClient = createChatClient();
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "default",
        modelId: "gpt-5",
        reasoningEffort: "medium",
      },
      selectedThreadId: DEFAULT_THREAD_ID,
      modes: [
        {
          mode: "default",
          developer_instructions: "Use short answers.",
        },
      ],
      isModeSyncing: false,
      readLastAppliedModeSignature: () => modeSignature,
      writeLastAppliedModeSignature: vi.fn(),
      buildActionRequestOptions,
      onSetModeSyncing,
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError,
    });

    expect(onSetModeSyncing).not.toHaveBeenCalled();
    expect(chatClient.setCollaborationMode).not.toHaveBeenCalled();
    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("submits mode update while mode sync confirmation is still in progress", async () => {
    const coordinator = createCoordinator();
    const modeSignature = modeSelectionStateResolver.buildModeSignature(
      "default",
      "gpt-5",
      "medium",
    );
    const onSetModeSyncing = vi.fn();
    const chatClient = createChatClient();
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "default",
        modelId: "gpt-5",
        reasoningEffort: "medium",
      },
      selectedThreadId: DEFAULT_THREAD_ID,
      modes: DEFAULT_MODE_OPTIONS,
      isModeSyncing: true,
      readLastAppliedModeSignature: () => modeSignature,
      writeLastAppliedModeSignature: vi.fn(),
      buildActionRequestOptions,
      onSetModeSyncing,
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.setCollaborationMode).toHaveBeenCalledTimes(1);
    expect(onReloadSelectedThread).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(onSetModeSyncing.mock.calls).toEqual([[true], [false]]);
  });

  it("applies collaboration mode and refreshes selected thread", async () => {
    const coordinator = createCoordinator();
    let modeSignature = "previous-signature";
    const modeSignatureUpdates: string[] = [];
    const modeSyncingStates: boolean[] = [];
    const chatClient = createChatClient();
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "default",
        modelId: "",
        reasoningEffort: "high",
      },
      selectedThreadId: APPLY_THREAD_ID,
      modes: DEFAULT_MODE_OPTIONS,
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
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.setCollaborationMode).toHaveBeenCalledWith(
      {
        threadId: APPLY_THREAD_ID,
        collaborationMode: {
          mode: "default",
          settings: {
            model: null,
            reasoning_effort: "high",
            developer_instructions: "Use explicit reasoning.",
          },
        },
      },
      {
        actionId: "action-set-collaboration-mode",
        actionName: "set-collaboration-mode",
      },
    );
    expect(onReloadSelectedThread).toHaveBeenCalledWith(APPLY_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
    expect(modeSignatureUpdates).toEqual([
      modeSelectionStateResolver.buildModeSignature("default", "", "high"),
    ]);
    expect(modeSyncingStates).toEqual([true, false]);
  });

  it("normalizes empty model and reasoning settings to null when applying a mode", async () => {
    const coordinator = createCoordinator();
    const chatClient = createChatClient();
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "plan",
        modelId: "",
        reasoningEffort: "",
      },
      selectedThreadId: DEFAULT_THREAD_ID,
      modes: PLAN_MODE_OPTIONS,
      isModeSyncing: false,
      readLastAppliedModeSignature: () => "previous-signature",
      writeLastAppliedModeSignature: vi.fn(),
      buildActionRequestOptions,
      onSetModeSyncing: vi.fn(),
      chatClient,
      onReloadSelectedThread,
      reportTrackedUserInterfaceError,
    });

    expect(chatClient.setCollaborationMode).toHaveBeenCalledWith(
      {
        threadId: DEFAULT_THREAD_ID,
        collaborationMode: {
          mode: "plan",
          settings: {
            model: null,
            reasoning_effort: null,
            developer_instructions: null,
          },
        },
      },
      {
        actionId: "action-set-collaboration-mode",
        actionName: "set-collaboration-mode",
      },
    );
    expect(onReloadSelectedThread).toHaveBeenCalledWith(DEFAULT_THREAD_ID);
    expect(reportTrackedUserInterfaceError).not.toHaveBeenCalled();
  });

  it("restores previous signature and reports errors on mutation failure", async () => {
    const coordinator = createCoordinator();
    let modeSignature = "stable-signature";
    const modeSignatureUpdates: string[] = [];
    const modeSyncingStates: boolean[] = [];
    const chatClient = createChatClient(async () => {
      throw new Error("set mode failed");
    });
    const onReloadSelectedThread = vi.fn(async () => {});
    const reportTrackedUserInterfaceError = vi.fn(async () => {});

    await coordinator.applyDraft({
      draft: {
        modeKey: "plan",
        modelId: "gpt-5",
        reasoningEffort: "medium",
      },
      selectedThreadId: FAILED_THREAD_ID,
      modes: PLAN_MODE_OPTIONS,
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
      reportTrackedUserInterfaceError,
    });

    expect(onReloadSelectedThread).not.toHaveBeenCalled();
    expect(reportTrackedUserInterfaceError).toHaveBeenCalledWith({
      operation: "set-collaboration-mode",
      actionId: "action-set-collaboration-mode",
      threadId: FAILED_THREAD_ID,
      error: "set mode failed",
      details: {
        modeKey: "plan",
      },
    });
    expect(modeSignature).toBe("stable-signature");
    expect(modeSignatureUpdates).toEqual([
      modeSelectionStateResolver.buildModeSignature("plan", "gpt-5", "medium"),
      "stable-signature",
    ]);
    expect(modeSyncingStates).toEqual([true, false]);
  });
});
