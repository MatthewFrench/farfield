import { afterEach, describe, expect, it, vi } from "vitest";
import { PushDispatchConcurrencyCoordinator } from "../Source/Network/PushDispatchConcurrencyCoordinator.js";

const DEBOUNCE_MILLISECONDS = 100;

afterEach(() => {
  vi.useRealTimers();
});

describe("PushDispatchConcurrencyCoordinator", () => {
  it("rejects non-positive or non-integer debounce durations", () => {
    const shouldSchedule = (): boolean => true;
    const runCheck = async (): Promise<void> => {};

    expect(
      () => new PushDispatchConcurrencyCoordinator(0, shouldSchedule, runCheck)
    ).toThrow("requires positive integer debounceMs");
    expect(
      () => new PushDispatchConcurrencyCoordinator(-1, shouldSchedule, runCheck)
    ).toThrow("requires positive integer debounceMs");
    expect(
      () => new PushDispatchConcurrencyCoordinator(1.5, shouldSchedule, runCheck)
    ).toThrow("requires positive integer debounceMs");
  });

  it("debounces repeated schedule calls for the same thread", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const coordinator = new PushDispatchConcurrencyCoordinator(
      DEBOUNCE_MILLISECONDS,
      () => true,
      async (threadId) => {
        calls.push(threadId);
      }
    );

    coordinator.schedule("thread_1");
    coordinator.schedule("thread_1");
    coordinator.schedule("thread_1");

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    expect(calls).toEqual(["thread_1"]);
    expect(coordinator.readStatistics()).toEqual({
      scheduledCheckCount: 3,
      startedCheckCount: 1,
      completedCheckCount: 1,
      failedCheckCount: 0,
      skippedWhileInFlightCount: 0,
      suppressedSchedulerErrorCount: 0,
      activeTimerCount: 0,
      inFlightThreadCount: 0,
      pendingRerunThreadCount: 0,
      isStopped: false
    });
    coordinator.stop();
  });

  it("requeues concurrent executions for the same thread with deterministic statistics", async () => {
    vi.useFakeTimers();
    let releaseCheck: () => void = () => {};
    const checkGate = new Promise<void>((resolve) => {
      releaseCheck = resolve;
    });

    let runCount = 0;
    const coordinator = new PushDispatchConcurrencyCoordinator(
      DEBOUNCE_MILLISECONDS,
      () => true,
      async () => {
        runCount += 1;
        await checkGate;
      }
    );

    coordinator.schedule("thread_1");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    coordinator.schedule("thread_1");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    expect(runCount).toBe(1);
    expect(coordinator.readStatistics().pendingRerunThreadCount).toBe(1);

    releaseCheck();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    expect(runCount).toBe(2);
    expect(coordinator.readStatistics()).toEqual({
      scheduledCheckCount: 3,
      startedCheckCount: 2,
      completedCheckCount: 2,
      failedCheckCount: 0,
      skippedWhileInFlightCount: 1,
      suppressedSchedulerErrorCount: 0,
      activeTimerCount: 0,
      inFlightThreadCount: 0,
      pendingRerunThreadCount: 0,
      isStopped: false
    });
    coordinator.stop();
  });

  it("cancels pending timers when stopped", async () => {
    vi.useFakeTimers();
    let runCount = 0;
    const coordinator = new PushDispatchConcurrencyCoordinator(
      DEBOUNCE_MILLISECONDS,
      () => true,
      async () => {
        runCount += 1;
      }
    );

    coordinator.schedule("thread_1");
    coordinator.stop();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    expect(runCount).toBe(0);
    expect(coordinator.readStatistics().isStopped).toBe(true);
  });

  it("records failed checks without surfacing unhandled scheduler failures", async () => {
    vi.useFakeTimers();
    const coordinator = new PushDispatchConcurrencyCoordinator(
      DEBOUNCE_MILLISECONDS,
      () => true,
      async () => {
        throw new Error("check failed");
      }
    );

    coordinator.schedule("thread_1");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    expect(coordinator.readStatistics()).toMatchObject({
      startedCheckCount: 1,
      completedCheckCount: 0,
      failedCheckCount: 1,
      suppressedSchedulerErrorCount: 0
    });
    coordinator.stop();
  });

  it("ignores disabled scheduling and blank thread identifiers", async () => {
    vi.useFakeTimers();
    const coordinator = new PushDispatchConcurrencyCoordinator(
      DEBOUNCE_MILLISECONDS,
      () => false,
      async () => {}
    );

    coordinator.schedule("thread_1");
    coordinator.schedule("   ");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    expect(coordinator.readStatistics()).toMatchObject({
      scheduledCheckCount: 0,
      startedCheckCount: 0
    });
    coordinator.stop();
  });

  it("does not rerun pending checks after stop is called", async () => {
    vi.useFakeTimers();
    let releaseCheck: () => void = () => {};
    const checkGate = new Promise<void>((resolve) => {
      releaseCheck = resolve;
    });

    let runCount = 0;
    const coordinator = new PushDispatchConcurrencyCoordinator(
      DEBOUNCE_MILLISECONDS,
      () => true,
      async () => {
        runCount += 1;
        await checkGate;
      }
    );

    coordinator.schedule("thread_1");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);
    coordinator.schedule("thread_1");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);
    coordinator.stop();

    releaseCheck();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

    expect(runCount).toBe(1);
    expect(coordinator.readStatistics()).toEqual({
      scheduledCheckCount: 2,
      startedCheckCount: 1,
      completedCheckCount: 1,
      failedCheckCount: 0,
      skippedWhileInFlightCount: 1,
      suppressedSchedulerErrorCount: 0,
      activeTimerCount: 0,
      inFlightThreadCount: 0,
      pendingRerunThreadCount: 0,
      isStopped: true
    });
  });

  it("suppresses scheduler-owned async policy errors without unhandled rejections", async () => {
    vi.useFakeTimers();
    let shouldScheduleCallCount = 0;
    const shouldSchedule = (): boolean => {
      shouldScheduleCallCount += 1;
      if (shouldScheduleCallCount >= 3) {
        throw new Error("policy failure");
      }

      return true;
    };

    let releaseCheck: () => void = () => {};
    const checkGate = new Promise<void>((resolve) => {
      releaseCheck = resolve;
    });

    let runCount = 0;
    const coordinator = new PushDispatchConcurrencyCoordinator(
      DEBOUNCE_MILLISECONDS,
      shouldSchedule,
      async () => {
        runCount += 1;
        await checkGate;
      }
    );

    let unhandledRejectionCount = 0;
    const onUnhandledRejection = (): void => {
      unhandledRejectionCount += 1;
    };

    process.on("unhandledRejection", onUnhandledRejection);
    try {
      coordinator.schedule("thread_1");
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);
      coordinator.schedule("thread_1");
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);

      releaseCheck();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MILLISECONDS);
      await Promise.resolve();

      expect(runCount).toBe(1);
      expect(unhandledRejectionCount).toBe(0);
      expect(coordinator.readStatistics()).toEqual({
        scheduledCheckCount: 2,
        startedCheckCount: 1,
        completedCheckCount: 1,
        failedCheckCount: 0,
        skippedWhileInFlightCount: 1,
        suppressedSchedulerErrorCount: 1,
        activeTimerCount: 0,
        inFlightThreadCount: 0,
        pendingRerunThreadCount: 0,
        isStopped: false
      });
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
      coordinator.stop();
    }
  });
});
