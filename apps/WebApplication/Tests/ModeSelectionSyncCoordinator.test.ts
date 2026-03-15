import { describe, expect, it } from "vitest";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import {
  ModeSelectionSyncCoordinator,
  type ModeSelectionSyncInput,
} from "../Source/Features/Chat/StateManagement/ModeSelectionSyncCoordinator";

const APP_DEFAULT_MODEL = "gpt-5.3-codex";
const APP_DEFAULT_REASONING_EFFORT = "medium";
const DEFAULT_MODE_KEY = "default";
const REMOTE_MODEL = "gpt-5.4-codex";
const REMOTE_REASONING_EFFORT = "high";

interface RemoteConversationStateFixture {
  latestCollaborationMode: {
    mode: string;
    settings: {
      model: string;
      reasoning_effort: string;
    };
  };
}

function createCoordinator(): ModeSelectionSyncCoordinator {
  return new ModeSelectionSyncCoordinator(new ModeSelectionStateResolver());
}

function createBaseInput(): ModeSelectionSyncInput {
  return {
    conversationState: null,
    appDefaultModel: APP_DEFAULT_MODEL,
    appDefaultReasoningEffort: APP_DEFAULT_REASONING_EFFORT,
    defaultModeKey: DEFAULT_MODE_KEY,
    selectedModeKey: DEFAULT_MODE_KEY,
    selectedModelId: "",
    selectedReasoningEffort: "",
    hasHydratedModeFromLiveState: false,
    isModeSyncing: false,
    lastAppliedModeSignature: "",
  };
}

function createRemoteConversationState(modeKey: string): RemoteConversationStateFixture {
  return {
    latestCollaborationMode: {
      mode: modeKey,
      settings: {
        model: REMOTE_MODEL,
        reasoning_effort: REMOTE_REASONING_EFFORT,
      },
    },
  };
}

describe("ModeSelectionSyncCoordinator", () => {
  it("returns noConversationState transition when conversation state is absent", () => {
    const coordinator = createCoordinator();

    const transition = coordinator.readTransition(createBaseInput());

    expect(transition.kind).toBe("noConversationState");
    expect(transition.nextSelectedModeKey).toBe(DEFAULT_MODE_KEY);
    expect(transition.nextHasHydratedModeFromLiveState).toBe(false);
  });

  it("keeps local selections in noConversationState transitions", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      selectedModeKey: "plan",
      selectedModelId: REMOTE_MODEL,
      selectedReasoningEffort: REMOTE_REASONING_EFFORT,
    });

    expect(transition.kind).toBe("noConversationState");
    expect(transition.nextSelectedModeKey).toBe("plan");
    expect(transition.nextSelectedModelId).toBe(REMOTE_MODEL);
    expect(transition.nextSelectedReasoningEffort).toBe(REMOTE_REASONING_EFFORT);
  });

  it("hydrates mode state from remote conversation selection", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: createRemoteConversationState("plan"),
    });

    expect(transition).toEqual({
      kind: "hydrateFromRemote",
      nextSelectedModeKey: "plan",
      nextSelectedModelId: REMOTE_MODEL,
      nextSelectedReasoningEffort: REMOTE_REASONING_EFFORT,
      nextHasHydratedModeFromLiveState: true,
      nextIsModeSyncing: false,
      nextLastAppliedModeSignature: "plan|gpt-5.4-codex|high",
    });
  });

  it("hydrates empty remote mode keys to the configured default mode key", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      selectedModeKey: "",
      conversationState: {
        latestCollaborationMode: {
          mode: "",
          settings: {
            model: APP_DEFAULT_MODEL,
            reasoning_effort: APP_DEFAULT_REASONING_EFFORT,
          },
        },
      },
    });

    expect(transition.kind).toBe("hydrateFromRemote");
    expect(transition.nextSelectedModeKey).toBe(DEFAULT_MODE_KEY);
    expect(transition.nextSelectedModelId).toBe("");
    expect(transition.nextSelectedReasoningEffort).toBe("");
    expect(transition.nextLastAppliedModeSignature).toBe("default||");
  });

  it("confirms synchronized state and clears syncing flag", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: createRemoteConversationState("default"),
      hasHydratedModeFromLiveState: true,
      isModeSyncing: true,
      selectedModeKey: "default",
      selectedModelId: REMOTE_MODEL,
      selectedReasoningEffort: REMOTE_REASONING_EFFORT,
    });

    expect(transition.kind).toBe("confirmSynchronized");
    expect(transition.nextIsModeSyncing).toBe(false);
    expect(transition.nextLastAppliedModeSignature).toBe("default|gpt-5.4-codex|high");
  });

  it("holds local state while waiting for mode-sync request confirmation", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: createRemoteConversationState("plan"),
      hasHydratedModeFromLiveState: true,
      isModeSyncing: true,
      selectedModeKey: "default",
      selectedModelId: REMOTE_MODEL,
      selectedReasoningEffort: REMOTE_REASONING_EFFORT,
      lastAppliedModeSignature: "default|gpt-5.4-codex|high",
    });

    expect(transition.kind).toBe("holdLocalSyncingState");
    expect(transition.nextSelectedModeKey).toBe("default");
    expect(transition.nextLastAppliedModeSignature).toBe("default|gpt-5.4-codex|high");
  });

  it("applies remote updates when synchronized hold rule does not apply", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: createRemoteConversationState("plan"),
      hasHydratedModeFromLiveState: true,
      isModeSyncing: false,
      selectedModeKey: "default",
      selectedModelId: "",
      selectedReasoningEffort: "",
    });

    expect(transition).toEqual({
      kind: "applyRemote",
      nextSelectedModeKey: "plan",
      nextSelectedModelId: REMOTE_MODEL,
      nextSelectedReasoningEffort: REMOTE_REASONING_EFFORT,
      nextHasHydratedModeFromLiveState: true,
      nextIsModeSyncing: false,
      nextLastAppliedModeSignature: "plan|gpt-5.4-codex|high",
    });
  });

  it("keeps local mode key when remote updates omit mode value", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: {
        latestCollaborationMode: {
          mode: "",
          settings: {
            model: REMOTE_MODEL,
            reasoning_effort: REMOTE_REASONING_EFFORT,
          },
        },
      },
      hasHydratedModeFromLiveState: true,
      selectedModeKey: "plan",
      selectedModelId: "",
      selectedReasoningEffort: "",
    });

    expect(transition.kind).toBe("applyRemote");
    expect(transition.nextSelectedModeKey).toBe("plan");
    expect(transition.nextSelectedModelId).toBe(REMOTE_MODEL);
    expect(transition.nextSelectedReasoningEffort).toBe(REMOTE_REASONING_EFFORT);
    expect(transition.nextLastAppliedModeSignature).toBe("plan|gpt-5.4-codex|high");
  });
});
