import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import {
  type ApplicationChatSurfaceState,
  type ApplicationThreadListState,
  type ChatSurfaceStateInput,
  type SelectedThreadLabelInput,
  type ThreadListStateInput,
} from "./UseApplicationDerivedStateContracts";

const LOADING_THREAD_LABEL = "Loading thread...";
const NO_THREAD_SELECTED_LABEL = "No thread selected";

export function readSelectedThreadLabel(input: SelectedThreadLabelInput): string {
  const { selectedThread, selectedThreadId, isSelectedThreadLoading } = input;
  if (selectedThread) {
    return ThreadGroupSelectors.threadLabel(selectedThread);
  }
  if (selectedThreadId !== null && selectedThreadId.length > 0 && isSelectedThreadLoading) {
    return LOADING_THREAD_LABEL;
  }
  return NO_THREAD_SELECTED_LABEL;
}

export function readThreadListState(input: ThreadListStateInput): ApplicationThreadListState {
  const { isCoreLoading, threadCount } = input;
  if (isCoreLoading && threadCount === 0) {
    return "loading";
  }
  if (threadCount === 0) {
    return "empty";
  }
  return "ready";
}

export function readChatSurfaceState(input: ChatSurfaceStateInput): ApplicationChatSurfaceState {
  const { selectedThreadId, isCoreLoading, isSelectedThreadLoading, turnCount } = input;
  const hasSelectedThread = selectedThreadId !== null && selectedThreadId.length > 0;
  if (!hasSelectedThread && isCoreLoading) {
    return "loading-threads";
  }
  if (hasSelectedThread && isSelectedThreadLoading) {
    return "loading-thread";
  }
  if (turnCount === 0) {
    return hasSelectedThread ? "no-messages" : "no-thread";
  }
  return "ready";
}
