import {
  describe,
  expect,
  it
} from "vitest";
import { RuntimeRefreshObservabilityOwner } from "../Source/Application/StateManagement/RuntimeRefreshObservabilityOwner";

describe("RuntimeRefreshObservabilityOwner", () => {
  it("records successful refresh counters and timings", async () => {
    const owner = new RuntimeRefreshObservabilityOwner();

    const measurement = owner.beginRefresh();
    await Promise.resolve();
    owner.completeRefreshSuccess(measurement);

    const snapshot = owner.readSnapshot();
    expect(snapshot.totalRefreshCount).toBe(1);
    expect(snapshot.succeededRefreshCount).toBe(1);
    expect(snapshot.failedRefreshCount).toBe(0);
    expect(snapshot.inFlightRefreshCount).toBe(0);
    expect(snapshot.lastDurationMilliseconds).not.toBeNull();
    expect((snapshot.lastDurationMilliseconds ?? -1) >= 0).toBe(true);
    expect(snapshot.averageDurationMilliseconds).not.toBeNull();
    expect(snapshot.longestDurationMilliseconds).not.toBeNull();
    expect(snapshot.lastStartedAtEpochMilliseconds).not.toBeNull();
    expect(snapshot.lastCompletedAtEpochMilliseconds).not.toBeNull();
  });

  it("records failed refresh counters and decrements in-flight count", async () => {
    const owner = new RuntimeRefreshObservabilityOwner();

    const measurement = owner.beginRefresh();
    await Promise.resolve();
    owner.completeRefreshFailure(measurement);

    const snapshot = owner.readSnapshot();
    expect(snapshot.totalRefreshCount).toBe(1);
    expect(snapshot.succeededRefreshCount).toBe(0);
    expect(snapshot.failedRefreshCount).toBe(1);
    expect(snapshot.inFlightRefreshCount).toBe(0);
    expect(snapshot.averageDurationMilliseconds).not.toBeNull();
  });

  it("tracks overlapping in-flight refresh measurements", async () => {
    const owner = new RuntimeRefreshObservabilityOwner();

    const firstMeasurement = owner.beginRefresh();
    const secondMeasurement = owner.beginRefresh();
    expect(owner.readSnapshot().inFlightRefreshCount).toBe(2);

    await Promise.resolve();
    owner.completeRefreshSuccess(firstMeasurement);
    expect(owner.readSnapshot().inFlightRefreshCount).toBe(1);

    owner.completeRefreshFailure(secondMeasurement);
    const snapshot = owner.readSnapshot();
    expect(snapshot.totalRefreshCount).toBe(2);
    expect(snapshot.succeededRefreshCount).toBe(1);
    expect(snapshot.failedRefreshCount).toBe(1);
    expect(snapshot.inFlightRefreshCount).toBe(0);
  });
});
