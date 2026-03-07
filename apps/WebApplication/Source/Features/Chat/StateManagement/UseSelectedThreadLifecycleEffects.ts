import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { isThreadNotLoadedReadError } from "@/Features/Chat/DomainModel/ReadThreadErrorClassifier";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { isRequestCanceledError } from "@/Shared/Errors/RequestCanceledError";
import type {
  ChatLiveStateResponse,
  ChatReadThreadResponse,
  ChatStreamEventsResponse,
} from "../DataAccess/ChatServerClient";
import { SelectedThreadRefreshConcurrencyCoordinator } from "./SelectedThreadRefreshConcurrencyCoordinator";
import type { LoadSelectedThreadOptions } from "./UseSelectedThreadLoaders";

export interface UseSelectedThreadLifecycleEffectsInput {
  selectedThreadId: string | null;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  selectedThreadIdRef: MutableRefObject<string | null>;
  selectedThreadLoadTokenRef: MutableRefObject<number>;
  loadSelectedThreadRef: MutableRefObject<
    ((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null
  >;
  applyCachedSelectedThreadSnapshot: (threadId: string) => boolean;
  selectedThreadRefreshConcurrencyCoordinator: SelectedThreadRefreshConcurrencyCoordinator;
  setLiveState: Dispatch<SetStateAction<ChatLiveStateResponse | null>>;
  setReadThreadState: Dispatch<SetStateAction<ChatReadThreadResponse | null>>;
  setStreamEvents: Dispatch<SetStateAction<ChatStreamEventsResponse["events"]>>;
  setIsSelectedThreadLoading: Dispatch<SetStateAction<boolean>>;
  refreshThreadListsAfterSelectedThreadMissing: () => Promise<void>;
  unsubscribeThread: (threadId: string) => Promise<void>;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

const EMPTY_RUNTIME_ERROR_MESSAGE = "";

function clearSelectedThreadSelection(input: UseSelectedThreadLifecycleEffectsInput): void {
  const selectedThreadIdRef = input.selectedThreadIdRef;
  input.setSelectedThreadId(null);
  selectedThreadIdRef.current = null;
  input.setErrorMessage(EMPTY_RUNTIME_ERROR_MESSAGE);
}

export function useSelectedThreadLifecycleEffects(
  input: UseSelectedThreadLifecycleEffectsInput,
): void {
  const unsubscribeThreadRef = useRef(input.unsubscribeThread);
  const handleRuntimeRequestErrorRef = useRef(input.handleRuntimeRequestError);
  const previousSelectedThreadIdentifierRef = useRef<string | null>(input.selectedThreadId);
  const unsubscribeInFlightThreadIdentifiersRef = useRef<Set<string>>(new Set());

  const requestThreadUnsubscribe = useCallback(
    (threadIdentifier: string, reportInteractiveErrors: boolean): void => {
      if (threadIdentifier.length === 0) {
        return;
      }

      const unsubscribeInFlightThreadIdentifiers = unsubscribeInFlightThreadIdentifiersRef.current;
      if (unsubscribeInFlightThreadIdentifiers.has(threadIdentifier)) {
        return;
      }

      unsubscribeInFlightThreadIdentifiers.add(threadIdentifier);
      void unsubscribeThreadRef
        .current(threadIdentifier)
        .catch((error) => {
          if (!reportInteractiveErrors) {
            return;
          }
          if (error instanceof Error && isRequestCanceledError(error)) {
            return;
          }
          const message = toErrorMessage(error);
          if (isThreadNotLoadedReadError(message)) {
            return;
          }
          handleRuntimeRequestErrorRef.current(error);
        })
        .finally(() => {
          unsubscribeInFlightThreadIdentifiers.delete(threadIdentifier);
        });
    },
    [],
  );

  useEffect(() => {
    unsubscribeThreadRef.current = input.unsubscribeThread;
  }, [input.unsubscribeThread]);

  useEffect(() => {
    handleRuntimeRequestErrorRef.current = input.handleRuntimeRequestError;
  }, [input.handleRuntimeRequestError]);

  useEffect(() => {
    return () => {
      // Page teardown already closes the owning event-stream/session surfaces. Skipping
      // explicit unmount unsubscribe avoids extra reload-path mutations without changing
      // selection-switch cleanup semantics inside the running application session.
      input.selectedThreadRefreshConcurrencyCoordinator.cancelActiveRefresh();
    };
  }, [input.selectedThreadRefreshConcurrencyCoordinator]);

  useEffect(() => {
    const previousSelectedThreadIdentifier = previousSelectedThreadIdentifierRef.current;
    const nextSelectedThreadIdentifier = input.selectedThreadId;
    if (
      previousSelectedThreadIdentifier !== null &&
      previousSelectedThreadIdentifier !== nextSelectedThreadIdentifier
    ) {
      requestThreadUnsubscribe(previousSelectedThreadIdentifier, true);
    }

    previousSelectedThreadIdentifierRef.current = nextSelectedThreadIdentifier;
  }, [requestThreadUnsubscribe, input.selectedThreadId]);

  useEffect(() => {
    const selectedThreadLoadTokenRef = input.selectedThreadLoadTokenRef;
    selectedThreadLoadTokenRef.current += 1;
    const loadToken = selectedThreadLoadTokenRef.current;
    const selectedThreadIdRef = input.selectedThreadIdRef;
    selectedThreadIdRef.current = input.selectedThreadId;

    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      input.selectedThreadRefreshConcurrencyCoordinator.cancelActiveRefresh();
      input.setLiveState(null);
      input.setReadThreadState(null);
      input.setStreamEvents([]);
      input.setIsSelectedThreadLoading(false);
      return;
    }
    const selectedThreadIdentifier = input.selectedThreadId;
    const cachedSnapshotApplied = input.applyCachedSelectedThreadSnapshot(selectedThreadIdentifier);
    if (!cachedSnapshotApplied) {
      input.setLiveState(null);
      input.setReadThreadState(null);
      input.setStreamEvents([]);
    }
    input.setIsSelectedThreadLoading(!cachedSnapshotApplied);

    const loadSelectedThreadFunction = input.loadSelectedThreadRef.current;
    if (!loadSelectedThreadFunction) {
      input.setIsSelectedThreadLoading(false);
      return;
    }

    void loadSelectedThreadFunction(selectedThreadIdentifier)
      .catch((error) => {
        if (input.selectedThreadLoadTokenRef.current !== loadToken) {
          return;
        }
        if (error instanceof Error && isRequestCanceledError(error)) {
          return;
        }
        const message = toErrorMessage(error);
        if (isThreadNotLoadedReadError(message)) {
          clearSelectedThreadSelection(input);
          void input.refreshThreadListsAfterSelectedThreadMissing().catch((refreshError) => {
            if (refreshError instanceof Error && isRequestCanceledError(refreshError)) {
              return;
            }
            input.handleRuntimeRequestError(refreshError);
          });
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
    input.applyCachedSelectedThreadSnapshot,
    input.refreshThreadListsAfterSelectedThreadMissing,
    input.selectedThreadId,
    input.setSelectedThreadId,
    input.setErrorMessage,
    input.selectedThreadIdRef,
    input.selectedThreadLoadTokenRef,
    input.selectedThreadRefreshConcurrencyCoordinator,
    input.setIsSelectedThreadLoading,
    input.setLiveState,
    input.setReadThreadState,
    input.setStreamEvents,
  ]);
}
