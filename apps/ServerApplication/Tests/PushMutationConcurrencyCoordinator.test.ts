import { describe, expect, it } from "vitest";
import { PushMutationConcurrencyCoordinator } from "../Source/Network/PushMutationConcurrencyCoordinator.js";

interface DeferredGate {
  promise: Promise<void>;
  release: () => void;
}

const createDeferredGate = (): DeferredGate => {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    promise,
    release
  };
};

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

  it("exposes in-flight status while operations are queued and waiting for completion", async () => {
    const coordinator = new PushMutationConcurrencyCoordinator();
    const firstOperationGate = createDeferredGate();

    const firstOperation = coordinator.runExclusive(async () => {
      await firstOperationGate.promise;
      return "first-done";
    });
    const secondOperation = coordinator.runExclusive(async () => "second-done");

    await Promise.resolve();
    expect(coordinator.readStatistics().hasInFlightOperation).toBe(true);

    firstOperationGate.release();
    await Promise.all([firstOperation, secondOperation]);

    expect(coordinator.readStatistics().hasInFlightOperation).toBe(false);
  });

  it("continues queued operations after an earlier queued execution fails", async () => {
    const coordinator = new PushMutationConcurrencyCoordinator();
    const firstOperationGate = createDeferredGate();
    const callOrder: string[] = [];

    const firstOperation = coordinator.runExclusive(async () => {
      callOrder.push("first:start");
      await firstOperationGate.promise;
      callOrder.push("first:fail");
      throw new Error("first failed");
    });
    const secondOperation = coordinator.runExclusive(async () => {
      callOrder.push("second:start");
      callOrder.push("second:end");
      return "second-result";
    });

    await Promise.resolve();
    expect(coordinator.readStatistics().hasInFlightOperation).toBe(true);

    firstOperationGate.release();
    await expect(firstOperation).rejects.toThrow("first failed");
    await expect(secondOperation).resolves.toBe("second-result");

    expect(callOrder).toEqual([
      "first:start",
      "first:fail",
      "second:start",
      "second:end"
    ]);
    expect(coordinator.readStatistics()).toMatchObject({
      queuedExecutionCount: 2,
      completedExecutionCount: 1,
      failedExecutionCount: 1,
      hasInFlightOperation: false
    });
  });

  it("records synchronous throws as failures and drains queued operations", async () => {
    const coordinator = new PushMutationConcurrencyCoordinator();

    const failingOperation = coordinator.runExclusive(() => {
      throw new Error("synchronous failure");
    });
    const secondOperation = coordinator.runExclusive(async () => "next");

    await expect(failingOperation).rejects.toThrow("synchronous failure");
    await expect(secondOperation).resolves.toBe("next");
    expect(coordinator.readStatistics()).toMatchObject({
      queuedExecutionCount: 2,
      completedExecutionCount: 1,
      failedExecutionCount: 1,
      hasInFlightOperation: false
    });
  });
});
