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
  it("projects thread-status updates and account-app refresh markers from notification events", () => {
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
          method: "account/rateLimits/updated",
          params: {},
          receivedAtMilliseconds: 8_101,
        },
        {
          sequence: 103,
          method: "app/list/updated",
          params: {},
          receivedAtMilliseconds: 8_102,
        },
      ]),
    );

    expect(projection).toEqual({
      processedEventCount: 3,
      relevantEventCount: 3,
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
      shouldRefreshAccountRateLimits: false,
      shouldRefreshApps: false,
    });
  });
});
