import { expect, test, type Page } from "../fixtures/real-app.fixture";
import {
  clickThreadRowMenuAction,
  openAppHome,
  openSidebarIfHidden,
} from "../helpers/app-actions";
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

async function mockThreadMaintenanceRoutes(page: Page): Promise<void> {
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

    if (
      pathSegments.length < 3 ||
      pathSegments[0] !== "api" ||
      pathSegments[1] !== "threads"
    ) {
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
}

test("row-menu compact and clean actions keep row identity stable and show success feedback", async ({
  page,
  sentinel,
}) => {
  await mockThreadMaintenanceRoutes(page);

  await openAppHome(page);
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const threadRow = page.locator(
    `[data-testid="thread-list-item"][data-thread-id="${ThreadIdentifier}"]`,
  );
  await expect(threadRow).toBeVisible();
  await threadRow.click();

  await threadRow.evaluate((element) => {
    const threadRowElement = element as ThreadRowIdentityProbeElement;
    threadRowElement.__threadRowIdentityProbe__ = ThreadRowIdentityProbeValue;
  });

  await clickThreadRowMenuAction(page, ThreadIdentifier, "Compact context");
  await expect(page.getByTestId("success-banner-message")).toContainText("Compaction started.");

  const compactIdentityIsStable = await page.evaluate(
    ({
      threadId,
      identityProbeValue,
    }: {
      threadId: string;
      identityProbeValue: string;
    }) => {
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
  await expect(page.getByTestId("success-banner-message")).toContainText(
    "Background terminals cleaned.",
  );

  const cleanIdentityIsStable = await page.evaluate(
    ({
      threadId,
      identityProbeValue,
    }: {
      threadId: string;
      identityProbeValue: string;
    }) => {
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

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
