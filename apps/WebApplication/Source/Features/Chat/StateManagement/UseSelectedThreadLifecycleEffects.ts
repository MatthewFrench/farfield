import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { isThreadNotLoadedReadError } from "@/Features/Chat/DomainModel/ReadThreadErrorClassifier";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import type {
  ChatLiveStateResponse,
  ChatReadThreadResponse,
  ChatStreamEventsResponse
} from "../DataAccess/ChatServerClient";
import { SelectedThreadRefreshConcurrencyCoordinator } from "./SelectedThreadRefreshConcurrencyCoordinator";
import type { LoadSelectedThreadOptions } from "./UseSelectedThreadLoaders";

export interface UseSelectedThreadLifecycleEffectsInput {
  selectedThreadId: string | null;
  selectedThreadIdRef: MutableRefObject<string | null>;
  selectedThreadLoadTokenRef: MutableRefObject<number>;
  loadSelectedThreadRef: MutableRefObject<((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null>;
  selectedThreadRefreshConcurrencyCoordinator: SelectedThreadRefreshConcurrencyCoordinator;
  setLiveState: Dispatch<SetStateAction<ChatLiveStateResponse | null>>;
  setReadThreadState: Dispatch<SetStateAction<ChatReadThreadResponse | null>>;
  setStreamEvents: Dispatch<SetStateAction<ChatStreamEventsResponse["events"]>>;
  setIsSelectedThreadLoading: Dispatch<SetStateAction<boolean>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  handleRuntimeRequestError: <ErrorType,>(error: ErrorType) => void;
}

export function useSelectedThreadLifecycleEffects(input: UseSelectedThreadLifecycleEffectsInput): void {
  useEffect(() => {
    return () => {
      input.selectedThreadRefreshConcurrencyCoordinator.cancelActiveRefresh();
    };
  }, [input.selectedThreadRefreshConcurrencyCoordinator]);

  useEffect(() => {
    const selectedThreadLoadTokenRef = input.selectedThreadLoadTokenRef;
    selectedThreadLoadTokenRef.current += 1;
    const loadToken = selectedThreadLoadTokenRef.current;
    const selectedThreadIdRef = input.selectedThreadIdRef;

    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      input.selectedThreadRefreshConcurrencyCoordinator.cancelActiveRefresh();
      input.setLiveState(null);
      input.setReadThreadState(null);
      input.setStreamEvents([]);
      input.setIsSelectedThreadLoading(false);
      return;
    }

    input.setLiveState(null);
    input.setReadThreadState(null);
    input.setStreamEvents([]);
    input.setIsSelectedThreadLoading(true);

    const loadSelectedThreadFunction = input.loadSelectedThreadRef.current;
    if (!loadSelectedThreadFunction) {
      input.setIsSelectedThreadLoading(false);
      return;
    }

    void loadSelectedThreadFunction(input.selectedThreadId)
      .catch((error) => {
        if (input.selectedThreadLoadTokenRef.current !== loadToken) {
          return;
        }
        if (error instanceof Error && isRequestCanceledError(error)) {
          return;
        }
        const message = toErrorMessage(error);
        if (isThreadNotLoadedReadError(message)) {
          input.setSelectedThreadId(null);
          selectedThreadIdRef.current = null;
          return;
        }
        input.handleRuntimeRequestError(error);
      })
      .finally(() => {
        if (input.selectedThreadLoadTokenRef.current !== loadToken) {
          return;
        }
        input.setIsSelectedThreadLoading(false);
      });
  }, [
    input.handleRuntimeRequestError,
    input.loadSelectedThreadRef,
    input.selectedThreadId,
    input.selectedThreadIdRef,
    input.selectedThreadLoadTokenRef,
    input.selectedThreadRefreshConcurrencyCoordinator,
    input.setIsSelectedThreadLoading,
    input.setLiveState,
    input.setReadThreadState,
    input.setSelectedThreadId,
    input.setStreamEvents
  ]);
}
