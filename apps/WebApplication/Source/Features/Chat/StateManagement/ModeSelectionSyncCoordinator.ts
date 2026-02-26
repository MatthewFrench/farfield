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

interface ModeSelectionSyncTransitionOverrides {
  nextSelectedModeKey?: string;
  nextSelectedModelId?: string;
  nextSelectedReasoningEffort?: string;
  nextHasHydratedModeFromLiveState?: boolean;
  nextIsModeSyncing?: boolean;
  nextLastAppliedModeSignature?: string;
}

const EMPTY_MODE_KEY = "";

export class ModeSelectionSyncCoordinator {
  private readonly modeSelectionStateResolver: ModeSelectionStateResolver;

  public constructor(modeSelectionStateResolver: ModeSelectionStateResolver) {
    this.modeSelectionStateResolver = modeSelectionStateResolver;
  }

  public readTransition(input: ModeSelectionSyncInput): ModeSelectionSyncTransition {
    if (!input.conversationState) {
      return this.buildTransition(input, "noConversationState");
    }

    const remoteSelection = this.modeSelectionStateResolver.readModeSelectionFromConversationState(
      input.conversationState,
      input.appDefaultModel,
      input.appDefaultReasoningEffort
    );
    const remoteModeKey = this.readRemoteModeKey(input, remoteSelection.modeKey);
    const remoteSignature = this.modeSelectionStateResolver.buildModeSignature(
      remoteModeKey,
      remoteSelection.modelId,
      remoteSelection.reasoningEffort
    );

    if (!input.hasHydratedModeFromLiveState) {
      return this.buildTransition(input, "hydrateFromRemote", {
        nextSelectedModeKey: remoteModeKey,
        nextSelectedModelId: remoteSelection.modelId,
        nextSelectedReasoningEffort: remoteSelection.reasoningEffort,
        nextHasHydratedModeFromLiveState: true,
        nextLastAppliedModeSignature: remoteSignature
      });
    }

    const localSignature = this.modeSelectionStateResolver.buildModeSignature(
      input.selectedModeKey,
      input.selectedModelId,
      input.selectedReasoningEffort
    );
    if (remoteSignature === localSignature) {
      return this.buildTransition(input, "confirmSynchronized", {
        nextIsModeSyncing: false,
        nextLastAppliedModeSignature: remoteSignature
      });
    }

    if (
      input.isModeSyncing
      && localSignature === input.lastAppliedModeSignature
      && remoteSignature !== input.lastAppliedModeSignature
    ) {
      return this.buildTransition(input, "holdLocalSyncingState");
    }

    return this.buildTransition(input, "applyRemote", {
      nextSelectedModeKey: this.readNextSelectedModeKeyForRemoteUpdate(
        input,
        remoteSelection.modeKey,
        remoteModeKey
      ),
      nextSelectedModelId: remoteSelection.modelId,
      nextSelectedReasoningEffort: remoteSelection.reasoningEffort,
      nextIsModeSyncing: false,
      nextLastAppliedModeSignature: remoteSignature
    });
  }

  private buildTransition(
    input: ModeSelectionSyncInput,
    kind: ModeSelectionSyncTransitionKind,
    overrides?: ModeSelectionSyncTransitionOverrides
  ): ModeSelectionSyncTransition {
    return {
      kind,
      nextSelectedModeKey: overrides?.nextSelectedModeKey ?? input.selectedModeKey,
      nextSelectedModelId: overrides?.nextSelectedModelId ?? input.selectedModelId,
      nextSelectedReasoningEffort: overrides?.nextSelectedReasoningEffort ?? input.selectedReasoningEffort,
      nextHasHydratedModeFromLiveState: (
        overrides?.nextHasHydratedModeFromLiveState ?? input.hasHydratedModeFromLiveState
      ),
      nextIsModeSyncing: overrides?.nextIsModeSyncing ?? input.isModeSyncing,
      nextLastAppliedModeSignature: overrides?.nextLastAppliedModeSignature ?? input.lastAppliedModeSignature
    };
  }

  private readRemoteModeKey(input: ModeSelectionSyncInput, remoteSelectionModeKey: string): string {
    return remoteSelectionModeKey || input.selectedModeKey || input.defaultModeKey || EMPTY_MODE_KEY;
  }

  private readNextSelectedModeKeyForRemoteUpdate(
    input: ModeSelectionSyncInput,
    remoteSelectionModeKey: string,
    remoteModeKey: string
  ): string {
    if (remoteSelectionModeKey) {
      return remoteSelectionModeKey;
    }
    if (!input.selectedModeKey && remoteModeKey) {
      return remoteModeKey;
    }
    return input.selectedModeKey;
  }
}
