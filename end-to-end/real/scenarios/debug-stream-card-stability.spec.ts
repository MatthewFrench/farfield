import { expect, test } from "../fixtures/real-app.fixture";
import {
  openAppHome,
  openDebugTab,
  openSidebarIfHidden,
  selectFirstThreadIfAny,
  triggerHeaderRefresh,
} from "../helpers/app-actions";
import {
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
} from "../helpers/app-assertions";

interface StreamEventsResponse {
  ok: true;
  threadId: string;
  ownerClientId: string;
  events: Array<{
    type: "broadcast";
    method: string;
    params: Record<string, never>;
  }>;
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

const STREAM_EVENTS_ROUTE_PATTERN = "**/api/threads/*/stream-events*";
const THREAD_UNSUBSCRIBE_ROUTE_PATTERN = "**/api/threads/*/unsubscribe";

function buildStreamEvent(method: string): StreamEventsResponse["events"][number] {
  return {
    type: "broadcast",
    method,
    params: {},
  };
}

function buildStreamEventsResponse(input: {
  threadId: string;
  events: StreamEventsResponse["events"];
  nextSequence: number;
  firstAvailableSequence: number;
}): StreamEventsResponse {
  return {
    ok: true,
    threadId: input.threadId,
    ownerClientId: "owner-client",
    events: input.events,
    nextSequence: input.nextSequence,
    firstAvailableSequence: input.firstAvailableSequence,
    resetRequired: false,
  };
}

function readThreadIdFromStreamEventsPath(pathname: string): string | null {
  const match = pathname.match(/\/api\/threads\/([^/]+)\/stream-events/i);
  if (!match || match[1] === undefined || match[1].length === 0) {
    return null;
  }
  return decodeURIComponent(match[1]);
}

function buildUnsubscribeThreadResponse(threadId: string) {
  return {
    ok: true,
    threadId,
    status: "notSubscribed",
  } as const;
}

test("debug stream cards keep retained node identity when retention windows shift", async ({
  page,
  sentinel,
}) => {
  const initialStreamEvents = Array.from({ length: 400 }, (_, index) =>
    buildStreamEvent(`event-${String(index)}`),
  );
  const appendedStreamEvent = buildStreamEvent("event-400");

  await page.route(STREAM_EVENTS_ROUTE_PATTERN, async (route) => {
    const requestUrl = new URL(route.request().url());
    const threadId = readThreadIdFromStreamEventsPath(requestUrl.pathname);
    const sinceSequence = requestUrl.searchParams.get("sinceSequence");

    if (threadId === null) {
      await route.continue();
      return;
    }

    if (sinceSequence === null) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          buildStreamEventsResponse({
            threadId,
            events: initialStreamEvents,
            nextSequence: 400,
            firstAvailableSequence: 0,
          }),
        ),
      });
      return;
    }

    if (sinceSequence === "399") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          buildStreamEventsResponse({
            threadId,
            events: [appendedStreamEvent],
            nextSequence: 401,
            firstAvailableSequence: 1,
          }),
        ),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildStreamEventsResponse({
          threadId,
          events: [],
          nextSequence: 401,
          firstAvailableSequence: 1,
        }),
      ),
    });
  });
  await page.route(THREAD_UNSUBSCRIBE_ROUTE_PATTERN, async (route) => {
    const pathSegments = new URL(route.request().url()).pathname
      .split("/")
      .filter((segment) => segment.length > 0);
    const threadIdSegment = pathSegments[2];
    if (threadIdSegment === undefined) {
      await route.continue();
      return;
    }
    const threadId = decodeURIComponent(threadIdSegment);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildUnsubscribeThreadResponse(threadId)),
    });
  });

  try {
    await openAppHome(page);
    await openSidebarIfHidden(page);
    const selection = await selectFirstThreadIfAny(page);
    if (!selection.selected) {
      return;
    }

    await openDebugTab(page);
    await page.getByRole("tab", { name: "Stream" }).click();
    await expect(page.getByTestId("debug-stream-events-panel")).toBeVisible();
    await expect(page.getByText("event-1").first()).toBeVisible();

    const retainedCardBefore = await page
      .getByText("event-1")
      .first()
      .evaluateHandle((node) => node.closest('[data-testid="stream-event-card"]'));

    await triggerHeaderRefresh(page);
    await expect(page.getByText("event-400").first()).toBeVisible();
    await expect(page.getByText("event-0")).toHaveCount(0);

    const retainedCardAfter = await page
      .getByText("event-1")
      .first()
      .evaluateHandle((node) => node.closest('[data-testid="stream-event-card"]'));

    const retainedCardIdentityIsStable = await retainedCardBefore.evaluate(
      (previousNode, nextNode) => previousNode === nextNode,
      retainedCardAfter,
    );
    expect(retainedCardIdentityIsStable).toBe(true);

    await expectNoUnexpectedClientErrors(sentinel);
    await expectNoUnexpectedWarningsOrErrors(sentinel);
  } finally {
    await page.unroute(STREAM_EVENTS_ROUTE_PATTERN);
    await page.unroute(THREAD_UNSUBSCRIBE_ROUTE_PATTERN);
  }
});
