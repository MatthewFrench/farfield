import { useMemo } from "react";
import { type ChatModeToolbarProps } from "@/Features/Chat/UserInterface/ChatModeToolbar";
import {
  ChatModeToolbarPropertiesBuilder
} from "@/Features/Chat/UserInterface/ChatModeToolbarPropertiesBuilder";

interface PlanModeOption {
  mode?: string | null | undefined;
}

interface ModeDraft {
  modeKey: string;
  modelId: string;
  reasoningEffort: string;
}

export interface UseChatModeToolbarPropertiesInput {
  canSetCollaborationMode: boolean;
  canListCollaborationModes: boolean;
  canListModels: boolean;
  planModeOption: PlanModeOption | null;
  defaultModeKey: string | null;
  isPlanModeEnabled: boolean;
  selectedThreadId: string | null;
  appDefaultValue: string;
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  selectedModelId: string;
  selectedReasoningEffort: string;
  selectedModeKey: string;
  modelOptionsWithoutAssumedDefault: { id: string; label: string }[];
  effortOptionsWithoutAssumedDefault: string[];
  isModeSyncing: boolean;
  pendingRequestCount: number;
  setSelectedModeKey: (modeKey: string) => void;
  setSelectedModelId: (modelId: string) => void;
  setSelectedReasoningEffort: (reasoningEffort: string) => void;
  applyModeDraft: (draft: ModeDraft) => void | Promise<void>;
}

export function useChatModeToolbarProperties(
  input: UseChatModeToolbarPropertiesInput
): ChatModeToolbarProps {
  const chatModeToolbarPropertiesBuilder = useMemo(
    () => new ChatModeToolbarPropertiesBuilder(),
    []
  );
  const {
    canSetCollaborationMode,
    canListCollaborationModes,
    canListModels,
    planModeOption,
    defaultModeKey,
    isPlanModeEnabled,
    selectedThreadId,
    appDefaultValue,
    appDefaultModel,
    appDefaultReasoningEffort,
    selectedModelId,
    selectedReasoningEffort,
    selectedModeKey,
    modelOptionsWithoutAssumedDefault,
    effortOptionsWithoutAssumedDefault,
    isModeSyncing,
    pendingRequestCount,
    setSelectedModeKey,
    setSelectedModelId,
    setSelectedReasoningEffort,
    applyModeDraft
  } = input;

  return useMemo<ChatModeToolbarProps>(
    () =>
      chatModeToolbarPropertiesBuilder.build({
        canSetCollaborationMode,
        canListCollaborationModes,
        canListModels,
        planModeOption,
        defaultModeKey,
        isPlanModeEnabled,
        selectedThreadId,
        appDefaultValue,
        appDefaultModel,
        appDefaultReasoningEffort,
        selectedModelId,
        selectedReasoningEffort,
        selectedModeKey,
        modelOptionsWithoutAssumedDefault,
        effortOptionsWithoutAssumedDefault,
        isModeSyncing,
        pendingRequestCount,
        onSetSelectedModeKey: (modeKey) => {
          setSelectedModeKey(modeKey);
        },
        onSetSelectedModelId: (modelId) => {
          setSelectedModelId(modelId);
        },
        onSetSelectedReasoningEffort: (reasoningEffort) => {
          setSelectedReasoningEffort(reasoningEffort);
        },
        onApplyModeDraft: (draft) => {
          void applyModeDraft(draft);
        }
      }),
    [
      appDefaultModel,
      appDefaultReasoningEffort,
      appDefaultValue,
      applyModeDraft,
      canListCollaborationModes,
      canListModels,
      canSetCollaborationMode,
      chatModeToolbarPropertiesBuilder,
      defaultModeKey,
      effortOptionsWithoutAssumedDefault,
      isModeSyncing,
      isPlanModeEnabled,
      modelOptionsWithoutAssumedDefault,
      pendingRequestCount,
      planModeOption,
      selectedModeKey,
      selectedModelId,
      selectedReasoningEffort,
      selectedThreadId,
      setSelectedModeKey,
      setSelectedModelId,
      setSelectedReasoningEffort
    ]
  );
}
