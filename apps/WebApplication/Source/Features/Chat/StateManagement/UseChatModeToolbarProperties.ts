import { useCallback, useMemo } from "react";
import { type ChatModeToolbarProps } from "@/Features/Chat/UserInterface/ChatModeToolbar";
import { ChatModeToolbarPropertiesBuilder } from "@/Features/Chat/UserInterface/ChatModeToolbarPropertiesBuilder";

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
  runningTerminalCount: number;
  setSelectedModeKey: (modeKey: string) => void;
  setSelectedModelId: (modelId: string) => void;
  setSelectedReasoningEffort: (reasoningEffort: string) => void;
  applyModeDraft: (draft: ModeDraft) => void | Promise<void>;
}

export function useChatModeToolbarProperties(
  input: UseChatModeToolbarPropertiesInput,
): ChatModeToolbarProps {
  const chatModeToolbarPropertiesBuilder = useMemo(
    () => new ChatModeToolbarPropertiesBuilder(),
    [],
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
    runningTerminalCount,
    setSelectedModeKey,
    setSelectedModelId,
    setSelectedReasoningEffort,
    applyModeDraft,
  } = input;
  const handleApplyModeDraft = useCallback(
    (draft: ModeDraft): void => {
      // Draft application owns error handling and optimistic state policy.
      void applyModeDraft(draft);
    },
    [applyModeDraft],
  );

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
        runningTerminalCount,
        onSetSelectedModeKey: setSelectedModeKey,
        onSetSelectedModelId: setSelectedModelId,
        onSetSelectedReasoningEffort: setSelectedReasoningEffort,
        onApplyModeDraft: handleApplyModeDraft,
      }),
    [
      appDefaultModel,
      appDefaultReasoningEffort,
      appDefaultValue,
      canListCollaborationModes,
      canListModels,
      canSetCollaborationMode,
      chatModeToolbarPropertiesBuilder,
      defaultModeKey,
      effortOptionsWithoutAssumedDefault,
      handleApplyModeDraft,
      isModeSyncing,
      isPlanModeEnabled,
      modelOptionsWithoutAssumedDefault,
      pendingRequestCount,
      planModeOption,
      runningTerminalCount,
      selectedModeKey,
      selectedModelId,
      selectedReasoningEffort,
      selectedThreadId,
      setSelectedModeKey,
      setSelectedModelId,
      setSelectedReasoningEffort,
    ],
  );
}
