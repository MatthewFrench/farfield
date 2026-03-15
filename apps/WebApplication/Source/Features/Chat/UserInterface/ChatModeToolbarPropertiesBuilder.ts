import { type ChatModeToolbarProps } from "@/Features/Chat/UserInterface/ChatModeToolbar";

interface ModeDraftInput {
  modeKey: string;
  modelId: string;
  reasoningEffort: string;
}

interface ModeDraftOverrides {
  modeKey?: string;
  modelId?: string;
  reasoningEffort?: string;
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
  runningTerminalCount: number;
  onSetSelectedModeKey: (modeKey: string) => void;
  onSetSelectedModelId: (modelId: string) => void;
  onSetSelectedReasoningEffort: (reasoningEffort: string) => void;
  onApplyModeDraft: (draft: ModeDraftInput) => void;
}

const EMPTY_MODE_KEY = "";

function readEffectiveModeKey(input: BuildChatModeToolbarPropertiesInput): string {
  if (input.selectedModeKey.length > 0) {
    return input.selectedModeKey;
  }
  return input.defaultModeKey ?? EMPTY_MODE_KEY;
}

export class ChatModeToolbarPropertiesBuilder {
  public build(input: BuildChatModeToolbarPropertiesInput): ChatModeToolbarProps {
    const applyModeDraft = (modeDraftOverrides: ModeDraftOverrides): void => {
      input.onApplyModeDraft(this.buildModeDraft(input, modeDraftOverrides));
    };

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
      runningTerminalCount: input.runningTerminalCount,
      onTogglePlanMode: () => {
        const nextModeKey = this.readNextModeKeyForPlanToggle(input);
        if (nextModeKey.length === 0) {
          return;
        }
        input.onSetSelectedModeKey(nextModeKey);
        applyModeDraft({ modeKey: nextModeKey });
      },
      onModelChange: (nextModelId) => {
        input.onSetSelectedModelId(nextModelId);
        applyModeDraft({ modelId: nextModelId });
      },
      onReasoningEffortChange: (nextReasoningEffort) => {
        input.onSetSelectedReasoningEffort(nextReasoningEffort);
        applyModeDraft({ reasoningEffort: nextReasoningEffort });
      },
    };
  }

  private readNextModeKeyForPlanToggle(input: BuildChatModeToolbarPropertiesInput): string {
    if (input.isPlanModeEnabled) {
      return input.defaultModeKey ?? input.selectedModeKey;
    }
    return input.planModeOption?.mode ?? EMPTY_MODE_KEY;
  }

  private buildModeDraft(
    input: BuildChatModeToolbarPropertiesInput,
    modeDraftOverrides: ModeDraftOverrides,
  ): ModeDraftInput {
    return {
      modeKey: modeDraftOverrides.modeKey ?? readEffectiveModeKey(input),
      modelId: modeDraftOverrides.modelId ?? input.selectedModelId,
      reasoningEffort: modeDraftOverrides.reasoningEffort ?? input.selectedReasoningEffort,
    };
  }
}
