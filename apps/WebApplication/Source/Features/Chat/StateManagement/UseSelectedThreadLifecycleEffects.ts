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
  readNextSelectedThreadIdentifierAfterLoadFailure: (
    failedThreadIdentifier: string,
  ) => string | null;
  selectedThreadIdRef: MutableRefObject<string | null>;
  selectedThreadLoadTokenRef: MutableRefObject<number>;
  loadSelectedThreadRef: MutableRefObject<
    ((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null
  >;
  selectedThreadRefreshConcurrencyCoordinator: SelectedThreadRefreshConcurrencyCoordinator;
  setLiveState: Dispatch<SetStateAction<ChatLiveStateResponse | null>>;
  setReadThreadState: Dispatch<SetStateAction<ChatReadThreadResponse | null>>;
  setStreamEvents: Dispatch<SetStateAction<ChatStreamEventsResponse["events"]>>;
  setIsSelectedThreadLoading: Dispatch<SetStateAction<boolean>>;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  unsubscribeThread: (threadId: string) => Promise<void>;
  handleRuntimeRequestError: <ErrorType>(error: ErrorType) => void;
}

export function useSelectedThreadLifecycleEffects(
  input: UseSelectedThreadLifecycleEffectsInput,
): void {
  const unsubscribeThreadRef = useRef(input.unsubscribeThread);
  const handleRuntimeRequestErrorRef = useRef(input.handleRuntimeRequestError);
  const readNextSelectedThreadIdentifierAfterLoadFailureRef = useRef(
    input.readNextSelectedThreadIdentifierAfterLoadFailure,
  );
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
    readNextSelectedThreadIdentifierAfterLoadFailureRef.current =
      input.readNextSelectedThreadIdentifierAfterLoadFailure;
  }, [input.readNextSelectedThreadIdentifierAfterLoadFailure]);

  useEffect(() => {
    return () => {
      const selectedThreadIdentifier = input.selectedThreadIdRef.current;
      if (selectedThreadIdentifier !== null && selectedThreadIdentifier.length > 0) {
        // Unmount teardown should not surface unsubscribe failures to interactive error banners.
        requestThreadUnsubscribe(selectedThreadIdentifier, false);
      }
      input.selectedThreadRefreshConcurrencyCoordinator.cancelActiveRefresh();
    };
  }, [
    requestThreadUnsubscribe,
    input.selectedThreadIdRef,
    input.selectedThreadRefreshConcurrencyCoordinator,
  ]);

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

    if (input.selectedThreadId === null || input.selectedThreadId.length === 0) {
      input.selectedThreadRefreshConcurrencyCoordinator.cancelActiveRefresh();
      input.setLiveState(null);
      input.setReadThreadState(null);
      input.setStreamEvents([]);
      input.setIsSelectedThreadLoading(false);
      return;
    }
    const selectedThreadIdentifier = input.selectedThreadId;

    input.setLiveState(null);
    input.setReadThreadState(null);
    input.setStreamEvents([]);
    input.setIsSelectedThreadLoading(true);

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
          const nextSelectedThreadIdentifier =
            readNextSelectedThreadIdentifierAfterLoadFailureRef.current(selectedThreadIdentifier);
          input.setSelectedThreadId(nextSelectedThreadIdentifier);
          selectedThreadIdRef.current = nextSelectedThreadIdentifier;
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
    input.setStreamEvents,
  ]);
}
