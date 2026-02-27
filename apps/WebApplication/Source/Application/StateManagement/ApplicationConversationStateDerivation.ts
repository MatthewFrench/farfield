import {
  type ActiveRequestSelectionInput,
  type ApplicationConversationState,
  type ApplicationPendingRequest,
  type ConversationStateSelectionInput,
} from "./UseApplicationDerivedStateContracts";

export function readConversationStateSelection(
  input: ConversationStateSelectionInput,
): ApplicationConversationState | null {
  const { liveConversationState, readConversationState, conversationSyncSignatureBuilder } = input;
  if (!liveConversationState) {
    return readConversationState;
  }
  if (!readConversationState) {
    return liveConversationState;
  }

  // Choose the newest snapshot so stream updates and read-thread fetches stay aligned.
  const liveUpdatedAt =
    conversationSyncSignatureBuilder.readConversationStateUpdatedAt(liveConversationState);
  const readUpdatedAt =
    conversationSyncSignatureBuilder.readConversationStateUpdatedAt(readConversationState);
  return liveUpdatedAt > readUpdatedAt ? liveConversationState : readConversationState;
}

export function readActiveRequestSelection(
  input: ActiveRequestSelectionInput,
): ApplicationPendingRequest | null {
  const { pendingRequests, selectedRequestId } = input;
  const firstPendingRequest = pendingRequests[0] ?? null;
  if (!firstPendingRequest) {
    return null;
  }
  if (selectedRequestId === null) {
    return firstPendingRequest;
  }
  return pendingRequests.find((request) => request.id === selectedRequestId) ?? firstPendingRequest;
}
