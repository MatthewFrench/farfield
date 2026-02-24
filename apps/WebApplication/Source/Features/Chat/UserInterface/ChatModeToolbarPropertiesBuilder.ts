import { type ChatModeToolbarProps } from "@/Features/Chat/UserInterface/ChatModeToolbar";

interface ModeDraftInput {
  modeKey: string;
  modelId: string;
  reasoningEffort: string;
}

interface PlanModeOption {
  mode?: string | null | undefined;
}

export interface BuildChatModeToolbarPropertiesInput {
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
  onSetSelectedModeKey: (modeKey: string) => void;
  onSetSelectedModelId: (modelId: string) => void;
  onSetSelectedReasoningEffort: (reasoningEffort: string) => void;
  onApplyModeDraft: (draft: ModeDraftInput) => void;
}

export class ChatModeToolbarPropertiesBuilder {
  public build(input: BuildChatModeToolbarPropertiesInput): ChatModeToolbarProps {
    return {
      canSetCollaborationMode: input.canSetCollaborationMode,
      canListCollaborationModes: input.canListCollaborationModes,
      canListModels: input.canListModels,
      hasPlanModeOption: input.planModeOption !== null,
      isPlanModeEnabled: input.isPlanModeEnabled,
      selectedThreadId: input.selectedThreadId,
      appDefaultValue: input.appDefaultValue,
      appDefaultModel: input.appDefaultModel,
      appDefaultReasoningEffort: input.appDefaultReasoningEffort,
      selectedModelId: input.selectedModelId,
      selectedReasoningEffort: input.selectedReasoningEffort,
      selectedModeKey: input.selectedModeKey,
      modelOptionsWithoutAssumedDefault: input.modelOptionsWithoutAssumedDefault,
      effortOptionsWithoutAssumedDefault: input.effortOptionsWithoutAssumedDefault,
      isModeSyncing: input.isModeSyncing,
      pendingRequestCount: input.pendingRequestCount,
      onTogglePlanMode: () => {
        const nextModeKey = input.isPlanModeEnabled
          ? (input.defaultModeKey ?? input.selectedModeKey)
          : (input.planModeOption?.mode ?? "");
        if (!nextModeKey) {
          return;
        }
        input.onSetSelectedModeKey(nextModeKey);
        input.onApplyModeDraft({
          modeKey: nextModeKey,
          modelId: input.selectedModelId,
          reasoningEffort: input.selectedReasoningEffort
        });
      },
      onModelChange: (nextModelId) => {
        input.onSetSelectedModelId(nextModelId);
        input.onApplyModeDraft({
          modeKey: input.selectedModeKey,
          modelId: nextModelId,
          reasoningEffort: input.selectedReasoningEffort
        });
      },
      onReasoningEffortChange: (nextReasoningEffort) => {
        input.onSetSelectedReasoningEffort(nextReasoningEffort);
        input.onApplyModeDraft({
          modeKey: input.selectedModeKey,
          modelId: input.selectedModelId,
          reasoningEffort: nextReasoningEffort
        });
      }
    };
  }
}
