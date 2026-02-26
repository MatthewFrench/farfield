import { describe, expect, it } from "vitest";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";

describe("PushMutationConcurrencyCoordinator", () => {
  it("serializes operations in submission order", async () => {
    const coordinator = new PushMutationConcurrencyCoordinator();
    const callOrder: string[] = [];

    const firstOperation = coordinator.runExclusive(async () => {
      callOrder.push("first:start");
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      callOrder.push("first:end");
      return "first-result";
    });

    const secondOperation = coordinator.runExclusive(async () => {
      callOrder.push("second:start");
      callOrder.push("second:end");
      return "second-result";
    });

    const [firstResult, secondResult] = await Promise.all([firstOperation, secondOperation]);

    expect(firstResult).toBe("first-result");
    expect(secondResult).toBe("second-result");
    expect(callOrder).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end"
    ]);
    expect(coordinator.readStatistics()).toMatchObject({
      queuedExecutionCount: 2,
      completedExecutionCount: 2,
      failedExecutionCount: 0,
      hasInFlightOperation: false
    });
  });

  it("records failed executions and continues processing", async () => {
    const coordinator = new PushMutationConcurrencyCoordinator();

    await expect(
      coordinator.runExclusive(async () => {
        throw new Error("operation failed");
      })
    ).rejects.toThrow("operation failed");

    const value = await coordinator.runExclusive(async () => "next");
    expect(value).toBe("next");
    expect(coordinator.readStatistics()).toMatchObject({
      queuedExecutionCount: 2,
      completedExecutionCount: 1,
      failedExecutionCount: 1,
      hasInFlightOperation: false
    });
  });

  it("exposes in-flight status while an operation is waiting for completion", async () => {
    const coordinator = new PushMutationConcurrencyCoordinator();
    let releaseOperation: () => void = () => {};
    const operationGate = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });

    const inFlightOperation = coordinator.runExclusive(async () => {
      await operationGate;
      return "done";
    });

    await Promise.resolve();
    expect(coordinator.readStatistics().hasInFlightOperation).toBe(true);

    releaseOperation();
    await inFlightOperation;

    expect(coordinator.readStatistics().hasInFlightOperation).toBe(false);
  });
});
