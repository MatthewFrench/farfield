import { useEffect, useMemo, useRef, useState } from "react";
import { THREAD_LIST_PRESENTATION_WORKER_DISPOSED_ERROR_MESSAGE } from "@/Features/Threads/StateManagement/ThreadListPresentationWorkerOwner";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

const INITIAL_ASYNCHRONOUS_REQUEST_SEQUENCE = 0;
const THREAD_LIST_PRESENTATION_WORKER_NON_ERROR_REJECTION_MESSAGE =
  "Thread list presentation worker failed with a non-error rejection.";

interface UseThreadListPresentationDerivedStateInput {
  threads: UseApplicationDerivedStateInput["threads"];
  archivedThreads: UseApplicationDerivedStateInput["archivedThreads"];
  selectedThreadId: UseApplicationDerivedStateInput["selectedThreadId"];
  threadListPresentationWorkerOwner: UseApplicationDerivedStateInput["threadListPresentationWorkerOwner"];
  threadListStateController: UseApplicationDerivedStateInput["threadListStateController"];
}

function createInitialThreadListPresentationState(): ApplicationDerivedState["threadListPresentationState"] {
  return {
    selectedThread: null,
    activeProjectGroups: [],
    archivedProjectGroups: [],
    archivedThreadIdentifiers: new Set<string>(),
    archivedSectionThreadCount: 0,
  };
}

export function useThreadListPresentationDerivedState(
  input: UseThreadListPresentationDerivedStateInput,
): {
  threadListPresentationState: ApplicationDerivedState["threadListPresentationState"];
  threadListPresentationError: Error | null;
} {
  const {
    threads,
    archivedThreads,
    selectedThreadId,
    threadListPresentationWorkerOwner,
    threadListStateController,
  } = input;
  const threadListPresentationRequestSequenceReference = useRef<number>(
    INITIAL_ASYNCHRONOUS_REQUEST_SEQUENCE,
  );
  const [asynchronousThreadListPresentationState, setAsynchronousThreadListPresentationState] =
    useState<ApplicationDerivedState["threadListPresentationState"]>(
      createInitialThreadListPresentationState,
    );
  const [asynchronousThreadListPresentationError, setAsynchronousThreadListPresentationError] =
    useState<Error | null>(null);

  useEffect(() => {
    if (!threadListPresentationWorkerOwner) {
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

  const inThreadThreadListPresentationState = useMemo<
    ApplicationDerivedState["threadListPresentationState"] | null
  >(() => {
    if (threadListPresentationWorkerOwner) {
      return null;
    }
    return threadListStateController.readThreadListPresentationState({
      threads,
      archivedThreads,
      selectedThreadIdentifier: selectedThreadId,
    });
  }, [
    archivedThreads,
    selectedThreadId,
    threadListPresentationWorkerOwner,
    threadListStateController,
    threads,
  ]);

  return {
    threadListPresentationState:
      inThreadThreadListPresentationState ?? asynchronousThreadListPresentationState,
    threadListPresentationError: asynchronousThreadListPresentationError,
  };
}
