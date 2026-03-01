import { describe, expect, it } from "vitest";
import { readRuntimeNotificationProjection } from "../Source/Application/StateManagement/RuntimeNotificationProjectionParser";
import { type CapabilityNotificationEventsResponse } from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";

function createNotificationEventsResponse(
  events: CapabilityNotificationEventsResponse["events"],
): CapabilityNotificationEventsResponse {
  return {
    ok: true,
    events,
    nextSequence: 200,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
}

describe("RuntimeNotificationProjectionParser", () => {
  it("projects thread-status and token/model updates plus account-app refresh markers", () => {
    const projection = readRuntimeNotificationProjection(
      createNotificationEventsResponse([
        {
          sequence: 101,
          method: "thread/status/changed",
          params: {
            threadId: "thread-1",
            status: {
              type: "active",
              activeFlags: ["waitingOnApproval"],
            },
          },
          receivedAtMilliseconds: 8_100,
        },
        {
          sequence: 102,
          method: "account/updated",
          params: {},
          receivedAtMilliseconds: 8_101,
        },
        {
          sequence: 103,
          method: "account/rateLimits/updated",
          params: {},
          receivedAtMilliseconds: 8_102,
        },
        {
          sequence: 104,
          method: "app/list/updated",
          params: {},
          receivedAtMilliseconds: 8_103,
        },
        {
          sequence: 105,
          method: "thread/tokenUsage/updated",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            tokenUsage: {
              total: {
                totalTokens: 42_000,
                inputTokens: 20_000,
                cachedInputTokens: 1_000,
                outputTokens: 22_000,
                reasoningOutputTokens: 8_000,
              },
              last: {
                totalTokens: 5_000,
                inputTokens: 2_000,
                cachedInputTokens: 300,
                outputTokens: 3_000,
                reasoningOutputTokens: 1_000,
              },
              modelContextWindow: 200_000,
            },
          },
          receivedAtMilliseconds: 8_104,
        },
        {
          sequence: 106,
          method: "model/rerouted",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            fromModel: "gpt-5",
            toModel: "gpt-5-safe",
            reason: "highRiskCyberActivity",
          },
          receivedAtMilliseconds: 8_105,
        },
      ]),
    );

    expect(projection).toEqual({
      processedEventCount: 6,
      relevantEventCount: 6,
      resetRequired: false,
      nextSequence: 200,
      threadStatusUpdates: [
        {
          sequence: 101,
          threadId: "thread-1",
          statusType: "active",
          activeFlags: ["waitingOnApproval"],
          receivedAtMilliseconds: 8_100,
        },
      ],
      threadTokenUsageUpdates: [
        {
          sequence: 105,
          threadId: "thread-1",
          turnId: "turn-1",
          totalTokens: 42_000,
          lastTotalTokens: 5_000,
          modelContextWindow: 200_000,
          receivedAtMilliseconds: 8_104,
        },
      ],
      modelRerouteEvents: [
        {
          sequence: 106,
          threadId: "thread-1",
          turnId: "turn-1",
          fromModel: "gpt-5",
          toModel: "gpt-5-safe",
          reason: "highRiskCyberActivity",
          receivedAtMilliseconds: 8_105,
        },
      ],
      shouldRefreshAccount: true,
      shouldRefreshAccountRateLimits: true,
      shouldRefreshApps: true,
    });
  });

  it("fails fast when known thread-status notification params do not match schema", () => {
    expect(() =>
      readRuntimeNotificationProjection(
        createNotificationEventsResponse([
          {
            sequence: 101,
            method: "thread/status/changed",
            params: {
              threadId: "thread-1",
              status: {
                type: "active",
              },
            },
            receivedAtMilliseconds: 8_100,
          },
        ]),
      ),
    ).toThrowError();
  });

  it("skips unrelated notification methods", () => {
    const projection = readRuntimeNotificationProjection(
      createNotificationEventsResponse([
        {
          sequence: 101,
          method: "thread/archived",
          params: {
            threadId: "thread-1",
          },
          receivedAtMilliseconds: 8_100,
        },
      ]),
    );

    expect(projection).toEqual({
      processedEventCount: 1,
      relevantEventCount: 0,
      resetRequired: false,
      nextSequence: 200,
      threadStatusUpdates: [],
      threadTokenUsageUpdates: [],
      modelRerouteEvents: [],
      shouldRefreshAccount: false,
      shouldRefreshAccountRateLimits: false,
      shouldRefreshApps: false,
    });
  });
});
