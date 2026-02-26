import {
  describe,
  expect,
  it
} from "vitest";
import {
  RuntimeRefreshObservabilityOwner,
  type RuntimeRefreshObservabilityClock
} from "../Source/Application/StateManagement/RuntimeRefreshObservabilityOwner";

class DeterministicRuntimeRefreshObservabilityClock implements RuntimeRefreshObservabilityClock {
  public epochMilliseconds: number;
  public highResolutionMilliseconds: number;

  public constructor(epochMilliseconds: number, highResolutionMilliseconds: number) {
    this.epochMilliseconds = epochMilliseconds;
    this.highResolutionMilliseconds = highResolutionMilliseconds;
  }

  public readEpochMilliseconds(): number {
    return this.epochMilliseconds;
  }

  public readHighResolutionMilliseconds(): number {
    return this.highResolutionMilliseconds;
  }

  public advanceBy(milliseconds: number): void {
    this.epochMilliseconds += milliseconds;
    this.highResolutionMilliseconds += milliseconds;
  }
}

describe("RuntimeRefreshObservabilityOwner", () => {
  it("records successful refresh counters and timings", () => {
    const clock = new DeterministicRuntimeRefreshObservabilityClock(1_000, 2_000);
    const owner = new RuntimeRefreshObservabilityOwner(clock);

    const measurement = owner.beginRefresh();
    clock.advanceBy(25);
    owner.completeRefreshSuccess(measurement);

    const snapshot = owner.readSnapshot();
    expect(snapshot.totalRefreshCount).toBe(1);
    expect(snapshot.succeededRefreshCount).toBe(1);
    expect(snapshot.failedRefreshCount).toBe(0);
    expect(snapshot.inFlightRefreshCount).toBe(0);
    expect(snapshot.lastDurationMilliseconds).toBe(25);
    expect(snapshot.averageDurationMilliseconds).toBe(25);
    expect(snapshot.longestDurationMilliseconds).toBe(25);
    expect(snapshot.lastStartedAtEpochMilliseconds).toBe(1_000);
    expect(snapshot.lastCompletedAtEpochMilliseconds).toBe(1_025);
  });

  it("records failed refresh counters and decrements in-flight count", () => {
    const clock = new DeterministicRuntimeRefreshObservabilityClock(8_000, 9_000);
    const owner = new RuntimeRefreshObservabilityOwner(clock);

    const measurement = owner.beginRefresh();
    clock.advanceBy(10);
    owner.completeRefreshFailure(measurement);

    const snapshot = owner.readSnapshot();
    expect(snapshot.totalRefreshCount).toBe(1);
    expect(snapshot.succeededRefreshCount).toBe(0);
    expect(snapshot.failedRefreshCount).toBe(1);
    expect(snapshot.inFlightRefreshCount).toBe(0);
    expect(snapshot.averageDurationMilliseconds).toBe(10);
  });

  it("tracks overlapping in-flight refresh measurements", () => {
    const clock = new DeterministicRuntimeRefreshObservabilityClock(10_000, 11_000);
    const owner = new RuntimeRefreshObservabilityOwner(clock);

    const firstMeasurement = owner.beginRefresh();
    clock.advanceBy(5);
    const secondMeasurement = owner.beginRefresh();
    expect(owner.readSnapshot().inFlightRefreshCount).toBe(2);

    clock.advanceBy(15);
    owner.completeRefreshSuccess(firstMeasurement);
    expect(owner.readSnapshot().inFlightRefreshCount).toBe(1);

    clock.advanceBy(20);
    owner.completeRefreshFailure(secondMeasurement);
    const snapshot = owner.readSnapshot();
    expect(snapshot.totalRefreshCount).toBe(2);
    expect(snapshot.succeededRefreshCount).toBe(1);
    expect(snapshot.failedRefreshCount).toBe(1);
    expect(snapshot.inFlightRefreshCount).toBe(0);
    expect(snapshot.lastDurationMilliseconds).toBe(35);
    expect(snapshot.longestDurationMilliseconds).toBe(35);
    expect(snapshot.averageDurationMilliseconds).toBe(27.5);
  });

  it("never reports negative in-flight counts when completion is invoked more than once", () => {
    const clock = new DeterministicRuntimeRefreshObservabilityClock(20_000, 30_000);
    const owner = new RuntimeRefreshObservabilityOwner(clock);

    const measurement = owner.beginRefresh();
    clock.advanceBy(12);
    owner.completeRefreshSuccess(measurement);
    owner.completeRefreshFailure(measurement);

    expect(owner.readSnapshot().inFlightRefreshCount).toBe(0);
  });
});
