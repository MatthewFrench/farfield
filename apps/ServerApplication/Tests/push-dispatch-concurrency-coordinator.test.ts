import { afterEach, describe, expect, it, vi } from "vitest";
import { PushDispatchConcurrencyCoordinator } from "../Source/Network/PushDispatchConcurrencyCoordinator.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("PushDispatchConcurrencyCoordinator", () => {
  it("debounces repeated schedule calls for the same thread", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const coordinator = new PushDispatchConcurrencyCoordinator(
      100,
      () => true,
      async (threadId) => {
        calls.push(threadId);
      }
    );

    coordinator.schedule("thread_1");
    coordinator.schedule("thread_1");
    coordinator.schedule("thread_1");

    await vi.advanceTimersByTimeAsync(100);

    expect(calls).toEqual(["thread_1"]);
    coordinator.stop();
  });

  it("skips concurrent executions for the same thread", async () => {
    vi.useFakeTimers();
    let releaseCheck: () => void = () => {};
    const checkGate = new Promise<void>((resolve) => {
      releaseCheck = resolve;
    });

    let runCount = 0;
    const coordinator = new PushDispatchConcurrencyCoordinator(
      100,
      () => true,
      async () => {
        runCount += 1;
        await checkGate;
      }
    );

    coordinator.schedule("thread_1");
    await vi.advanceTimersByTimeAsync(100);

    coordinator.schedule("thread_1");
    await vi.advanceTimersByTimeAsync(100);

    expect(runCount).toBe(1);

    releaseCheck();
    await Promise.resolve();
    coordinator.stop();
  });

  it("cancels pending timers when stopped", async () => {
    vi.useFakeTimers();
    let runCount = 0;
    const coordinator = new PushDispatchConcurrencyCoordinator(
      100,
      () => true,
      async () => {
        runCount += 1;
      }
    );

    coordinator.schedule("thread_1");
    coordinator.stop();

    await vi.advanceTimersByTimeAsync(100);

    expect(runCount).toBe(0);
  });
});
