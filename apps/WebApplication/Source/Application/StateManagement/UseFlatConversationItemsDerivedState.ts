import { useEffect, useMemo, useRef, useState } from "react";
import { CONVERSATION_ITEM_FLATTENING_WORKER_DISPOSED_ERROR_MESSAGE } from "@/Features/Chat/StateManagement/ConversationItemFlatteningWorkerOwner";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

const INITIAL_ASYNCHRONOUS_REQUEST_SEQUENCE = 0;
const CONVERSATION_ITEM_FLATTENING_WORKER_NON_ERROR_REJECTION_MESSAGE =
  "Conversation item flattening worker failed with a non-error rejection.";

interface UseFlatConversationItemsDerivedStateInput {
  turns: ApplicationDerivedState["turns"];
  isGenerating: boolean;
  conversationItemFlattener: UseApplicationDerivedStateInput["conversationItemFlattener"];
  conversationItemFlatteningWorkerOwner: UseApplicationDerivedStateInput["conversationItemFlatteningWorkerOwner"];
}

export function useFlatConversationItemsDerivedState(
  input: UseFlatConversationItemsDerivedStateInput,
): {
  flatConversationItems: ApplicationDerivedState["flatConversationItems"];
  conversationItemFlatteningError: Error | null;
} {
  const { turns, isGenerating, conversationItemFlattener, conversationItemFlatteningWorkerOwner } =
    input;
  const conversationItemFlatteningRequestSequenceReference = useRef<number>(
    INITIAL_ASYNCHRONOUS_REQUEST_SEQUENCE,
  );
  const [asynchronousFlatConversationItems, setAsynchronousFlatConversationItems] = useState<
    ApplicationDerivedState["flatConversationItems"]
  >([]);
  const [
    asynchronousConversationItemFlatteningError,
    setAsynchronousConversationItemFlatteningError,
  ] = useState<Error | null>(null);

  useEffect(() => {
    if (!conversationItemFlatteningWorkerOwner) {
      return;
    }

    const requestSequence = conversationItemFlatteningRequestSequenceReference.current + 1;
    conversationItemFlatteningRequestSequenceReference.current = requestSequence;
    let isDisposed = false;

    void conversationItemFlatteningWorkerOwner
      .readFlattenedConversationItems({
        turns,
        isGenerating,
      })
      .then((flattenedItems) => {
        if (
          isDisposed ||
          conversationItemFlatteningRequestSequenceReference.current !== requestSequence
        ) {
          return;
        }
        setAsynchronousConversationItemFlatteningError(null);
        setAsynchronousFlatConversationItems(flattenedItems);
      })
      .catch((error) => {
        if (
          isDisposed ||
          conversationItemFlatteningRequestSequenceReference.current !== requestSequence
        ) {
          return;
        }
        if (error instanceof Error) {
          if (error.message === CONVERSATION_ITEM_FLATTENING_WORKER_DISPOSED_ERROR_MESSAGE) {
            return;
          }
          setAsynchronousConversationItemFlatteningError(error);
          return;
        }
        setAsynchronousConversationItemFlatteningError(
          new Error(CONVERSATION_ITEM_FLATTENING_WORKER_NON_ERROR_REJECTION_MESSAGE),
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [conversationItemFlatteningWorkerOwner, isGenerating, turns]);

  const inThreadFlatConversationItems = useMemo<
    ApplicationDerivedState["flatConversationItems"] | null
  >(() => {
    if (conversationItemFlatteningWorkerOwner) {
      return null;
    }
    return conversationItemFlattener.flattenConversationItems(turns, isGenerating);
  }, [conversationItemFlatteningWorkerOwner, conversationItemFlattener, isGenerating, turns]);

  return {
    flatConversationItems: inThreadFlatConversationItems ?? asynchronousFlatConversationItems,
    conversationItemFlatteningError: asynchronousConversationItemFlatteningError,
  };
}
