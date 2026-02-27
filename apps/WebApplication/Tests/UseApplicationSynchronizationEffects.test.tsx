import { cleanup, render } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type UseApplicationSynchronizationEffectsInput,
  useApplicationSynchronizationEffects,
} from "../Source/Application/StateManagement/UseApplicationSynchronizationEffects";

interface HarnessProperties {
  input: UseApplicationSynchronizationEffectsInput;
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  useApplicationSynchronizationEffects(properties.input);
  return <div data-testid="application-synchronization-effects-harness" />;
}

function createLoaderReference<ValueType>(): MutableRefObject<ValueType | null> {
  return { current: null };
}

describe("useApplicationSynchronizationEffects", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps loader refs synchronized with the latest owner functions", () => {
    const loadCoreDataTrackedRef = createLoaderReference<() => Promise<void>>();
    const loadSelectedThreadRef =
      createLoaderReference<
        (
          threadId: string,
          options?: { includeReadThread?: boolean; includeTurns?: boolean },
        ) => Promise<void>
      >();
    const firstLoadCoreDataTracked = vi.fn(async (): Promise<void> => {});
    const firstLoadSelectedThreadTracked = vi.fn(
      async (
        _threadId: string,
        _options?: { includeReadThread?: boolean; includeTurns?: boolean },
      ): Promise<void> => {},
    );
    const loadHistoryDetail = vi.fn(async (_historyEntryId: string): Promise<void> => {});
    const handleRuntimeRequestError = vi.fn();

    const { rerender } = render(
      <Harness
        input={{
          loadCoreDataTracked: firstLoadCoreDataTracked,
          loadCoreDataTrackedRef,
          loadSelectedThreadTracked: firstLoadSelectedThreadTracked,
          loadSelectedThreadRef,
          loadHistoryDetail,
          selectedHistoryId: "",
          handleRuntimeRequestError,
        }}
      />,
    );

    expect(loadCoreDataTrackedRef.current).toBe(firstLoadCoreDataTracked);
    expect(loadSelectedThreadRef.current).toBe(firstLoadSelectedThreadTracked);

    const secondLoadCoreDataTracked = vi.fn(async (): Promise<void> => {});
    const secondLoadSelectedThreadTracked = vi.fn(
      async (
        _threadId: string,
        _options?: { includeReadThread?: boolean; includeTurns?: boolean },
      ): Promise<void> => {},
    );

    rerender(
      <Harness
        input={{
          loadCoreDataTracked: secondLoadCoreDataTracked,
          loadCoreDataTrackedRef,
          loadSelectedThreadTracked: secondLoadSelectedThreadTracked,
          loadSelectedThreadRef,
          loadHistoryDetail,
          selectedHistoryId: "",
          handleRuntimeRequestError,
        }}
      />,
    );

    expect(loadCoreDataTrackedRef.current).toBe(secondLoadCoreDataTracked);
    expect(loadSelectedThreadRef.current).toBe(secondLoadSelectedThreadTracked);
  });

  it("does not request history detail when no history entry is selected", () => {
    const loadHistoryDetail = vi.fn(async (_historyEntryId: string): Promise<void> => {});

    render(
      <Harness
        input={{
          loadCoreDataTracked: vi.fn(async (): Promise<void> => {}),
          loadCoreDataTrackedRef: createLoaderReference<() => Promise<void>>(),
          loadSelectedThreadTracked: vi.fn(
            async (
              _threadId: string,
              _options?: {
                includeReadThread?: boolean;
                includeTurns?: boolean;
              },
            ): Promise<void> => {},
          ),
          loadSelectedThreadRef:
            createLoaderReference<
              (
                threadId: string,
                options?: {
                  includeReadThread?: boolean;
                  includeTurns?: boolean;
                },
              ) => Promise<void>
            >(),
          loadHistoryDetail,
          selectedHistoryId: "",
          handleRuntimeRequestError: vi.fn(),
        }}
      />,
    );

    expect(loadHistoryDetail).not.toHaveBeenCalled();
  });

  it("routes selected-history load errors to runtime error ownership", async () => {
    const expectedError = new Error("history-read-failed");
    const loadHistoryDetail = vi.fn(async (): Promise<void> => {
      throw expectedError;
    });
    const handleRuntimeRequestError = vi.fn();

    render(
      <Harness
        input={{
          loadCoreDataTracked: vi.fn(async (): Promise<void> => {}),
          loadCoreDataTrackedRef: createLoaderReference<() => Promise<void>>(),
          loadSelectedThreadTracked: vi.fn(
            async (
              _threadId: string,
              _options?: {
                includeReadThread?: boolean;
                includeTurns?: boolean;
              },
            ): Promise<void> => {},
          ),
          loadSelectedThreadRef:
            createLoaderReference<
              (
                threadId: string,
                options?: {
                  includeReadThread?: boolean;
                  includeTurns?: boolean;
                },
              ) => Promise<void>
            >(),
          loadHistoryDetail,
          selectedHistoryId: "history-1",
          handleRuntimeRequestError,
        }}
      />,
    );

    await Promise.resolve();

    expect(loadHistoryDetail).toHaveBeenCalledWith("history-1");
    expect(handleRuntimeRequestError).toHaveBeenCalledWith(expectedError);
  });
});
