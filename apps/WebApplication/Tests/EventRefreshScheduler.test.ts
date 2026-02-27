import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type EventRefreshFlags,
  EventRefreshScheduler,
} from "../Source/Application/StateManagement/EventRefreshScheduler";

const REFRESH_DELAY_MS = 20;

function createRefreshFlags(input: {
  refreshCore: boolean;
  refreshHistory: boolean;
  refreshSelectedThread: boolean;
}): EventRefreshFlags {
  return {
    refreshCore: input.refreshCore,
    refreshHistory: input.refreshHistory,
    refreshSelectedThread: input.refreshSelectedThread,
  };
}

describe("EventRefreshScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces queued refresh flags before executing refresh", async () => {
    vi.useFakeTimers();
    const scheduler = new EventRefreshScheduler(REFRESH_DELAY_MS);
    const executedRefreshFlags: EventRefreshFlags[] = [];

    scheduler.enqueueRefresh(
      createRefreshFlags({
        refreshCore: true,
        refreshHistory: false,
        refreshSelectedThread: false,
      }),
      async (refreshFlags) => {
        executedRefreshFlags.push(refreshFlags);
      },
    );
    scheduler.enqueueRefresh(
      createRefreshFlags({
        refreshCore: false,
        refreshHistory: true,
        refreshSelectedThread: true,
      }),
      async (refreshFlags) => {
        executedRefreshFlags.push(refreshFlags);
      },
    );

    await vi.advanceTimersByTimeAsync(REFRESH_DELAY_MS);

    expect(executedRefreshFlags).toEqual([
      createRefreshFlags({
        refreshCore: true,
        refreshHistory: true,
        refreshSelectedThread: true,
      }),
    ]);
  });

  it("clears pending refresh when disposed", async () => {
    vi.useFakeTimers();
    const scheduler = new EventRefreshScheduler(REFRESH_DELAY_MS);
    let executedRefreshCount = 0;

    scheduler.enqueueRefresh(
      createRefreshFlags({
        refreshCore: true,
        refreshHistory: false,
        refreshSelectedThread: false,
      }),
      async () => {
        executedRefreshCount += 1;
      },
    );

    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(REFRESH_DELAY_MS);

    expect(executedRefreshCount).toBe(0);
  });

  it("ignores no-op refresh requests that contain no work", async () => {
    vi.useFakeTimers();
    const scheduler = new EventRefreshScheduler(REFRESH_DELAY_MS);
    let executedRefreshCount = 0;

    scheduler.enqueueRefresh(
      createRefreshFlags({
        refreshCore: false,
        refreshHistory: false,
        refreshSelectedThread: false,
      }),
      async () => {
        executedRefreshCount += 1;
      },
    );

    await vi.advanceTimersByTimeAsync(REFRESH_DELAY_MS);

    expect(executedRefreshCount).toBe(0);
  });

  it("keeps the first scheduled timer window while merging later refresh flags", async () => {
    vi.useFakeTimers();
    const scheduler = new EventRefreshScheduler(REFRESH_DELAY_MS);
    const executedRefreshFlags: EventRefreshFlags[] = [];

    scheduler.enqueueRefresh(
      createRefreshFlags({
        refreshCore: true,
        refreshHistory: false,
        refreshSelectedThread: false,
      }),
      async (refreshFlags) => {
        executedRefreshFlags.push(refreshFlags);
      },
    );

    await vi.advanceTimersByTimeAsync(REFRESH_DELAY_MS / 2);

    scheduler.enqueueRefresh(
      createRefreshFlags({
        refreshCore: false,
        refreshHistory: true,
        refreshSelectedThread: false,
      }),
      async (refreshFlags) => {
        executedRefreshFlags.push(refreshFlags);
      },
    );

    await vi.advanceTimersByTimeAsync(REFRESH_DELAY_MS / 2);

    expect(executedRefreshFlags).toEqual([
      createRefreshFlags({
        refreshCore: true,
        refreshHistory: true,
        refreshSelectedThread: false,
      }),
    ]);
  });
});
