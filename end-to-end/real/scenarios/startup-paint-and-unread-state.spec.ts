import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, triggerHeaderRefresh } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";

const THREAD_ALPHA_IDENTIFIER = "thread-alpha";
const THREAD_BETA_IDENTIFIER = "thread-beta";

function buildThreadListData(betaUpdatedAt: number) {
  return [
    {
      id: THREAD_ALPHA_IDENTIFIER,
      preview: "Alpha thread",
      createdAt: 1_736_500_000_000,
      updatedAt: 1_736_500_000_500,
      cwd: "/workspace/alpha",
      source: "opencode",
      agentId: "codex",
      hasUnreadTurn: false,
    },
    {
      id: THREAD_BETA_IDENTIFIER,
      preview: "Beta thread",
      createdAt: 1_736_500_000_100,
      updatedAt: betaUpdatedAt,
      cwd: "/workspace/beta",
      source: "opencode",
      agentId: "codex",
      hasUnreadTurn: false,
    },
  ];
}

function buildThreadListResponse(betaUpdatedAt: number) {
  const threadListData = buildThreadListData(betaUpdatedAt);
  return {
    ok: true,
    data: threadListData,
    nextCursor: null,
    pages: 1,
    truncated: false,
    orderedThreadIds: threadListData.map((thread) => thread.id),
    sync: {
      mode: "full",
      sinceUpdatedAt: null,
      snapshotUpdatedAt: Math.max(...threadListData.map((thread) => thread.updatedAt)),
    },
  };
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
  };
}

function buildLiveStateResponse(threadId: string) {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    conversationState: null,
    liveStateError: null,
  };
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
  };
}

test("startup keeps dark paint and loading state is not replaced with empty messaging", async ({
  page,
  sentinel,
}) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    let delayedThreadsRequest = false;
    window.fetch = async (...args) => {
      const [resource] = args;
      const url =
        typeof resource === "string"
          ? resource
          : resource instanceof Request
            ? resource.url
            : String(resource);

      if (!delayedThreadsRequest && /\/api\/threads(?:\?|$)/.test(url)) {
        delayedThreadsRequest = true;
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 2_000);
        });
      }

      return originalFetch(...args);
    };
  });

  await openAppHome(page);

  const themeColor = await page.locator('meta[name="theme-color"]').getAttribute("content");
  expect(themeColor).toBe("#000000");
  const rootBackgroundColor = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).backgroundColor;
  });
  expect(rootBackgroundColor).toBe("rgb(0, 0, 0)");

  await expect
    .poll(async () => {
      return await page.getByTestId("chat-surface").getAttribute("data-state");
    })
    .toBe("loading-threads");
  await expect(page.getByTestId("chat-empty-loading-threads")).toBeVisible();
  await expect(page.getByTestId("chat-empty-no-messages")).toHaveCount(0);

  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});

test("non-focused thread updates with explicit read signals stay read", async ({ page, sentinel }) => {
  let promoteBetaThreadUpdate = false;

  await page.route("**/api/threads**", async (route) => {
    const url = new URL(route.request().url());
    const pathSegments = url.pathname.split("/").filter((segment) => segment.length > 0);

    if (pathSegments.length === 2 && pathSegments[0] === "api" && pathSegments[1] === "threads") {
      const isArchivedListRequest = url.searchParams.get("archived") === "true";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isArchivedListRequest
            ? {
                ok: true,
                data: [],
                nextCursor: null,
                pages: 0,
                truncated: false,
                orderedThreadIds: [],
                sync: {
                  mode: "full",
                  sinceUpdatedAt: null,
                  snapshotUpdatedAt: 0,
                },
              }
            : buildThreadListResponse(promoteBetaThreadUpdate ? 1_736_500_001_000 : 1_736_500_000_200),
        ),
      });
      return;
    }

    const threadIdentifier = pathSegments[2];
    if (threadIdentifier === undefined) {
      await route.continue();
      return;
    }
    const threadId = decodeURIComponent(threadIdentifier);
    const subresource = pathSegments[3];

    if (subresource === undefined) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildReadThreadResponse(threadId)),
      });
      return;
    }
    if (subresource === "live-state") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildLiveStateResponse(threadId)),
      });
      return;
    }
    if (subresource === "stream-events") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildStreamEventsResponse(threadId)),
      });
      return;
    }

    await route.continue();
  });

  await openAppHome(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  await page
    .locator(`[data-testid="thread-list-item"][data-thread-id="${THREAD_ALPHA_IDENTIFIER}"]`)
    .click();
  await expect(page.getByTestId(`thread-unread-indicator-${THREAD_BETA_IDENTIFIER}`)).toHaveCount(0);

  promoteBetaThreadUpdate = true;
  await triggerHeaderRefresh(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  await expect(page.getByTestId(`thread-unread-indicator-${THREAD_BETA_IDENTIFIER}`)).toHaveCount(0);
  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
