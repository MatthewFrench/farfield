import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import {
  createEmptyPendingUserInputAnswerDraft,
  type PendingUserInputAnswerDraftByQuestionId
} from "../DomainModel/PendingUserInputAnswerBuilder";
import type { ModeSelectionConversationState } from "../DomainModel/ModeSelectionStateResolver";
import { type PendingUserInputRequest } from "../DomainModel/PendingUserInputRequestSelector";
import { ModeSelectionSyncCoordinator } from "./ModeSelectionSyncCoordinator";

export interface UseModeAndPendingRequestEffectsInput {
  activeRequest: PendingUserInputRequest | null;
  setSelectedRequestId: Dispatch<SetStateAction<number | null>>;
  setAnswerDraft: Dispatch<SetStateAction<PendingUserInputAnswerDraftByQuestionId>>;
  modeSelectionSyncCoordinator: ModeSelectionSyncCoordinator;
  conversationState: ModeSelectionConversationState | null;
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  defaultModeKey: string;
  selectedModeKey: string;
  selectedModelId: string;
  selectedReasoningEffort: string;
  hasHydratedModeFromLiveState: boolean;
  isModeSyncing: boolean;
  lastAppliedModeSignatureRef: MutableRefObject<string>;
  setSelectedModeKey: Dispatch<SetStateAction<string>>;
  setSelectedModelId: Dispatch<SetStateAction<string>>;
  setSelectedReasoningEffort: Dispatch<SetStateAction<string>>;
  setHasHydratedModeFromLiveState: Dispatch<SetStateAction<boolean>>;
  setIsModeSyncing: Dispatch<SetStateAction<boolean>>;
  selectedThreadId: string | null;
}

export function useModeAndPendingRequestEffects(input: UseModeAndPendingRequestEffectsInput): void {
  useEffect(() => {
    const activeRequest = input.activeRequest;
    if (!activeRequest) {
      input.setSelectedRequestId(null);
      input.setAnswerDraft({});
      return;
    }

    input.setSelectedRequestId((currentRequestId) => currentRequestId ?? activeRequest.id);
    input.setAnswerDraft((previousAnswerDraft) => {
      const nextAnswerDraft: PendingUserInputAnswerDraftByQuestionId = {};
      for (const question of activeRequest.params.questions) {
        nextAnswerDraft[question.id] = (
          previousAnswerDraft[question.id] ?? createEmptyPendingUserInputAnswerDraft()
        );
      }
      return nextAnswerDraft;
    });
  }, [input.activeRequest, input.setAnswerDraft, input.setSelectedRequestId]);

  useEffect(() => {
    const transition = input.modeSelectionSyncCoordinator.readTransition({
      conversationState: input.conversationState,
      appDefaultModel: input.appDefaultModel,
      appDefaultReasoningEffort: input.appDefaultReasoningEffort,
      defaultModeKey: input.defaultModeKey,
      selectedModeKey: input.selectedModeKey,
      selectedModelId: input.selectedModelId,
      selectedReasoningEffort: input.selectedReasoningEffort,
      hasHydratedModeFromLiveState: input.hasHydratedModeFromLiveState,
      isModeSyncing: input.isModeSyncing,
      lastAppliedModeSignature: input.lastAppliedModeSignatureRef.current
    });

    if (
      transition.kind === "noConversationState"
      || transition.kind === "holdLocalSyncingState"
    ) {
      return;
    }

    if (transition.nextSelectedModeKey !== input.selectedModeKey) {
      input.setSelectedModeKey(transition.nextSelectedModeKey);
    }
    if (transition.nextSelectedModelId !== input.selectedModelId) {
      input.setSelectedModelId(transition.nextSelectedModelId);
    }
    if (transition.nextSelectedReasoningEffort !== input.selectedReasoningEffort) {
      input.setSelectedReasoningEffort(transition.nextSelectedReasoningEffort);
    }
    if (transition.nextLastAppliedModeSignature !== input.lastAppliedModeSignatureRef.current) {
      input.lastAppliedModeSignatureRef.current = transition.nextLastAppliedModeSignature;
    }
    if (transition.nextHasHydratedModeFromLiveState !== input.hasHydratedModeFromLiveState) {
      input.setHasHydratedModeFromLiveState(transition.nextHasHydratedModeFromLiveState);
    }
    if (transition.nextIsModeSyncing !== input.isModeSyncing) {
      input.setIsModeSyncing(transition.nextIsModeSyncing);
    }
  }, [
    input.appDefaultModel,
    input.appDefaultReasoningEffort,
    input.conversationState,
    input.defaultModeKey,
    input.hasHydratedModeFromLiveState,
    input.isModeSyncing,
    input.lastAppliedModeSignatureRef,
    input.modeSelectionSyncCoordinator,
    input.selectedModeKey,
    input.selectedModelId,
    input.selectedReasoningEffort,
    input.setHasHydratedModeFromLiveState,
    input.setIsModeSyncing,
    input.setSelectedModeKey,
    input.setSelectedModelId,
    input.setSelectedReasoningEffort
  ]);

  useEffect(() => {
    input.lastAppliedModeSignatureRef.current = "";
    input.setHasHydratedModeFromLiveState(false);
    input.setIsModeSyncing(false);
  }, [
    input.lastAppliedModeSignatureRef,
    input.selectedThreadId,
    input.setHasHydratedModeFromLiveState,
    input.setIsModeSyncing
  ]);
}
