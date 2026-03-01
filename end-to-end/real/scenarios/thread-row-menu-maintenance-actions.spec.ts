import { expect, type Page, test } from "../fixtures/real-app.fixture";
import { clickThreadRowMenuAction, openAppHome, openSidebarIfHidden } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";

const ThreadIdentifier = "thread-maintenance";
const ThreadPreview = "Thread maintenance";
const ThreadProjectPath = "/workspace/maintenance";
const ThreadRowIdentityProbeValue = "stable-row-identity";

interface ThreadRowIdentityProbeElement extends HTMLButtonElement {
  __threadRowIdentityProbe__?: string;
}

test.use({
  enforceStateIsolation: false,
  enforceRuntimeAvailabilityCheck: false,
  enforceDebugErrorEndpointReads: false,
});

function buildThreadListResponse() {
  return {
    ok: true,
    data: [
      {
        id: ThreadIdentifier,
        preview: ThreadPreview,
        createdAt: 1_736_500_000_000,
        updatedAt: 1_736_500_000_500,
        cwd: ThreadProjectPath,
        source: "opencode",
        agentId: "codex",
        hasUnreadTurn: false,
        isLoadedInMemory: true,
      },
    ],
    nextCursor: null,
    pages: 1,
    truncated: false,
    orderedThreadIds: [ThreadIdentifier],
    sync: {
      mode: "full",
      sinceUpdatedAt: null,
      snapshotUpdatedAt: 1_736_500_000_500,
    },
  };
}

function buildArchivedThreadListResponse() {
  return {
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
  };
}

function buildReadThreadResponse() {
  return {
    ok: true,
    agentId: "codex",
    thread: {
      id: ThreadIdentifier,
      turns: [],
      requests: [],
      createdAt: 1_736_500_000_000,
      updatedAt: 1_736_500_000_500,
      source: "opencode",
      cwd: ThreadProjectPath,
      hasUnreadTurn: false,
    },
  };
}

function buildLiveStateResponse() {
  return {
    ok: true,
    threadId: ThreadIdentifier,
    ownerClientId: null,
    conversationState: null,
    liveStateError: null,
  };
}

function buildStreamEventsResponse() {
  return {
    ok: true,
    threadId: ThreadIdentifier,
    ownerClientId: null,
    events: [],
    nextSequence: 0,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
}

interface ThreadMaintenanceRouteInvocationCounts {
  compactMutations: number;
  cleanBackgroundTerminalMutations: number;
}

async function mockThreadMaintenanceRoutes(
  page: Page,
): Promise<ThreadMaintenanceRouteInvocationCounts> {
  const invocationCounts: ThreadMaintenanceRouteInvocationCounts = {
    compactMutations: 0,
    cleanBackgroundTerminalMutations: 0,
  };

  await page.route("**/api/account*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/account" || route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        account: {
          type: "chatgpt",
          email: "dev@example.com",
          planType: "pro",
        },
        requiresOpenaiAuth: false,
      }),
    });
  });

  await page.route("**/api/account/rate-limits*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/account/rate-limits" || route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        rateLimits: {
          credits: null,
          limitId: "codex",
          limitName: "Codex",
          planType: "pro",
          primary: {
            resetsAt: 1_736_500_100_000,
            usedPercent: 42,
            windowDurationMins: 60,
          },
          secondary: null,
        },
        rateLimitsByLimitId: null,
      }),
    });
  });

  await page.route("**/api/apps*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/apps" || route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: "app-1",
            name: "GitHub",
            description: null,
            logoUrl: null,
            logoUrlDark: null,
            installUrl: null,
            isAccessible: true,
            isEnabled: true,
          },
        ],
        nextCursor: null,
      }),
    });
  });

  await page.route("**/api/notifications/events*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/notifications/events" || route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        events: [],
        nextSequence: 0,
        firstAvailableSequence: 0,
        resetRequired: false,
      }),
    });
  });

  await page.route("**/api/threads**", async (route) => {
    const url = new URL(route.request().url());
    const pathSegments = url.pathname.split("/").filter((segment) => segment.length > 0);
    const method = route.request().method();

    if (pathSegments.length === 2 && pathSegments[0] === "api" && pathSegments[1] === "threads") {
      if (method !== "GET") {
        await route.continue();
        return;
      }
      const isArchivedRequest = url.searchParams.get("archived") === "true";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isArchivedRequest ? buildArchivedThreadListResponse() : buildThreadListResponse(),
        ),
      });
      return;
    }

    if (pathSegments.length < 3 || pathSegments[0] !== "api" || pathSegments[1] !== "threads") {
      await route.continue();
      return;
    }

    const threadId = decodeURIComponent(pathSegments[2] ?? "");
    if (threadId !== ThreadIdentifier) {
      await route.continue();
      return;
    }
    const subresource = pathSegments[3];

    if (subresource === undefined && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildReadThreadResponse()),
      });
      return;
    }

    if (subresource === "live-state" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildLiveStateResponse()),
      });
      return;
    }

    if (subresource === "stream-events" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildStreamEventsResponse()),
      });
      return;
    }

    if (subresource === "compact" && method === "POST") {
      invocationCounts.compactMutations += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          threadId: ThreadIdentifier,
        }),
      });
      return;
    }

    if (subresource === "background-terminals-clean" && method === "POST") {
      invocationCounts.cleanBackgroundTerminalMutations += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          threadId: ThreadIdentifier,
        }),
      });
      return;
    }

    if (subresource === "unsubscribe" && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          threadId: ThreadIdentifier,
          status: "notSubscribed",
        }),
      });
      return;
    }

    await route.continue();
  });

  return invocationCounts;
}

