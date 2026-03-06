import { cleanup, render, waitFor } from "@testing-library/react";
import type { MutableRefObject, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ChatLiveStateResponse,
  ChatReadThreadResponse,
  ChatStreamEventsResponse,
} from "@/Features/Chat/DataAccess/ChatServerClient";
import { SelectedThreadRefreshConcurrencyCoordinator } from "@/Features/Chat/StateManagement/SelectedThreadRefreshConcurrencyCoordinator";
import {
  type UseSelectedThreadLifecycleEffectsInput,
  useSelectedThreadLifecycleEffects,
} from "@/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects";
import type { LoadSelectedThreadOptions } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";

interface LifecycleHarnessProperties {
  input: UseSelectedThreadLifecycleEffectsInput;
}

function LifecycleHarness({ input }: LifecycleHarnessProperties): React.JSX.Element {
  useSelectedThreadLifecycleEffects(input);
  return <></>;
}

function createDeferredVoidPromise(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
} {
  let resolvePromise: () => void = () => {
    throw new Error("resolvePromise was not initialized");
  };
  let rejectPromise: (error: Error) => void = () => {
    throw new Error("rejectPromise was not initialized");
  };
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

function createLifecycleInput(selectedThreadId: string | null) {
  const selectedThreadIdRef: MutableRefObject<string | null> = {
    current: selectedThreadId,
  };
  const selectedThreadLoadTokenRef: MutableRefObject<number> = {
    current: 0,
  };
  const loadSelectedThreadRef: MutableRefObject<
    ((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null
  > = {
    current: null,
  };
  const applyCachedSelectedThreadSnapshot = vi.fn((_threadId: string): boolean => false);
  const selectedThreadRefreshConcurrencyCoordinator =
    new SelectedThreadRefreshConcurrencyCoordinator();
  const setLiveState = vi.fn<(value: SetStateAction<ChatLiveStateResponse | null>) => void>();
  const setReadThreadState =
    vi.fn<(value: SetStateAction<ChatReadThreadResponse | null>) => void>();
  const setStreamEvents =
    vi.fn<(value: SetStateAction<ChatStreamEventsResponse["events"]>) => void>();
  const setIsSelectedThreadLoading = vi.fn<(value: SetStateAction<boolean>) => void>();
  const setSelectedThreadId = vi.fn<(value: SetStateAction<string | null>) => void>();
  const unsubscribeThread = vi.fn(async (_threadId: string): Promise<void> => {});
  const readNextSelectedThreadIdentifierAfterLoadFailure = vi.fn(
    (_failedThreadIdentifier: string): string | null => null,
  );
  const handleRuntimeRequestError = vi.fn<<ErrorType>(error: ErrorType) => void>();

  return {
    input: {
      selectedThreadId,
      readNextSelectedThreadIdentifierAfterLoadFailure,
      selectedThreadIdRef,
      selectedThreadLoadTokenRef,
      loadSelectedThreadRef,
      applyCachedSelectedThreadSnapshot,
      selectedThreadRefreshConcurrencyCoordinator,
      setLiveState,
      setReadThreadState,
      setStreamEvents,
      setIsSelectedThreadLoading,
      setSelectedThreadId,
      unsubscribeThread,
      handleRuntimeRequestError,
    },
    selectedThreadIdRef,
    selectedThreadLoadTokenRef,
    loadSelectedThreadRef,
    applyCachedSelectedThreadSnapshot,
    selectedThreadRefreshConcurrencyCoordinator,
    setLiveState,
    setReadThreadState,
    setStreamEvents,
    setIsSelectedThreadLoading,
    setSelectedThreadId,
    unsubscribeThread,
    readNextSelectedThreadIdentifierAfterLoadFailure,
    handleRuntimeRequestError,
  };
}

describe("useSelectedThreadLifecycleEffects", () => {
  afterEach(() => {
    cleanup();
  });

  it("clears thread-owned state and cancels active refresh when selection is empty", async () => {
    const lifecycle = createLifecycleInput(null);
    const cancelActiveRefreshSpy = vi.spyOn(
      lifecycle.selectedThreadRefreshConcurrencyCoordinator,
      "cancelActiveRefresh",
    );

    render(<LifecycleHarness input={lifecycle.input} />);

    await waitFor(() => {
      expect(cancelActiveRefreshSpy).toHaveBeenCalledTimes(1);
    });

    expect(lifecycle.setLiveState).toHaveBeenCalledWith(null);
    expect(lifecycle.setReadThreadState).toHaveBeenCalledWith(null);
    expect(lifecycle.setStreamEvents).toHaveBeenCalledWith([]);
    expect(lifecycle.setIsSelectedThreadLoading).toHaveBeenCalledWith(false);
  });

  it("selects the next available thread when the read path reports a not-loaded error", async () => {
    const lifecycle = createLifecycleInput("thread-1");
    lifecycle.readNextSelectedThreadIdentifierAfterLoadFailure.mockReturnValue("thread-2");
    lifecycle.loadSelectedThreadRef.current = vi.fn(async () => {
      throw new Error("thread not loaded in app-server");
    });

    render(<LifecycleHarness input={lifecycle.input} />);

    await waitFor(() => {
      expect(lifecycle.setSelectedThreadId).toHaveBeenCalledWith("thread-2");
    });

    expect(lifecycle.readNextSelectedThreadIdentifierAfterLoadFailure).toHaveBeenCalledWith(
      "thread-1",
    );
    expect(lifecycle.selectedThreadIdRef.current).toBe("thread-2");
    expect(lifecycle.handleRuntimeRequestError).not.toHaveBeenCalled();
    expect(lifecycle.setIsSelectedThreadLoading).toHaveBeenCalledWith(true);
    expect(lifecycle.setIsSelectedThreadLoading).toHaveBeenLastCalledWith(false);
  });

  it("keeps cached selected-thread state visible while refresh is in flight", async () => {
    const lifecycle = createLifecycleInput("thread-1");
    const deferredLoad = createDeferredVoidPromise();
    lifecycle.applyCachedSelectedThreadSnapshot.mockReturnValue(true);
    lifecycle.loadSelectedThreadRef.current = vi.fn(async () => deferredLoad.promise);

    render(<LifecycleHarness input={lifecycle.input} />);

    await waitFor(() => {
      expect(lifecycle.applyCachedSelectedThreadSnapshot).toHaveBeenCalledWith("thread-1");
    });

    expect(lifecycle.setLiveState).not.toHaveBeenCalledWith(null);
    expect(lifecycle.setReadThreadState).not.toHaveBeenCalledWith(null);
    expect(lifecycle.setStreamEvents).not.toHaveBeenCalledWith([]);
    expect(lifecycle.setIsSelectedThreadLoading).toHaveBeenCalledWith(false);

    deferredLoad.resolve();

    await waitFor(() => {
      expect(lifecycle.setIsSelectedThreadLoading).toHaveBeenLastCalledWith(false);
    });
  });

  it("ignores stale read failures after thread selection advances", async () => {
    const lifecycle = createLifecycleInput("thread-1");
    const firstLoad = createDeferredVoidPromise();
    const loadSelectedThread = vi.fn(async (threadId: string) => {
      if (threadId === "thread-1") {
        return firstLoad.promise;
      }
      return Promise.resolve();
    });
    lifecycle.loadSelectedThreadRef.current = loadSelectedThread;

    const { rerender } = render(<LifecycleHarness input={lifecycle.input} />);

    lifecycle.selectedThreadIdRef.current = "thread-2";
    rerender(
      <LifecycleHarness
        input={{
          ...lifecycle.input,
          selectedThreadId: "thread-2",
        }}
      />,
    );

    await waitFor(() => {
      expect(loadSelectedThread).toHaveBeenCalledTimes(2);
    });

    firstLoad.reject(new Error("thread not loaded in app-server"));

    await waitFor(() => {
      expect(lifecycle.setIsSelectedThreadLoading).toHaveBeenLastCalledWith(false);
    });

    expect(lifecycle.setSelectedThreadId).not.toHaveBeenCalledWith(null);
    expect(lifecycle.handleRuntimeRequestError).not.toHaveBeenCalled();
  });

  it("unsubscribes the previously selected thread when selection changes", async () => {
    const lifecycle = createLifecycleInput("thread-1");
    lifecycle.loadSelectedThreadRef.current = vi.fn(async () => {});

    const { rerender } = render(<LifecycleHarness input={lifecycle.input} />);

    lifecycle.selectedThreadIdRef.current = "thread-2";
    rerender(
      <LifecycleHarness
        input={{
          ...lifecycle.input,
          selectedThreadId: "thread-2",
        }}
      />,
    );

    await waitFor(() => {
      expect(lifecycle.unsubscribeThread).toHaveBeenCalledWith("thread-1");
    });
  });

  it("unsubscribes selected thread during unmount cleanup", async () => {
    const lifecycle = createLifecycleInput("thread-cleanup");
    lifecycle.loadSelectedThreadRef.current = vi.fn(async () => {});

    const rendered = render(<LifecycleHarness input={lifecycle.input} />);
    rendered.unmount();

    await waitFor(() => {
      expect(lifecycle.unsubscribeThread).toHaveBeenCalledWith("thread-cleanup");
    });
  });

  it("does not unsubscribe on callback-identity rerenders while thread selection is unchanged", async () => {
    const lifecycle = createLifecycleInput("thread-stable");
    lifecycle.loadSelectedThreadRef.current = vi.fn(async () => {});

    const rendered = render(<LifecycleHarness input={lifecycle.input} />);
    const replacementUnsubscribeThread = vi.fn(async (_threadId: string): Promise<void> => {});
    const replacementHandleRuntimeRequestError = vi.fn<<ErrorType>(error: ErrorType) => void>();

    rendered.rerender(
      <LifecycleHarness
        input={{
          ...lifecycle.input,
          unsubscribeThread: replacementUnsubscribeThread,
          handleRuntimeRequestError: replacementHandleRuntimeRequestError,
        }}
      />,
    );

    await waitFor(() => {
      expect(lifecycle.unsubscribeThread).toHaveBeenCalledTimes(0);
      expect(replacementUnsubscribeThread).toHaveBeenCalledTimes(0);
    });

    rendered.unmount();

    await waitFor(() => {
      expect(lifecycle.unsubscribeThread).toHaveBeenCalledTimes(0);
      expect(replacementUnsubscribeThread).toHaveBeenCalledWith("thread-stable");
    });
  });

  it("deduplicates unsubscribe requests for the same thread while a previous unsubscribe is in flight", async () => {
    const lifecycle = createLifecycleInput("thread-1");
    lifecycle.loadSelectedThreadRef.current = vi.fn(async () => {});
    const inFlightUnsubscribe = createDeferredVoidPromise();
    lifecycle.unsubscribeThread.mockImplementation(async (_threadId: string) => {
      return inFlightUnsubscribe.promise;
    });

    const rendered = render(<LifecycleHarness input={lifecycle.input} />);
    lifecycle.selectedThreadIdRef.current = "thread-2";
    rendered.rerender(
      <LifecycleHarness
        input={{
          ...lifecycle.input,
          selectedThreadId: "thread-2",
        }}
      />,
    );

    await waitFor(() => {
      expect(lifecycle.unsubscribeThread).toHaveBeenCalledTimes(1);
    });
    expect(lifecycle.unsubscribeThread).toHaveBeenLastCalledWith("thread-1");

    lifecycle.selectedThreadIdRef.current = "thread-1";
    rendered.unmount();

    await waitFor(() => {
      expect(lifecycle.unsubscribeThread).toHaveBeenCalledTimes(1);
    });

    inFlightUnsubscribe.resolve();
  });
});
