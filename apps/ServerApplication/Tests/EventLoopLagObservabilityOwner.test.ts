import { describe, expect, it } from "vitest";
import { EventLoopLagObservabilityOwner } from "../Source/Network/EventLoopLagObservabilityOwner.js";

describe("EventLoopLagObservabilityOwner", () => {
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
