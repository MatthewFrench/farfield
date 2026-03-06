import { useEffect, useMemo, useRef, useState } from "react";
import { CONVERSATION_ITEM_FLATTENING_WORKER_DISPOSED_ERROR_MESSAGE } from "@/Features/Chat/StateManagement/ConversationItemFlatteningWorkerOwner";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

const INITIAL_ASYNCHRONOUS_REQUEST_SEQUENCE = 0;
const CONVERSATION_ITEM_FLATTENING_WORKER_NON_ERROR_REJECTION_MESSAGE =
  "Conversation item flattening worker failed with a non-error rejection.";
const EMPTY_CONVERSATION_ITEM_REQUEST_KEY = "";

interface UseFlatConversationItemsDerivedStateInput {
  turns: ApplicationDerivedState["turns"];
  isGenerating: boolean;
  conversationItemFlattener: UseApplicationDerivedStateInput["conversationItemFlattener"];
  conversationItemFlatteningWorkerOwner: UseApplicationDerivedStateInput["conversationItemFlatteningWorkerOwner"];
}

interface AsynchronousFlatConversationItemsState {
  requestKey: string;
  items: ApplicationDerivedState["flatConversationItems"];
}

function readConversationItemFlatteningRequestKey(input: {
  turns: ApplicationDerivedState["turns"];
  isGenerating: boolean;
}): string {
  const lastTurn = input.turns.at(-1);
  const lastTurnItem = lastTurn?.items.at(-1);
  return [
    String(input.turns.length),
    lastTurn?.id ?? "",
    lastTurn?.status ?? "",
    String(lastTurn?.items.length ?? 0),
    lastTurnItem?.id ?? "",
    lastTurnItem?.type ?? "",
    input.isGenerating ? "generating" : "idle",
  ].join("|");
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
  const currentRequestKey = readConversationItemFlatteningRequestKey({
    turns,
    isGenerating,
  });
  const [asynchronousFlatConversationItemsState, setAsynchronousFlatConversationItemsState] =
    useState<AsynchronousFlatConversationItemsState>({
      requestKey: EMPTY_CONVERSATION_ITEM_REQUEST_KEY,
      items: [],
    });
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
    const requestKey = currentRequestKey;
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
        setAsynchronousFlatConversationItemsState({
          requestKey,
          items: flattenedItems,
        });
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
  }, [conversationItemFlatteningWorkerOwner, currentRequestKey, isGenerating, turns]);

  const shouldUseInThreadFlatConversationItems =
    !conversationItemFlatteningWorkerOwner ||
    asynchronousFlatConversationItemsState.requestKey !== currentRequestKey;

  const inThreadFlatConversationItems = useMemo<
    ApplicationDerivedState["flatConversationItems"]
  >(() => {
    if (!shouldUseInThreadFlatConversationItems) {
      return [];
    }
    return conversationItemFlattener.flattenConversationItems(turns, isGenerating);
  }, [shouldUseInThreadFlatConversationItems, conversationItemFlattener, isGenerating, turns]);

  return {
    flatConversationItems: shouldUseInThreadFlatConversationItems
      ? inThreadFlatConversationItems
      : asynchronousFlatConversationItemsState.items,
    conversationItemFlatteningError: asynchronousConversationItemFlatteningError,
  };
}
