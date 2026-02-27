import {
  type ChatActionHandlers,
  type UseChatActionHandlersInput,
  useChatActionHandlers,
} from "@/Features/Chat/StateManagement/UseChatActionHandlers";
import { useChatModeToolbarProperties } from "@/Features/Chat/StateManagement/UseChatModeToolbarProperties";
import {
  type UseChatScrollEffectsInput,
  useChatScrollEffects,
} from "@/Features/Chat/StateManagement/UseChatScrollEffects";
import { type ChatModeToolbarProps } from "@/Features/Chat/UserInterface/ChatModeToolbar";

interface PlanModeOption {
  mode?: string | null | undefined;
}

interface ChatModelOption {
  id: string;
  label: string;
}

export interface UseApplicationChatFeatureCompositionInput {
  chatScrollEffectsInput: UseChatScrollEffectsInput;
  chatActionHandlersInput: UseChatActionHandlersInput;
  chatModeToolbarPropertiesInput: UseApplicationChatModeToolbarPropertiesInput;
}

export interface UseApplicationChatModeToolbarPropertiesInput {
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
  modelOptionsWithoutAssumedDefault: ChatModelOption[];
  effortOptionsWithoutAssumedDefault: string[];
  isModeSyncing: boolean;
  pendingRequestCount: number;
  setSelectedModeKey: (modeKey: string) => void;
  setSelectedModelId: (modelId: string) => void;
  setSelectedReasoningEffort: (reasoningEffort: string) => void;
}

export interface ApplicationChatFeatureComposition extends ChatActionHandlers {
  chatModeToolbarProperties: ChatModeToolbarProps;
}

export function useApplicationChatFeatureComposition(
  input: UseApplicationChatFeatureCompositionInput,
): ApplicationChatFeatureComposition {
  const { chatScrollEffectsInput, chatActionHandlersInput, chatModeToolbarPropertiesInput } = input;

  useChatScrollEffects(chatScrollEffectsInput);

  const chatActionHandlers = useChatActionHandlers(chatActionHandlersInput);
  const chatModeToolbarProperties = useChatModeToolbarProperties({
    canSetCollaborationMode: chatModeToolbarPropertiesInput.canSetCollaborationMode,
    canListCollaborationModes: chatModeToolbarPropertiesInput.canListCollaborationModes,
    canListModels: chatModeToolbarPropertiesInput.canListModels,
    planModeOption: chatModeToolbarPropertiesInput.planModeOption,
    defaultModeKey: chatModeToolbarPropertiesInput.defaultModeKey,
    isPlanModeEnabled: chatModeToolbarPropertiesInput.isPlanModeEnabled,
    selectedThreadId: chatModeToolbarPropertiesInput.selectedThreadId,
    appDefaultValue: chatModeToolbarPropertiesInput.appDefaultValue,
    appDefaultModel: chatModeToolbarPropertiesInput.appDefaultModel,
    appDefaultReasoningEffort: chatModeToolbarPropertiesInput.appDefaultReasoningEffort,
    selectedModelId: chatModeToolbarPropertiesInput.selectedModelId,
    selectedReasoningEffort: chatModeToolbarPropertiesInput.selectedReasoningEffort,
    selectedModeKey: chatModeToolbarPropertiesInput.selectedModeKey,
    modelOptionsWithoutAssumedDefault:
      chatModeToolbarPropertiesInput.modelOptionsWithoutAssumedDefault,
    effortOptionsWithoutAssumedDefault:
      chatModeToolbarPropertiesInput.effortOptionsWithoutAssumedDefault,
    isModeSyncing: chatModeToolbarPropertiesInput.isModeSyncing,
    pendingRequestCount: chatModeToolbarPropertiesInput.pendingRequestCount,
    setSelectedModeKey: chatModeToolbarPropertiesInput.setSelectedModeKey,
    setSelectedModelId: chatModeToolbarPropertiesInput.setSelectedModelId,
    setSelectedReasoningEffort: chatModeToolbarPropertiesInput.setSelectedReasoningEffort,
    applyModeDraft: chatActionHandlers.applyModeDraft,
  });

  return {
    ...chatActionHandlers,
    chatModeToolbarProperties,
  };
}
