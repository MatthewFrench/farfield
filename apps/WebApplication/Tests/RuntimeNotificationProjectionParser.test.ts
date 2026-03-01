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
  it("projects thread status/progress/token/model updates plus account-app refresh markers", () => {
    const projection = readRuntimeNotificationProjection(
      createNotificationEventsResponse([
        {
          sequence: 100,
          method: "thread/started",
          params: {
            thread: {
              id: "thread-1",
              preview: "Thread one",
              modelProvider: "openai",
            },
          },
          receivedAtMilliseconds: 8_099,
        },
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
          sequence: 107,
          method: "thread/compacted",
          params: {
            threadId: "thread-1",
            turnId: "turn-2",
          },
          receivedAtMilliseconds: 8_106,
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
        {
          sequence: 108,
          method: "configWarning",
          params: {
            summary: "Config file has an unknown key",
            details: null,
          },
          receivedAtMilliseconds: 8_107,
        },
        {
          sequence: 109,
          method: "error",
          params: {
            error: {
              message: "Turn failed to stream",
            },
            willRetry: true,
            threadId: "thread-1",
            turnId: "turn-2",
          },
          receivedAtMilliseconds: 8_108,
        },
        {
          sequence: 110,
          method: "turn/started",
          params: {
            threadId: "thread-1",
            turn: {
              id: "turn-3",
            },
          },
          receivedAtMilliseconds: 8_109,
        },
        {
          sequence: 111,
          method: "turn/completed",
          params: {
            threadId: "thread-1",
            turn: {
              id: "turn-3",
            },
          },
          receivedAtMilliseconds: 8_110,
        },
        {
          sequence: 112,
          method: "thread/realtime/started",
          params: {
            threadId: "thread-1",
            sessionId: "session-1",
          },
          receivedAtMilliseconds: 8_111,
        },
        {
          sequence: 113,
          method: "thread/realtime/error",
          params: {
            threadId: "thread-1",
            message: "Realtime stream interrupted",
          },
          receivedAtMilliseconds: 8_112,
        },
        {
          sequence: 114,
          method: "thread/realtime/closed",
          params: {
            threadId: "thread-1",
            reason: "session ended",
          },
          receivedAtMilliseconds: 8_113,
        },
      ]),
    );

    expect(projection).toEqual({
      processedEventCount: 15,
      relevantEventCount: 15,
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
      threadProgressEvents: [
        {
          method: "thread/started",
          sequence: 100,
          threadId: "thread-1",
          turnId: null,
          preview: "Thread one",
          modelProvider: "openai",
          receivedAtMilliseconds: 8_099,
        },
        {
          method: "thread/compacted",
          sequence: 107,
          threadId: "thread-1",
          turnId: "turn-2",
          preview: null,
          modelProvider: null,
          receivedAtMilliseconds: 8_106,
        },
        {
          method: "turn/started",
          sequence: 110,
          threadId: "thread-1",
          turnId: "turn-3",
          preview: null,
          modelProvider: null,
          receivedAtMilliseconds: 8_109,
        },
        {
          method: "turn/completed",
          sequence: 111,
          threadId: "thread-1",
          turnId: "turn-3",
          preview: null,
          modelProvider: null,
          receivedAtMilliseconds: 8_110,
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
      warningEvents: [
        {
          method: "configWarning",
          sequence: 108,
          summary: "Config file has an unknown key",
          threadId: null,
          isRetrying: false,
          receivedAtMilliseconds: 8_107,
        },
        {
          method: "error",
          sequence: 109,
          summary: "Turn failed to stream",
          threadId: "thread-1",
          isRetrying: true,
          receivedAtMilliseconds: 8_108,
        },
        {
          method: "thread/realtime/started",
          sequence: 112,
          summary: "Started",
          threadId: "thread-1",
          isRetrying: false,
          receivedAtMilliseconds: 8_111,
        },
        {
          method: "error",
          sequence: 113,
          summary: "Realtime: Realtime stream interrupted",
          threadId: "thread-1",
          isRetrying: false,
          receivedAtMilliseconds: 8_112,
        },
        {
          method: "thread/realtime/closed",
          sequence: 114,
          summary: "Closed (session ended)",
          threadId: "thread-1",
          isRetrying: false,
          receivedAtMilliseconds: 8_113,
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
      threadProgressEvents: [],
      warningEvents: [],
      threadTokenUsageUpdates: [],
      modelRerouteEvents: [],
      shouldRefreshAccount: false,
      shouldRefreshAccountRateLimits: false,
      shouldRefreshApps: false,
    });
  });
});
