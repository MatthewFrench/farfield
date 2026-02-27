import { describe, expect, it } from "vitest";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";

function waitForMilliseconds(durationMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

describe("ThreadConcurrencyCoordinator", () => {
  it("serializes operations for the same thread", async () => {
    const coordinator = new ThreadConcurrencyCoordinator();
    const executionOrder: string[] = [];

    const firstOperation = coordinator.runExclusive("thread_1", async () => {
      executionOrder.push("first:start");
      await waitForMilliseconds(30);
      executionOrder.push("first:end");
      return "first";
    });

    const secondOperation = coordinator.runExclusive("thread_1", async () => {
      executionOrder.push("second:start");
      executionOrder.push("second:end");
      return "second";
    });

    const results = await Promise.all([firstOperation, secondOperation]);

    expect(results).toEqual(["first", "second"]);
    expect(executionOrder).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("allows concurrent operations for different threads", async () => {
    const coordinator = new ThreadConcurrencyCoordinator();
    let releaseFirstOperation: () => void = () => {};
    const firstOperationGate = new Promise<void>((resolve) => {
      releaseFirstOperation = resolve;
    });

    let secondOperationCompleted = false;

    const firstOperation = coordinator.runExclusive("thread_1", async () => {
      await firstOperationGate;
      return "first";
    });

    const secondOperation = coordinator.runExclusive("thread_2", async () => {
      secondOperationCompleted = true;
      return "second";
    });

    await secondOperation;
    expect(secondOperationCompleted).toBe(true);

    releaseFirstOperation();
    await firstOperation;
  });

  it("continues processing after a failed operation", async () => {
    const coordinator = new ThreadConcurrencyCoordinator();
    const executionOrder: string[] = [];
    let releaseFirstOperation: () => void = () => {};
    const firstOperationGate = new Promise<void>((resolve) => {
      releaseFirstOperation = resolve;
    });

    const firstOperation = coordinator.runExclusive("thread_1", async () => {
      executionOrder.push("first:start");
      await firstOperationGate;
      executionOrder.push("first:throw");
      throw new Error("operation failed");
    });
    const secondOperation = coordinator.runExclusive("thread_1", async () => {
      executionOrder.push("second:start");
      executionOrder.push("second:end");
      return "second";
    });

    const thirdOperation = coordinator.runExclusive("thread_1", async () => {
      executionOrder.push("third:start");
      executionOrder.push("third:end");
      return "third";
    });

    releaseFirstOperation();

    await expect(firstOperation).rejects.toThrow("operation failed");
    await expect(secondOperation).resolves.toBe("second");
    await expect(thirdOperation).resolves.toBe("third");

    expect(executionOrder).toEqual([
      "first:start",
      "first:throw",
      "second:start",
      "second:end",
      "third:start",
      "third:end",
    ]);

    const statistics = coordinator.readStatistics();
    expect(statistics).toEqual({
      queuedExecutionCount: 3,
      completedExecutionCount: 2,
      failedExecutionCount: 1,
      activeThreadCount: 0,
      inFlightThreadCount: 0,
      pendingExecutionCount: 0,
    });
  });

  it("normalizes thread identifiers before applying per-thread serialization", async () => {
    const coordinator = new ThreadConcurrencyCoordinator();
    const executionOrder: string[] = [];
    let releaseFirstOperation: () => void = () => {};
    const firstOperationGate = new Promise<void>((resolve) => {
      releaseFirstOperation = resolve;
    });

    const firstOperation = coordinator.runExclusive("  thread_1\t", async () => {
      executionOrder.push("first:start");
      await firstOperationGate;
      executionOrder.push("first:end");
      return "first";
    });

    const secondOperation = coordinator.runExclusive("\nthread_1  ", async () => {
      executionOrder.push("second:start");
      executionOrder.push("second:end");
      return "second";
    });

    await Promise.resolve();
    expect(executionOrder).toEqual(["first:start"]);

    releaseFirstOperation();
    await expect(firstOperation).resolves.toBe("first");
    await expect(secondOperation).resolves.toBe("second");

    expect(executionOrder).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("reports active-thread and in-flight telemetry while operations are running", async () => {
    const coordinator = new ThreadConcurrencyCoordinator();
    let releaseThreadOneOperation: () => void = () => {};
    const threadOneGate = new Promise<void>((resolve) => {
      releaseThreadOneOperation = resolve;
    });
    let releaseThreadTwoOperation: () => void = () => {};
    const threadTwoGate = new Promise<void>((resolve) => {
      releaseThreadTwoOperation = resolve;
    });

    const threadOneOperation = coordinator.runExclusive("thread_1", async () => {
      await threadOneGate;
      return "thread_1:first";
    });

    await Promise.resolve();
    expect(coordinator.readStatistics()).toEqual({
      queuedExecutionCount: 1,
      completedExecutionCount: 0,
      failedExecutionCount: 0,
      activeThreadCount: 1,
      inFlightThreadCount: 1,
      pendingExecutionCount: 1,
    });

    const queuedThreadOneOperation = coordinator.runExclusive("thread_1", async () => {
      return "thread_1:second";
    });

    let threadTwoOperationStarted = false;
    const threadTwoOperation = coordinator.runExclusive("thread_2", async () => {
      threadTwoOperationStarted = true;
      await threadTwoGate;
      return "thread_2:first";
    });

    await Promise.resolve();
    expect(threadTwoOperationStarted).toBe(true);
    expect(coordinator.readStatistics()).toEqual({
      queuedExecutionCount: 3,
      completedExecutionCount: 0,
      failedExecutionCount: 0,
      activeThreadCount: 2,
      inFlightThreadCount: 2,
      pendingExecutionCount: 3,
    });

    releaseThreadTwoOperation();
    releaseThreadOneOperation();
    await Promise.all([threadOneOperation, queuedThreadOneOperation, threadTwoOperation]);

    expect(coordinator.readStatistics()).toEqual({
      queuedExecutionCount: 3,
      completedExecutionCount: 3,
      failedExecutionCount: 0,
      activeThreadCount: 0,
      inFlightThreadCount: 0,
      pendingExecutionCount: 0,
    });
  });

  it("rejects blank thread identifiers at the owner boundary", async () => {
    const coordinator = new ThreadConcurrencyCoordinator();

    await expect(coordinator.runExclusive("   ", async () => "never")).rejects.toThrow(
      "ThreadConcurrencyCoordinator requires non-empty threadId",
    );

    expect(coordinator.readStatistics()).toEqual({
      queuedExecutionCount: 0,
      completedExecutionCount: 0,
      failedExecutionCount: 0,
      activeThreadCount: 0,
      inFlightThreadCount: 0,
      pendingExecutionCount: 0,
    });
  });

  it("keeps queue continuity after an immediate failure before queued work", async () => {
    const coordinator = new ThreadConcurrencyCoordinator();

    await expect(
      coordinator.runExclusive("thread_1", async () => {
        throw new Error("operation failed");
      }),
    ).rejects.toThrow("operation failed");

    const result = await coordinator.runExclusive("thread_1", async () => "ok");
    expect(result).toBe("ok");

    const statistics = coordinator.readStatistics();
    expect(statistics).toEqual({
      queuedExecutionCount: 2,
      completedExecutionCount: 1,
      failedExecutionCount: 1,
      activeThreadCount: 0,
      inFlightThreadCount: 0,
      pendingExecutionCount: 0,
    });
  });
});
