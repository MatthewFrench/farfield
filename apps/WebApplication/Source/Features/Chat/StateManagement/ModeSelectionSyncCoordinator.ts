import type { ModeSelectionConversationState } from "../DomainModel/ModeSelectionStateResolver";
import { ModeSelectionStateResolver } from "../DomainModel/ModeSelectionStateResolver";

export interface ModeSelectionSyncInput {
  conversationState: ModeSelectionConversationState | null;
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  defaultModeKey: string;
  selectedModeKey: string;
  selectedModelId: string;
  selectedReasoningEffort: string;
  hasHydratedModeFromLiveState: boolean;
  isModeSyncing: boolean;
  lastAppliedModeSignature: string;
}

export type ModeSelectionSyncTransitionKind =
  | "noConversationState"
  | "hydrateFromRemote"
  | "confirmSynchronized"
  | "holdLocalSyncingState"
  | "applyRemote";

export interface ModeSelectionSyncTransition {
  kind: ModeSelectionSyncTransitionKind;
  nextSelectedModeKey: string;
  nextSelectedModelId: string;
  nextSelectedReasoningEffort: string;
  nextHasHydratedModeFromLiveState: boolean;
  nextIsModeSyncing: boolean;
  nextLastAppliedModeSignature: string;
}

export class ModeSelectionSyncCoordinator {
  private readonly modeSelectionStateResolver: ModeSelectionStateResolver;

  public constructor(modeSelectionStateResolver: ModeSelectionStateResolver) {
    this.modeSelectionStateResolver = modeSelectionStateResolver;
  }

  public readTransition(input: ModeSelectionSyncInput): ModeSelectionSyncTransition {
    if (!input.conversationState) {
      return {
        kind: "noConversationState",
        nextSelectedModeKey: input.selectedModeKey,
        nextSelectedModelId: input.selectedModelId,
        nextSelectedReasoningEffort: input.selectedReasoningEffort,
        nextHasHydratedModeFromLiveState: input.hasHydratedModeFromLiveState,
        nextIsModeSyncing: input.isModeSyncing,
        nextLastAppliedModeSignature: input.lastAppliedModeSignature
      };
    }

    const remoteSelection = this.modeSelectionStateResolver.readModeSelectionFromConversationState(
      input.conversationState,
      input.appDefaultModel,
      input.appDefaultReasoningEffort
    );
    const remoteModeKey = remoteSelection.modeKey || input.selectedModeKey || input.defaultModeKey || "";
    const remoteSignature = this.modeSelectionStateResolver.buildModeSignature(
      remoteModeKey,
      remoteSelection.modelId,
      remoteSelection.reasoningEffort
    );

    if (!input.hasHydratedModeFromLiveState) {
      return {
        kind: "hydrateFromRemote",
        nextSelectedModeKey: remoteModeKey || input.selectedModeKey,
        nextSelectedModelId: remoteSelection.modelId,
        nextSelectedReasoningEffort: remoteSelection.reasoningEffort,
        nextHasHydratedModeFromLiveState: true,
        nextIsModeSyncing: input.isModeSyncing,
        nextLastAppliedModeSignature: remoteSignature
      };
    }

    const localSignature = this.modeSelectionStateResolver.buildModeSignature(
      input.selectedModeKey,
      input.selectedModelId,
      input.selectedReasoningEffort
    );
    if (remoteSignature === localSignature) {
      return {
        kind: "confirmSynchronized",
        nextSelectedModeKey: input.selectedModeKey,
        nextSelectedModelId: input.selectedModelId,
        nextSelectedReasoningEffort: input.selectedReasoningEffort,
        nextHasHydratedModeFromLiveState: input.hasHydratedModeFromLiveState,
        nextIsModeSyncing: false,
        nextLastAppliedModeSignature: remoteSignature
      };
    }

    if (
      input.isModeSyncing
      && localSignature === input.lastAppliedModeSignature
      && remoteSignature !== input.lastAppliedModeSignature
    ) {
      return {
        kind: "holdLocalSyncingState",
        nextSelectedModeKey: input.selectedModeKey,
        nextSelectedModelId: input.selectedModelId,
        nextSelectedReasoningEffort: input.selectedReasoningEffort,
        nextHasHydratedModeFromLiveState: input.hasHydratedModeFromLiveState,
        nextIsModeSyncing: input.isModeSyncing,
        nextLastAppliedModeSignature: input.lastAppliedModeSignature
      };
    }

    const nextSelectedModeKey = remoteSelection.modeKey
      ? remoteSelection.modeKey
      : (!input.selectedModeKey && remoteModeKey ? remoteModeKey : input.selectedModeKey);

    return {
      kind: "applyRemote",
      nextSelectedModeKey,
      nextSelectedModelId: remoteSelection.modelId,
      nextSelectedReasoningEffort: remoteSelection.reasoningEffort,
      nextHasHydratedModeFromLiveState: input.hasHydratedModeFromLiveState,
      nextIsModeSyncing: false,
      nextLastAppliedModeSignature: remoteSignature
    };
  }
}
