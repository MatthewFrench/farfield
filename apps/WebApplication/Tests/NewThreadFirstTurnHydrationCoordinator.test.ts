import { describe, expect, it, vi } from "vitest";
import { NewThreadFirstTurnHydrationCoordinator } from "@/Features/Chat/StateManagement/NewThreadFirstTurnHydrationCoordinator";

describe("NewThreadFirstTurnHydrationCoordinator", () => {
  it("retries full-turn reloads after a transient includeTurns route failure", async () => {
    const readThreadWithoutTurns = vi
      .fn<
        (threadId: string) => Promise<{ thread: { preview: string; status: { type: string } } }>
      >()
      .mockResolvedValue({
        thread: {
          preview: "Reply with exactly EMPTY-CREATE-COMPOSER-OK",
          status: { type: "idle" },
        },
      });
    const reloadSelectedThread = vi
      .fn<
        (
          threadId: string,
          options?: {
            includeTurns?: boolean;
            includeReadThread?: boolean;
            promotePendingThreadToFullRead?: boolean;
          },
        ) => Promise<void>
      >()
      .mockRejectedValueOnce(
        new Error(
          "Request failed for /api/threads/thread-1?includeTurns=true status=500 Internal Server Error",
        ),
      )
      .mockResolvedValue(undefined);
    const waitDurations: number[] = [];
    const coordinator = new NewThreadFirstTurnHydrationCoordinator({
      reloadSelectedThread,
      readThreadWithoutTurns,
      waitForMilliseconds: async (durationMilliseconds) => {
        waitDurations.push(durationMilliseconds);
      },
    });

    coordinator.scheduleHydration("thread-1");

    await vi.waitFor(() => {
      expect(reloadSelectedThread).toHaveBeenCalledTimes(2);
    });

    expect(waitDurations).toEqual([400, 800]);
    expect(readThreadWithoutTurns).toHaveBeenCalledTimes(2);
    expect(reloadSelectedThread).toHaveBeenNthCalledWith(1, "thread-1", {
      includeTurns: true,
    });
    expect(reloadSelectedThread).toHaveBeenNthCalledWith(2, "thread-1", {
      includeTurns: true,
    });
  });

  it("stops retrying after a non-retryable full-turn reload error", async () => {
    const readThreadWithoutTurns = vi
      .fn<
        (threadId: string) => Promise<{ thread: { preview: string; status: { type: string } } }>
      >()
      .mockResolvedValue({
        thread: {
          preview: "Reply with exactly EMPTY-CREATE-COMPOSER-OK",
          status: { type: "idle" },
        },
      });
    const reloadSelectedThread = vi
      .fn<
        (
          threadId: string,
          options?: {
            includeTurns?: boolean;
            includeReadThread?: boolean;
            promotePendingThreadToFullRead?: boolean;
          },
        ) => Promise<void>
      >()
      .mockRejectedValue(new Error("permission denied"));
    const waitDurations: number[] = [];
    const coordinator = new NewThreadFirstTurnHydrationCoordinator({
      reloadSelectedThread,
      readThreadWithoutTurns,
      waitForMilliseconds: async (durationMilliseconds) => {
        waitDurations.push(durationMilliseconds);
      },
    });

    coordinator.scheduleHydration("thread-1");

    await vi.waitFor(() => {
      expect(reloadSelectedThread).toHaveBeenCalledTimes(1);
    });

    expect(waitDurations).toEqual([400]);
  });

  it("replaces an earlier run when the same thread is scheduled again", async () => {
    let resolveFirstWait: (() => void) | undefined;
    const readThreadWithoutTurns = vi
      .fn<
        (threadId: string) => Promise<{ thread: { preview: string; status: { type: string } } }>
      >()
      .mockResolvedValue({
        thread: {
          preview: "Reply with exactly EMPTY-CREATE-COMPOSER-OK",
          status: { type: "idle" },
        },
      });
    const reloadSelectedThread = vi.fn(async () => {});
    const coordinator = new NewThreadFirstTurnHydrationCoordinator({
      reloadSelectedThread,
      readThreadWithoutTurns,
      waitForMilliseconds: (durationMilliseconds) => {
        if (durationMilliseconds !== 400 || resolveFirstWait !== undefined) {
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          resolveFirstWait = resolve;
        });
      },
    });

    coordinator.scheduleHydration("thread-1");
    coordinator.scheduleHydration("thread-1");

    if (resolveFirstWait === undefined) {
      throw new Error("Expected the first wait to be captured");
    }
    const resolveCapturedFirstWait = resolveFirstWait;
    resolveCapturedFirstWait();

    await vi.waitFor(() => {
      expect(reloadSelectedThread).toHaveBeenCalledTimes(1);
    });

    expect(reloadSelectedThread).toHaveBeenCalledWith("thread-1", {
      includeTurns: true,
    });
  });

  it("waits for a non-empty preview before attempting the full-turn reload", async () => {
    const readThreadWithoutTurns = vi
      .fn<
        (threadId: string) => Promise<{ thread: { preview: string; status: { type: string } } }>
      >()
      .mockResolvedValueOnce({ thread: { preview: "", status: { type: "active" } } })
      .mockResolvedValueOnce({
        thread: {
          preview: "Reply with exactly EMPTY-CREATE-COMPOSER-OK and nothing else.",
          status: { type: "idle" },
        },
      });
    const reloadSelectedThread = vi.fn(async () => {});
    const waitDurations: number[] = [];
    const coordinator = new NewThreadFirstTurnHydrationCoordinator({
      reloadSelectedThread,
      readThreadWithoutTurns,
      waitForMilliseconds: async (durationMilliseconds) => {
        waitDurations.push(durationMilliseconds);
      },
    });

    coordinator.scheduleHydration("thread-1");

    await vi.waitFor(() => {
      expect(reloadSelectedThread).toHaveBeenCalledTimes(1);
    });

    expect(waitDurations).toEqual([400, 800]);
    expect(readThreadWithoutTurns).toHaveBeenCalledTimes(2);
    expect(reloadSelectedThread).toHaveBeenCalledWith("thread-1", {
      includeTurns: true,
    });
  });
});
