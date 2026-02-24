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
    expect(executionOrder).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end"
    ]);
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

    await expect(
      coordinator.runExclusive("thread_1", async () => {
        throw new Error("operation failed");
      })
    ).rejects.toThrow("operation failed");

    const result = await coordinator.runExclusive("thread_1", async () => "ok");
    expect(result).toBe("ok");

    const statistics = coordinator.readStatistics();
    expect(statistics.queuedExecutionCount).toBe(2);
    expect(statistics.failedExecutionCount).toBe(1);
    expect(statistics.completedExecutionCount).toBe(1);
    expect(statistics.activeThreadCount).toBe(0);
  });
});
