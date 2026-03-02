import { expect, type Page, test } from "../fixtures/real-app.fixture";
import { openAppHome, openSidebarIfHidden } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";

const THREAD_IDENTIFIER = "thread-rename-persistence";
const THREAD_ROUTE_PATTERN = /\/api\/threads(?:\/.*)?(?:\?.*)?$/;
const INITIAL_THREAD_LABEL = "Thread rename baseline label";
const PERSISTED_THREAD_LABEL = "Farfield thread label persistence check";
const THREAD_LABEL_SAMPLE_COUNT = 16;
const THREAD_LABEL_SAMPLE_INTERVAL_MILLISECONDS = 35;

function delayMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function buildThreadListResponse(label: string, updatedAt: number) {
  const threadListData = [
    {
      id: THREAD_IDENTIFIER,
      preview: label,
      threadName: label,
      createdAt: 1_736_500_000_000,
      updatedAt,
      cwd: "/workspace/thread-rename-persistence",
      source: "opencode",
      agentId: "codex",
      hasUnreadTurn: false,
    },
  ];

  return {
    ok: true,
    data: threadListData,
    nextCursor: null,
    pages: 1,
    truncated: false,
    orderedThreadIds: [THREAD_IDENTIFIER],
    sync: {
      mode: "full",
      sinceUpdatedAt: null,
      snapshotUpdatedAt: updatedAt,
    },
  } as const;
}

function buildReadThreadResponse(threadId: string) {
  return {
    ok: true,
    agentId: "codex",
    thread: {
      id: threadId,
      turns: [],
      requests: [],
      createdAt: 1_736_500_000_000,
      updatedAt: 1_736_500_000_500,
      hasUnreadTurn: false,
      source: "opencode",
      cwd: `/workspace/${threadId}`,
    },
  } as const;
}

function buildLiveStateResponse(threadId: string) {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    conversationState: null,
    liveStateError: null,
  } as const;
}

function buildStreamEventsResponse(threadId: string) {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    events: [],
    nextSequence: 0,
    firstAvailableSequence: 0,
    resetRequired: false,
  } as const;
}

function buildUnsubscribeThreadResponse(threadId: string) {
  return {
    ok: true,
    threadId,
    status: "notSubscribed",
  } as const;
}

async function readThreadLabel(page: Page, threadId: string): Promise<string> {
  const threadLabel = page
    .locator(`[data-testid="thread-list-item"][data-thread-id="${threadId}"] span`)
    .first();
  await expect(threadLabel).toBeVisible();
  const textContent = await threadLabel.textContent();
  return (textContent ?? "").trim();
}

async function selectThreadByIdentifier(page: Page, threadId: string): Promise<void> {
  const threadRow = page
    .locator(`[data-testid="thread-list-item"][data-thread-id="${threadId}"]`)
    .first();
  await expect(threadRow).toBeVisible();
  await threadRow.click();
}

async function sampleThreadLabelValues(page: Page, threadId: string): Promise<string[]> {
  const labelSamples: string[] = [];
  for (let sampleIndex = 0; sampleIndex < THREAD_LABEL_SAMPLE_COUNT; sampleIndex += 1) {
    labelSamples.push(await readThreadLabel(page, threadId));
    await delayMilliseconds(THREAD_LABEL_SAMPLE_INTERVAL_MILLISECONDS);
  }
  return labelSamples;
}

test("thread rename persists across reload with stable sidebar labeling", async ({
  page,
  sentinel,
}) => {
  let servePersistedThreadLabel = false;

  await page.route(THREAD_ROUTE_PATTERN, async (route) => {
    const requestUrl = new URL(route.request().url());
    const method = route.request().method().toUpperCase();
    const pathSegments = requestUrl.pathname.split("/").filter((segment) => segment.length > 0);

    if (
      method === "GET" &&
      pathSegments.length === 2 &&
      pathSegments[0] === "api" &&
      pathSegments[1] === "threads"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          buildThreadListResponse(
            servePersistedThreadLabel ? PERSISTED_THREAD_LABEL : INITIAL_THREAD_LABEL,
            servePersistedThreadLabel ? 1_736_500_001_200 : 1_736_500_000_500,
          ),
        ),
      });
      return;
    }

    const threadIdentifierSegment = pathSegments[2];
    if (threadIdentifierSegment === undefined) {
      await route.continue();
      return;
    }
    const threadId = decodeURIComponent(threadIdentifierSegment);
    const subresource = pathSegments[3];

    if (method === "GET" && subresource === undefined) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildReadThreadResponse(threadId)),
      });
      return;
    }

    if (method === "GET" && subresource === "live-state") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildLiveStateResponse(threadId)),
      });
      return;
    }

    if (method === "GET" && subresource === "stream-events") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildStreamEventsResponse(threadId)),
      });
      return;
    }

    if (method === "POST" && subresource === "unsubscribe") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildUnsubscribeThreadResponse(threadId)),
      });
      return;
    }

    await route.continue();
  });

  await openAppHome(page);
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await selectThreadByIdentifier(page, THREAD_IDENTIFIER);

  const labelBeforeReload = await readThreadLabel(page, THREAD_IDENTIFIER);
  expect(labelBeforeReload).toBe(INITIAL_THREAD_LABEL);

  servePersistedThreadLabel = true;

  await page.reload({ waitUntil: "domcontentloaded" });
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const labelSamples = await sampleThreadLabelValues(page, THREAD_IDENTIFIER);
  expect(new Set(labelSamples)).toEqual(new Set([PERSISTED_THREAD_LABEL]));
  expect(labelSamples).not.toContain(labelBeforeReload);

  await expectNoErrorBanner(page);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
