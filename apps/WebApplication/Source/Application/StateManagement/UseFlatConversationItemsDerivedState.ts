import { useMemo } from "react";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

interface UseFlatConversationItemsDerivedStateInput {
  turns: ApplicationDerivedState["turns"];
  isGenerating: boolean;
  visibleChatItemLimit: number;
  conversationItemFlattener: UseApplicationDerivedStateInput["conversationItemFlattener"];
}

export function useFlatConversationItemsDerivedState(
  input: UseFlatConversationItemsDerivedStateInput,
): {
  conversationItemCount: number;
  visibleConversationItems: ApplicationDerivedState["visibleConversationItems"];
  conversationItemFlatteningError: Error | null;
} {
  const visibleConversationItemsResult = useMemo(
    () =>
      input.conversationItemFlattener.readVisibleConversationItems(
        input.turns,
        input.isGenerating,
        input.visibleChatItemLimit,
      ),
    [input.conversationItemFlattener, input.isGenerating, input.turns, input.visibleChatItemLimit],
  );

  return {
    conversationItemCount: visibleConversationItemsResult.conversationItemCount,
    visibleConversationItems: visibleConversationItemsResult.visibleItems,
    conversationItemFlatteningError: null,
  };
}
