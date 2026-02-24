import { describe, expect, it } from "vitest";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import {
  ModeSelectionSyncCoordinator,
  type ModeSelectionSyncInput
} from "../Source/Features/Chat/StateManagement/ModeSelectionSyncCoordinator";

function createCoordinator(): ModeSelectionSyncCoordinator {
  return new ModeSelectionSyncCoordinator(new ModeSelectionStateResolver());
}

function createBaseInput(): ModeSelectionSyncInput {
  return {
    conversationState: null,
    appDefaultModel: "gpt-5.3-codex",
    appDefaultReasoningEffort: "medium",
    defaultModeKey: "default",
    selectedModeKey: "default",
    selectedModelId: "",
    selectedReasoningEffort: "",
    hasHydratedModeFromLiveState: false,
    isModeSyncing: false,
    lastAppliedModeSignature: ""
  };
}

describe("ModeSelectionSyncCoordinator", () => {
  it("returns noConversationState transition when conversation state is absent", () => {
    const coordinator = createCoordinator();

    const transition = coordinator.readTransition(createBaseInput());

    expect(transition.kind).toBe("noConversationState");
    expect(transition.nextSelectedModeKey).toBe("default");
    expect(transition.nextHasHydratedModeFromLiveState).toBe(false);
  });

  it("hydrates mode state from remote conversation selection", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: {
        latestCollaborationMode: {
          mode: "plan",
          settings: {
            model: "gpt-5.4-codex",
            reasoning_effort: "high"
          }
        }
      }
    });

    expect(transition).toEqual({
      kind: "hydrateFromRemote",
      nextSelectedModeKey: "plan",
      nextSelectedModelId: "gpt-5.4-codex",
      nextSelectedReasoningEffort: "high",
      nextHasHydratedModeFromLiveState: true,
      nextIsModeSyncing: false,
      nextLastAppliedModeSignature: "plan|gpt-5.4-codex|high"
    });
  });

  it("confirms synchronized state and clears syncing flag", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: {
        latestCollaborationMode: {
          mode: "default",
          settings: {
            model: "gpt-5.4-codex",
            reasoning_effort: "high"
          }
        }
      },
      hasHydratedModeFromLiveState: true,
      isModeSyncing: true,
      selectedModeKey: "default",
      selectedModelId: "gpt-5.4-codex",
      selectedReasoningEffort: "high"
    });

    expect(transition.kind).toBe("confirmSynchronized");
    expect(transition.nextIsModeSyncing).toBe(false);
    expect(transition.nextLastAppliedModeSignature).toBe("default|gpt-5.4-codex|high");
  });

  it("holds local state while waiting for mode-sync request confirmation", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: {
        latestCollaborationMode: {
          mode: "plan",
          settings: {
            model: "gpt-5.4-codex",
            reasoning_effort: "high"
          }
        }
      },
      hasHydratedModeFromLiveState: true,
      isModeSyncing: true,
      selectedModeKey: "default",
      selectedModelId: "gpt-5.4-codex",
      selectedReasoningEffort: "high",
      lastAppliedModeSignature: "default|gpt-5.4-codex|high"
    });

    expect(transition.kind).toBe("holdLocalSyncingState");
    expect(transition.nextSelectedModeKey).toBe("default");
    expect(transition.nextLastAppliedModeSignature).toBe("default|gpt-5.4-codex|high");
  });

  it("applies remote updates when synchronized hold rule does not apply", () => {
    const coordinator = createCoordinator();
    const transition = coordinator.readTransition({
      ...createBaseInput(),
      conversationState: {
        latestCollaborationMode: {
          mode: "plan",
          settings: {
            model: "gpt-5.4-codex",
            reasoning_effort: "high"
          }
        }
      },
      hasHydratedModeFromLiveState: true,
      isModeSyncing: false,
      selectedModeKey: "default",
      selectedModelId: "",
      selectedReasoningEffort: ""
    });

    expect(transition).toEqual({
      kind: "applyRemote",
      nextSelectedModeKey: "plan",
      nextSelectedModelId: "gpt-5.4-codex",
      nextSelectedReasoningEffort: "high",
      nextHasHydratedModeFromLiveState: true,
      nextIsModeSyncing: false,
      nextLastAppliedModeSignature: "plan|gpt-5.4-codex|high"
    });
  });
});
