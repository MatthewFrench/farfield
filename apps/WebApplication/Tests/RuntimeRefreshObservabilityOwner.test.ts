import { describe, expect, it } from "vitest";
import {
  type RuntimeRefreshMeasurement,
  type RuntimeRefreshObservabilityClock,
  RuntimeRefreshObservabilityOwner,
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
    expect(owner.completeRefreshSuccess(measurement)).toBe(true);

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
    expect(owner.completeRefreshFailure(measurement)).toBe(true);

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
    expect(owner.completeRefreshSuccess(firstMeasurement)).toBe(true);
    expect(owner.readSnapshot().inFlightRefreshCount).toBe(1);

    clock.advanceBy(20);
    expect(owner.completeRefreshFailure(secondMeasurement)).toBe(true);
    const snapshot = owner.readSnapshot();
    expect(snapshot.totalRefreshCount).toBe(2);
    expect(snapshot.succeededRefreshCount).toBe(1);
    expect(snapshot.failedRefreshCount).toBe(1);
    expect(snapshot.inFlightRefreshCount).toBe(0);
    expect(snapshot.lastDurationMilliseconds).toBe(35);
    expect(snapshot.longestDurationMilliseconds).toBe(35);
    expect(snapshot.averageDurationMilliseconds).toBe(27.5);
  });

  it("treats refresh measurements as one-time completion tokens", () => {
    const clock = new DeterministicRuntimeRefreshObservabilityClock(20_000, 30_000);
    const owner = new RuntimeRefreshObservabilityOwner(clock);

    const measurement = owner.beginRefresh();
    clock.advanceBy(12);
    expect(owner.completeRefreshSuccess(measurement)).toBe(true);
    const completedSnapshot = owner.readSnapshot();

    clock.advanceBy(50);
    expect(owner.completeRefreshSuccess(measurement)).toBe(false);
    expect(owner.completeRefreshFailure(measurement)).toBe(false);

    const untrackedMeasurement: RuntimeRefreshMeasurement = {
      startedAtEpochMilliseconds: 20_000,
      startedAtHighResolutionMilliseconds: 30_000,
    };
    expect(owner.completeRefreshFailure(untrackedMeasurement)).toBe(false);

    const duplicateSnapshot = owner.readSnapshot();
    expect(duplicateSnapshot).toEqual(completedSnapshot);
    expect(duplicateSnapshot.succeededRefreshCount).toBe(1);
    expect(duplicateSnapshot.failedRefreshCount).toBe(0);
    expect(duplicateSnapshot.averageDurationMilliseconds).toBe(12);
    expect(duplicateSnapshot.inFlightRefreshCount).toBe(0);
  });

  it("does not inflate failed refresh aggregates when duplicate completion is attempted", () => {
    const clock = new DeterministicRuntimeRefreshObservabilityClock(40_000, 50_000);
    const owner = new RuntimeRefreshObservabilityOwner(clock);

    const measurement = owner.beginRefresh();
    clock.advanceBy(14);
    expect(owner.completeRefreshFailure(measurement)).toBe(true);
    const completedSnapshot = owner.readSnapshot();

    clock.advanceBy(31);
    expect(owner.completeRefreshFailure(measurement)).toBe(false);
    expect(owner.completeRefreshSuccess(measurement)).toBe(false);

    const duplicateSnapshot = owner.readSnapshot();
    expect(duplicateSnapshot).toEqual(completedSnapshot);
    expect(duplicateSnapshot.succeededRefreshCount).toBe(0);
    expect(duplicateSnapshot.failedRefreshCount).toBe(1);
    expect(duplicateSnapshot.averageDurationMilliseconds).toBe(14);
    expect(duplicateSnapshot.longestDurationMilliseconds).toBe(14);
  });
});
