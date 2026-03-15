import { describe, expect, it } from "vitest";
import { RuntimeNotificationReadObservabilityOwner } from "../Source/Application/StateManagement/RuntimeNotificationReadObservabilityOwner";

describe("RuntimeNotificationReadObservabilityOwner", () => {
  it("requires a positive integer sample interval", () => {
    expect(() => new RuntimeNotificationReadObservabilityOwner(0)).toThrowError(
      "RuntimeNotificationReadObservabilityOwner requires a positive integer summarySampleInterval",
    );
    expect(() => new RuntimeNotificationReadObservabilityOwner(-1)).toThrowError(
      "RuntimeNotificationReadObservabilityOwner requires a positive integer summarySampleInterval",
    );
    expect(() => new RuntimeNotificationReadObservabilityOwner(1.5)).toThrowError(
      "RuntimeNotificationReadObservabilityOwner requires a positive integer summarySampleInterval",
    );
  });

  it("emits sampled summaries at the configured interval", () => {
    const owner = new RuntimeNotificationReadObservabilityOwner(2);

    const firstSummary = owner.recordRead({
      processedEventCount: 3,
      relevantEventCount: 2,
      threadStatusUpdateCount: 1,
      requestedRateLimitRefresh: false,
      requestedAppsRefresh: false,
      resetRequired: false,
    });
    expect(firstSummary).toBeNull();

    const secondSummary = owner.recordRead({
      processedEventCount: 2,
      relevantEventCount: 1,
      threadStatusUpdateCount: 0,
      requestedRateLimitRefresh: true,
      requestedAppsRefresh: false,
      resetRequired: false,
    });
    expect(secondSummary).toEqual({
      totalReadCount: 2,
      totalProcessedEventCount: 5,
      totalRelevantEventCount: 3,
      totalThreadStatusUpdateCount: 1,
      totalRateLimitRefreshRequests: 1,
      totalAppsRefreshRequests: 0,
      totalResetRequiredReads: 0,
    });
  });

  it("emits an immediate summary when reset-required batches are observed", () => {
    const owner = new RuntimeNotificationReadObservabilityOwner(10);

    const summary = owner.recordRead({
      processedEventCount: 1,
      relevantEventCount: 1,
      threadStatusUpdateCount: 0,
      requestedRateLimitRefresh: false,
      requestedAppsRefresh: true,
      resetRequired: true,
    });

    expect(summary).toEqual({
      totalReadCount: 1,
      totalProcessedEventCount: 1,
      totalRelevantEventCount: 1,
      totalThreadStatusUpdateCount: 0,
      totalRateLimitRefreshRequests: 0,
      totalAppsRefreshRequests: 1,
      totalResetRequiredReads: 1,
    });
  });
});
