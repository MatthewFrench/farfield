import { useEffect, useMemo, useRef, useState } from "react";
import { THREAD_LIST_PRESENTATION_WORKER_DISPOSED_ERROR_MESSAGE } from "@/Features/Threads/StateManagement/ThreadListPresentationWorkerOwner";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

const INITIAL_ASYNCHRONOUS_REQUEST_SEQUENCE = 0;
const THREAD_LIST_PRESENTATION_WORKER_NON_ERROR_REJECTION_MESSAGE =
  "Thread list presentation worker failed with a non-error rejection.";
type ThreadListPresentationState = ApplicationDerivedState["threadListPresentationState"];

interface UseThreadListPresentationDerivedStateInput {
  threads: UseApplicationDerivedStateInput["threads"];
  archivedThreads: UseApplicationDerivedStateInput["archivedThreads"];
  selectedThreadId: UseApplicationDerivedStateInput["selectedThreadId"];
  threadListPresentationWorkerOwner: UseApplicationDerivedStateInput["threadListPresentationWorkerOwner"];
  threadListStateController: UseApplicationDerivedStateInput["threadListStateController"];
}

export function useThreadListPresentationDerivedState(
  input: UseThreadListPresentationDerivedStateInput,
): {
  threadListPresentationState: ThreadListPresentationState;
  threadListPresentationError: Error | null;
} {
  const {
    threads,
    archivedThreads,
    selectedThreadId,
    threadListPresentationWorkerOwner,
    threadListStateController,
  } = input;
  const immediateThreadListPresentationState = useMemo<ThreadListPresentationState>(
    () =>
      threadListStateController.readThreadListPresentationState({
        threads,
        archivedThreads,
        selectedThreadIdentifier: selectedThreadId,
      }),
    [archivedThreads, selectedThreadId, threadListStateController, threads],
  );
  const threadListPresentationRequestSequenceReference = useRef<number>(
    INITIAL_ASYNCHRONOUS_REQUEST_SEQUENCE,
  );
  const [asynchronousThreadListPresentationState, setAsynchronousThreadListPresentationState] =
    useState<ThreadListPresentationState | null>(null);
  const [asynchronousThreadListPresentationError, setAsynchronousThreadListPresentationError] =
    useState<Error | null>(null);

  useEffect(() => {
    if (!threadListPresentationWorkerOwner) {
      setAsynchronousThreadListPresentationState(null);
      return;
    }

    const requestSequence = threadListPresentationRequestSequenceReference.current + 1;
    threadListPresentationRequestSequenceReference.current = requestSequence;
    let isDisposed = false;

    void threadListPresentationWorkerOwner
      .readState({
        threads,
        archivedThreads,
        selectedThreadIdentifier: selectedThreadId,
      })
      .then((state) => {
        if (
          isDisposed ||
          threadListPresentationRequestSequenceReference.current !== requestSequence
        ) {
          return;
        }
        setAsynchronousThreadListPresentationError(null);
        setAsynchronousThreadListPresentationState(state);
      })
      .catch((error) => {
        if (
          isDisposed ||
          threadListPresentationRequestSequenceReference.current !== requestSequence
        ) {
          return;
        }
        if (error instanceof Error) {
          if (error.message === THREAD_LIST_PRESENTATION_WORKER_DISPOSED_ERROR_MESSAGE) {
            return;
          }
          setAsynchronousThreadListPresentationError(error);
          return;
        }
        setAsynchronousThreadListPresentationError(
          new Error(THREAD_LIST_PRESENTATION_WORKER_NON_ERROR_REJECTION_MESSAGE),
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [archivedThreads, selectedThreadId, threadListPresentationWorkerOwner, threads]);

  return {
    threadListPresentationState:
      threadListPresentationWorkerOwner === null
        ? immediateThreadListPresentationState
        : (asynchronousThreadListPresentationState ?? immediateThreadListPresentationState),
    threadListPresentationError: asynchronousThreadListPresentationError,
  };
}
