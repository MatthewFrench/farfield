import { describe, expect, it } from "vitest";
import { EventLoopLagObservabilityOwner } from "../Source/Network/EventLoopLagObservabilityOwner.js";

describe("EventLoopLagObservabilityOwner", () => {
  it("rejects invalid constructor bounds", () => {
    expect(() => new EventLoopLagObservabilityOwner(0, 10)).toThrow(
      "EventLoopLagObservabilityOwner requires a positive integer sampleIntervalMs"
    );
    expect(() => new EventLoopLagObservabilityOwner(10, 0)).toThrow(
      "EventLoopLagObservabilityOwner requires a positive integer maxSamples"
    );
  });

  it("records lag values from injected scheduling dependencies", () => {
    let nowMs = 1_000;
    let scheduledCallback: (() => void) | null = null;
    const owner = new EventLoopLagObservabilityOwner(10, 4, {
      now: () => nowMs,
      scheduleInterval: (callback) => {
        scheduledCallback = callback;
        return setInterval(() => {}, 60_000);
      },
      clearScheduledInterval: (timerHandle) => {
        clearInterval(timerHandle);
      }
    });

    owner.start();
    if (!scheduledCallback) {
      throw new Error("Expected lag sampler callback to be scheduled");
    }

    nowMs = 1_013;
    scheduledCallback();
    nowMs = 1_026;
    scheduledCallback();

    owner.stop();

    const statistics = owner.readStatistics();
    expect(statistics.sampleCount).toBe(2);
    expect(statistics.lastLagMs).toBe(3);
    expect(statistics.maxLagMs).toBe(3);
  });

  it("records bounded lag samples", async () => {
    const owner = new EventLoopLagObservabilityOwner(5, 4);
    owner.start();

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 30);
    });

    owner.stop();

    const statistics = owner.readStatistics();
    expect(statistics.sampleIntervalMs).toBe(5);
    expect(statistics.sampleCount).toBeGreaterThan(0);
    expect(statistics.sampleCount).toBeLessThanOrEqual(4);
    expect(statistics.maxLagMs).toBeGreaterThanOrEqual(0);
  });
});
