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

    await expect(
      coordinator.run(async () => {
        if (firstCall) {
          firstCall = false;
          throw new Error("refresh failed");
        }
      }),
    ).rejects.toThrowError("refresh failed");

    await expect(coordinator.run(async () => {})).resolves.toBeUndefined();
  });

  it("coalesces many overlapping run requests into one queued follow-up refresh", async () => {
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
    const thirdRun = coordinator.run(runRefresh);

    await Promise.resolve();
    releaseFirstRefresh();

    await Promise.all([firstRun, secondRun, thirdRun]);

    expect(callCount).toBe(2);
  });

  it("retries queued refresh intent after an in-flight refresh failure", async () => {
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
        throw new Error("first refresh failed");
      }
    };

    const firstRun = coordinator.run(runRefresh);
    const secondRun = coordinator.run(runRefresh);

    await Promise.resolve();
    releaseFirstRefresh();

    await expect(firstRun).resolves.toBeUndefined();
    await expect(secondRun).resolves.toBeUndefined();
    expect(callCount).toBe(2);
  });

  it("surfaces the latest failure when queued retry also fails", async () => {
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
        throw new Error("first refresh failed");
      }
      throw new Error("second refresh failed");
    };

    const firstRun = coordinator.run(runRefresh);
    const secondRun = coordinator.run(runRefresh);

    await Promise.resolve();
    releaseFirstRefresh();

    await expect(firstRun).rejects.toThrowError("second refresh failed");
    await expect(secondRun).rejects.toThrowError("second refresh failed");
    expect(callCount).toBe(2);
  });
});
