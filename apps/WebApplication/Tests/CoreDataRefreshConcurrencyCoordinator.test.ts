import { describe, expect, it } from "vitest";
import { CoreDataRefreshConcurrencyCoordinator } from "../Source/Application/StateManagement/CoreDataRefreshConcurrencyCoordinator";

describe("CoreDataRefreshConcurrencyCoordinator", () => {
  it("queues one additional refresh while a refresh is in flight", async () => {
    const coordinator = new CoreDataRefreshConcurrencyCoordinator();
    let callCount = 0;
    let releaseFirstRefresh: () => void = () => {
      throw new Error("Expected releaseFirstRefresh to be initialized");
    };
    const firstRefreshGate = new Promise<void>((resolve) => {
      releaseFirstRefresh = resolve;
    });

    const runRefresh = async (): Promise<void> => {
      callCount += 1;
      if (callCount === 1) {
        await firstRefreshGate;
      }
    };

    const firstRun = coordinator.run(runRefresh);
    const secondRun = coordinator.run(runRefresh);

    await Promise.resolve();
    releaseFirstRefresh();

    await Promise.all([firstRun, secondRun]);

    expect(callCount).toBe(2);
  });

  it("allows later runs after an earlier run throws", async () => {
    const coordinator = new CoreDataRefreshConcurrencyCoordinator();
    let firstCall = true;

    await expect(coordinator.run(async () => {
      if (firstCall) {
        firstCall = false;
        throw new Error("refresh failed");
      }
    })).rejects.toThrowError("refresh failed");

    await expect(coordinator.run(async () => {})).resolves.toBeUndefined();
  });
});