test("row-menu compact and clean actions keep row and runtime-summary identity stable", async ({
  page,
  sentinel,
}) => {
  const routeInvocationCounts = await mockThreadMaintenanceRoutes(page);

  await openAppHome(page);
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const threadRow = page.locator(
    `[data-testid="thread-list-item"][data-thread-id="${ThreadIdentifier}"]`,
  );
  const threadRuntimeStatusBadge = page.getByTestId(
    `thread-runtime-status-badge-${ThreadIdentifier}`,
  );
  const sidebarRuntimeAccountSummary = page.getByTestId("sidebar-runtime-account-summary");
  const sidebarRuntimeProgressSummary = page.getByTestId("sidebar-runtime-progress-summary");
  const sidebarRuntimeTokenUsageSummary = page.getByTestId("sidebar-runtime-token-usage-summary");
  await expect(threadRow).toBeVisible();
  await expect(threadRuntimeStatusBadge).toHaveText("Not loaded");
  await expect(sidebarRuntimeAccountSummary).toHaveText("Account pro");
  await expect(sidebarRuntimeProgressSummary).toHaveText("Progress n/a");
  await expect(sidebarRuntimeTokenUsageSummary).toHaveText("Tokens n/a");
  await threadRow.click();

  await threadRow.evaluate((element, identityProbeValue) => {
    const threadRowElement = element as ThreadRowIdentityProbeElement;
    threadRowElement.__threadRowIdentityProbe__ = identityProbeValue;
  }, ThreadRowIdentityProbeValue);
  const runtimeStatusBadgeBefore = await threadRuntimeStatusBadge.evaluateHandle((node) => node);
  const sidebarRuntimeAccountSummaryBefore = await sidebarRuntimeAccountSummary.evaluateHandle(
    (node) => node,
  );
  const sidebarRuntimeProgressSummaryBefore = await sidebarRuntimeProgressSummary.evaluateHandle(
    (node) => node,
  );
  const sidebarRuntimeTokenUsageSummaryBefore =
    await sidebarRuntimeTokenUsageSummary.evaluateHandle((node) => node);

  await clickThreadRowMenuAction(page, ThreadIdentifier, "Compact context");
  await expect
    .poll(() => routeInvocationCounts.compactMutations, {
      message: "Expected compact route to be invoked",
    })
    .toBe(1);

  const compactIdentityIsStable = await page.evaluate(
    ({ threadId, identityProbeValue }: { threadId: string; identityProbeValue: string }) => {
      const threadRowElement = document.querySelector(
        `[data-testid="thread-list-item"][data-thread-id="${threadId}"]`,
      ) as ThreadRowIdentityProbeElement | null;
      if (threadRowElement === null) {
        return false;
      }
      return threadRowElement.__threadRowIdentityProbe__ === identityProbeValue;
    },
    {
      threadId: ThreadIdentifier,
      identityProbeValue: ThreadRowIdentityProbeValue,
    },
  );
  expect(compactIdentityIsStable).toBe(true);

  await clickThreadRowMenuAction(page, ThreadIdentifier, "Clean background terminals");
  await expect
    .poll(() => routeInvocationCounts.cleanBackgroundTerminalMutations, {
      message: "Expected clean background terminals route to be invoked",
    })
    .toBe(1);

  const cleanIdentityIsStable = await page.evaluate(
    ({ threadId, identityProbeValue }: { threadId: string; identityProbeValue: string }) => {
      const threadRowElement = document.querySelector(
        `[data-testid="thread-list-item"][data-thread-id="${threadId}"]`,
      ) as ThreadRowIdentityProbeElement | null;
      if (threadRowElement === null) {
        return false;
      }
      return threadRowElement.__threadRowIdentityProbe__ === identityProbeValue;
    },
    {
      threadId: ThreadIdentifier,
      identityProbeValue: ThreadRowIdentityProbeValue,
    },
  );
  expect(cleanIdentityIsStable).toBe(true);

  const runtimeStatusBadgeAfter = await threadRuntimeStatusBadge.evaluateHandle((node) => node);
  const runtimeStatusBadgeIdentityIsStable = await runtimeStatusBadgeBefore.evaluate(
    (previousNode, nextNode) => previousNode === nextNode,
    runtimeStatusBadgeAfter,
  );
  expect(runtimeStatusBadgeIdentityIsStable).toBe(true);
  const sidebarRuntimeAccountSummaryAfter = await sidebarRuntimeAccountSummary.evaluateHandle(
    (node) => node,
  );
  const sidebarRuntimeProgressSummaryAfter = await sidebarRuntimeProgressSummary.evaluateHandle(
    (node) => node,
  );
  const sidebarRuntimeTokenUsageSummaryAfter = await sidebarRuntimeTokenUsageSummary.evaluateHandle(
    (node) => node,
  );
  const sidebarRuntimeAccountSummaryIdentityIsStable =
    await sidebarRuntimeAccountSummaryBefore.evaluate(
      (previousNode, nextNode) => previousNode === nextNode,
      sidebarRuntimeAccountSummaryAfter,
    );
  const sidebarRuntimeTokenUsageSummaryIdentityIsStable =
    await sidebarRuntimeTokenUsageSummaryBefore.evaluate(
      (previousNode, nextNode) => previousNode === nextNode,
      sidebarRuntimeTokenUsageSummaryAfter,
    );
  const sidebarRuntimeProgressSummaryIdentityIsStable =
    await sidebarRuntimeProgressSummaryBefore.evaluate(
      (previousNode, nextNode) => previousNode === nextNode,
      sidebarRuntimeProgressSummaryAfter,
    );
  expect(sidebarRuntimeAccountSummaryIdentityIsStable).toBe(true);
  expect(sidebarRuntimeTokenUsageSummaryIdentityIsStable).toBe(true);
  expect(sidebarRuntimeProgressSummaryIdentityIsStable).toBe(true);

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
