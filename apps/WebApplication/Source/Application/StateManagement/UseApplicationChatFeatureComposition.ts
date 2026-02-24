import {
  type ChatActionHandlers,
  type UseChatActionHandlersInput,
  useChatActionHandlers
} from "@/Features/Chat/StateManagement/UseChatActionHandlers";
import {
  type UseChatScrollEffectsInput,
  useChatScrollEffects
} from "@/Features/Chat/StateManagement/UseChatScrollEffects";
import {
  useChatModeToolbarProperties
} from "@/Features/Chat/StateManagement/UseChatModeToolbarProperties";
import { type ChatModeToolbarProps } from "@/Features/Chat/UserInterface/ChatModeToolbar";

export interface UseApplicationChatFeatureCompositionInput {
  chatScrollEffectsInput: UseChatScrollEffectsInput;
  chatActionHandlersInput: UseChatActionHandlersInput;
  chatModeToolbarPropertiesInput: UseApplicationChatModeToolbarPropertiesInput;
}

export interface UseApplicationChatModeToolbarPropertiesInput {
  canSetCollaborationMode: boolean;
  canListCollaborationModes: boolean;
  canListModels: boolean;
  planModeOption: { mode?: string | null | undefined } | null;
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
}

export interface ApplicationChatFeatureComposition extends ChatActionHandlers {
  chatModeToolbarProperties: ChatModeToolbarProps;
}

export function useApplicationChatFeatureComposition(
  input: UseApplicationChatFeatureCompositionInput
): ApplicationChatFeatureComposition {
  useChatScrollEffects(input.chatScrollEffectsInput);

  const chatActionHandlers = useChatActionHandlers(input.chatActionHandlersInput);
  const chatModeToolbarProperties = useChatModeToolbarProperties({
    ...input.chatModeToolbarPropertiesInput,
    applyModeDraft: chatActionHandlers.applyModeDraft
  });

  return {
    ...chatActionHandlers,
    chatModeToolbarProperties
  };
}
