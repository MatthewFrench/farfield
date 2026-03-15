import { describe, expect, it } from "vitest";
import { ClientPerformanceFreezeProbeOwner } from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";

class TestAnimationFrameScheduler {
  private nextHandle = 1;
  private readonly callbackByHandle = new Map<number, FrameRequestCallback>();

  public requestAnimationFrame(callback: FrameRequestCallback): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbackByHandle.set(handle, callback);
    return handle;
  }

  public cancelAnimationFrame(handle: number): void {
    this.callbackByHandle.delete(handle);
  }

  public flush(now: number): void {
    const callbacks = [...this.callbackByHandle.values()];
    this.callbackByHandle.clear();
    for (const callback of callbacks) {
      callback(now);
    }
  }
}

describe("ClientPerformanceFreezeProbeOwner", () => {
  it("records freeze windows when frame gaps exceed the configured threshold", () => {
    const highResolutionMilliseconds = 0;
    const scheduler = new TestAnimationFrameScheduler();
    const owner = new ClientPerformanceFreezeProbeOwner({
      readTimeOriginMilliseconds: () => 1_700_000_000_000,
      readHighResolutionMilliseconds: () => highResolutionMilliseconds,
      readVisibilityState: () => "visible",
      requestAnimationFrame: (callback) => scheduler.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => scheduler.cancelAnimationFrame(handle),
      freezeThresholdMilliseconds: 120,
    });

    owner.start();
    scheduler.flush(10);
    scheduler.flush(80);
    scheduler.flush(260);

    const snapshot = owner.readSnapshot();

    expect(snapshot.freezeWindows).toEqual([
      {
        sequence: 1,
        startedAtEpochMilliseconds: 1_700_000_000_080,
        completedAtEpochMilliseconds: 1_700_000_000_260,
        startedAtHighResolutionMilliseconds: 80,
        completedAtHighResolutionMilliseconds: 260,
        durationMilliseconds: 180,
      },
    ]);
  });

  it("records completed operations, long tasks, and clears bounded records on reset", () => {
    let highResolutionMilliseconds = 50;
    const scheduler = new TestAnimationFrameScheduler();
    const owner = new ClientPerformanceFreezeProbeOwner({
      readTimeOriginMilliseconds: () => 1_700_000_000_000,
      readHighResolutionMilliseconds: () => highResolutionMilliseconds,
      readVisibilityState: () => "visible",
      requestAnimationFrame: (callback) => scheduler.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => scheduler.cancelAnimationFrame(handle),
    });

    const operationToken = owner.beginOperation("thread-list-request", {
      path: "/api/threads",
    });
    highResolutionMilliseconds = 90;
    owner.completeOperation(operationToken, "succeeded", {
      status: 200,
    });
    owner.recordInstantEvent("sidebar-toggle-open-requested", {
      target: "mobile",
    });
    owner.recordLongTask({
      startedAtHighResolutionMilliseconds: 100,
      durationMilliseconds: 45,
    });

    const snapshotBeforeReset = owner.readSnapshot();
    expect(snapshotBeforeReset.instantEvents).toHaveLength(1);
    expect(snapshotBeforeReset.completedOperations).toEqual([
      {
        sequence: 1,
        name: "thread-list-request",
        startedAtEpochMilliseconds: 1_700_000_000_050,
        completedAtEpochMilliseconds: 1_700_000_000_090,
        startedAtHighResolutionMilliseconds: 50,
        completedAtHighResolutionMilliseconds: 90,
        durationMilliseconds: 40,
        outcome: "succeeded",
        details: {
          path: "/api/threads",
        },
        completionDetails: {
          status: 200,
        },
      },
    ]);
    expect(snapshotBeforeReset.longTasks).toEqual([
      {
        sequence: 3,
        startedAtEpochMilliseconds: 1_700_000_000_100,
        completedAtEpochMilliseconds: 1_700_000_000_145,
        startedAtHighResolutionMilliseconds: 100,
        completedAtHighResolutionMilliseconds: 145,
        durationMilliseconds: 45,
      },
    ]);

    owner.resetRecordedEntries();

    const snapshotAfterReset = owner.readSnapshot();
    expect(snapshotAfterReset.instantEvents).toEqual([]);
    expect(snapshotAfterReset.completedOperations).toEqual([]);
    expect(snapshotAfterReset.longTasks).toEqual([]);
    expect(snapshotAfterReset.freezeWindows).toEqual([]);
  });
});
