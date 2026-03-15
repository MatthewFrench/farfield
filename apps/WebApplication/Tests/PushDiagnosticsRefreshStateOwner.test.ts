import { describe, expect, it, vi } from "vitest";
import { PushDiagnosticsRefreshStateOwner } from "@/Features/PushNotifications/StateManagement/PushDiagnosticsRefreshStateOwner";

describe("PushDiagnosticsRefreshStateOwner", () => {
  it("requires a non-negative integer time-to-live value", () => {
    expect(
      () =>
        new PushDiagnosticsRefreshStateOwner({
          timeToLiveMilliseconds: -1,
        }),
    ).toThrowError(/timeToLiveMilliseconds/);

    expect(
      () =>
        new PushDiagnosticsRefreshStateOwner({
          timeToLiveMilliseconds: 1.5,
        }),
    ).toThrowError(/timeToLiveMilliseconds/);
  });

  it("skips non-forced refreshes while the time-to-live window is active", async () => {
    let nowMilliseconds = 100;
    const owner = new PushDiagnosticsRefreshStateOwner({
      timeToLiveMilliseconds: 200,
      readNowMilliseconds: () => nowMilliseconds,
    });
    const refreshTask = vi.fn(async (): Promise<void> => {});

    await owner.runRefresh({
      refreshTask,
      forceRefresh: false,
    });
    expect(refreshTask).toHaveBeenCalledTimes(1);

    nowMilliseconds = 250;
    await owner.runRefresh({
      refreshTask,
      forceRefresh: false,
    });
    expect(refreshTask).toHaveBeenCalledTimes(1);

    nowMilliseconds = 301;
    await owner.runRefresh({
      refreshTask,
      forceRefresh: false,
    });
    expect(refreshTask).toHaveBeenCalledTimes(2);
  });

  it("executes forced refreshes even when the time-to-live window is active", async () => {
    let nowMilliseconds = 200;
    const owner = new PushDiagnosticsRefreshStateOwner({
      timeToLiveMilliseconds: 10_000,
      readNowMilliseconds: () => nowMilliseconds,
    });
    const refreshTask = vi.fn(async (): Promise<void> => {});

    await owner.runRefresh({
      refreshTask,
      forceRefresh: false,
    });
    expect(refreshTask).toHaveBeenCalledTimes(1);

    nowMilliseconds = 250;
    await owner.runRefresh({
      refreshTask,
      forceRefresh: true,
    });
    expect(refreshTask).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent refresh requests into one task execution", async () => {
    const owner = new PushDiagnosticsRefreshStateOwner({
      timeToLiveMilliseconds: 0,
    });

    let refreshTaskResolver: (() => void) | undefined;
    const refreshTaskPromise = new Promise<void>((resolve) => {
      refreshTaskResolver = () => {
        resolve();
      };
    });
    const refreshTask = vi.fn(async () => await refreshTaskPromise);

    const firstRefreshPromise = owner.runRefresh({
      refreshTask,
      forceRefresh: false,
    });
    const secondRefreshPromise = owner.runRefresh({
      refreshTask,
      forceRefresh: false,
    });

    expect(refreshTask).toHaveBeenCalledTimes(1);
    if (refreshTaskResolver === undefined) {
      throw new Error("Expected refresh task resolver to be captured");
    }
    refreshTaskResolver();
    await Promise.all([firstRefreshPromise, secondRefreshPromise]);
    expect(refreshTask).toHaveBeenCalledTimes(1);
  });
});
