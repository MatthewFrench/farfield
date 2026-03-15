import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, triggerHeaderRefresh } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";

interface NotificationEventsResponse {
  ok: true;
  events: Array<{
    sequence: number;
    method: string;
    params: Record<string, string | number | boolean | null>;
    receivedAtMilliseconds: number;
  }>;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

interface EventsSessionResponse {
  ok: true;
  authRequired: boolean;
  bootstrapped: boolean;
  expiresAt: string | null;
}

function buildNotificationEventsResponse(input: {
  events: NotificationEventsResponse["events"];
  nextSequence: number;
}): NotificationEventsResponse {
  return {
    ok: true,
    events: input.events,
    nextSequence: input.nextSequence,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
}

function buildEventsSessionResponse(): EventsSessionResponse {
  return {
    ok: true,
    authRequired: false,
    bootstrapped: true,
    expiresAt: null,
  };
}

function buildActivityHistoryEventEnvelope(method: string): string {
  return JSON.stringify({
    sequence: 910,
    event: {
      type: "activity-history-appended",
      entry: {
        id: "entry-runtime-warning-1",
        at: "2026-03-01T22:00:00.000Z",
        source: "app",
        direction: "out",
        payload: {
          type: "action",
          action: method,
        },
        meta: {
          method,
          threadId: null,
        },
      },
    },
  });
}

test("runtime warning banner keeps stable node identity across header refresh", async ({
  page,
  sentinel,
}) => {
  const eventsSessionUrlPattern = "**/api/events/session";
  const rootEventStreamUrlPattern = /^https?:\/\/[^/]+\/events(?:\?.*)?$/;
  const notificationsEventsUrlPattern = /\/api\/notifications\/events(?:\?.*)?$/;
  let notificationReadCount = 0;
  let nextNotificationSequence = 501;

  await page.route(eventsSessionUrlPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildEventsSessionResponse()),
    });
  });

  await page.route(rootEventStreamUrlPattern, async (route) => {
    const eventPayload = buildActivityHistoryEventEnvelope("configWarning");
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body: `data: ${eventPayload}\n\n`,
    });
  });

  await page.route(notificationsEventsUrlPattern, async (route) => {
    notificationReadCount += 1;
    const sequence = nextNotificationSequence;
    nextNotificationSequence += 1;
    const responseBody = buildNotificationEventsResponse({
      events: [
        {
          sequence,
          method: "configWarning",
          params: {
            summary: "Synthetic runtime warning",
            details: null,
          },
          receivedAtMilliseconds: 1_700_000_000_100 + sequence,
        },
      ],
      nextSequence: nextNotificationSequence,
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseBody),
    });
  });

  try {
    await openAppHome(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);

    const runtimeWarningBanner = page.getByTestId("header-runtime-warning-banner");
    await expect(runtimeWarningBanner).toHaveText("Warning: Synthetic runtime warning", {
      timeout: 45_000,
    });
    const bannerNodeBeforeRefresh = await runtimeWarningBanner.elementHandle();
    expect(bannerNodeBeforeRefresh).not.toBeNull();
    expect(notificationReadCount).toBeGreaterThan(0);

    await triggerHeaderRefresh(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
    await expect(runtimeWarningBanner).toHaveText("Warning: Synthetic runtime warning");

    const bannerNodeAfterRefresh = await runtimeWarningBanner.elementHandle();
    expect(bannerNodeAfterRefresh).not.toBeNull();
    if (bannerNodeBeforeRefresh === null || bannerNodeAfterRefresh === null) {
      throw new Error("Expected runtime warning banner handles");
    }
    const warningBannerIdentityIsStable = await bannerNodeBeforeRefresh.evaluate(
      (previousNode, nextNode) => previousNode === nextNode,
      bannerNodeAfterRefresh,
    );
    expect(warningBannerIdentityIsStable).toBe(true);

    await expectNoUnexpectedClientErrors(sentinel);
    await expectNoUnexpectedWarningsOrErrors(sentinel);
  } finally {
    await page.unroute(eventsSessionUrlPattern);
    await page.unroute(rootEventStreamUrlPattern);
    await page.unroute(notificationsEventsUrlPattern);
  }
});
