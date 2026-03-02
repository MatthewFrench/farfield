import { expect, test } from "../fixtures/real-app.fixture";
import { openSidebarIfHidden } from "../helpers/app-actions";
import {
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";
import {
  assertReadinessBudget,
  assertRenderPerformanceBudget,
  installPerformanceProbe,
  logPerformanceProbeSnapshot,
  measureElapsedMilliseconds,
  readPerformanceProbeSnapshot,
} from "../helpers/performance-probe";

const STARTUP_UNDER_LOAD_READY_BUDGET_MILLISECONDS = 10_000;
const STARTUP_UNDER_LOAD_MAX_CUMULATIVE_LAYOUT_SHIFT = 0.25;
const STARTUP_UNDER_LOAD_MAX_LONG_TASK_COUNT = 32;
const STARTUP_UNDER_LOAD_MAX_LONG_TASK_DURATION_MILLISECONDS = 2_000;
const STARTUP_UNDER_LOAD_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS = 7_000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

test("startup remains interactive when deferred startup requests are slow", async ({
  page,
  sentinel,
}) => {
  await installPerformanceProbe(page);

  const deferredDelayMs = 6_000;

  await page.route("**/api/events/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        authRequired: false,
        bootstrapped: true,
        expiresAt: null,
      }),
    });
  });

  await page.route("**/api/health", async (route) => {
    await delay(deferredDelayMs);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        state: {
          appReady: true,
          ipcConnected: true,
          ipcInitialized: true,
          workspaceDir: "/tmp",
          gitCommit: "test",
          lastError: null,
          historyCount: 0,
          threadOwnerCount: 0,
          pushSubscriptionCount: 0,
        },
      }),
    });
  });

  await page.route("**/api/agents", async (route) => {
    await delay(deferredDelayMs);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        agents: [
          {
            id: "codex",
            label: "Codex",
            enabled: true,
            connected: true,
            capabilities: {
              canListModels: true,
              canListCollaborationModes: true,
              canSetCollaborationMode: true,
              canSubmitUserInput: true,
              canReadLiveState: true,
              canReadStreamEvents: true,
            },
            projectDirectories: [],
          },
        ],
        defaultAgentId: "codex",
      }),
    });
  });

  await page.route("**/api/collaboration-modes", async (route) => {
    await delay(deferredDelayMs);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            name: "Default",
            mode: "default",
            model: null,
            reasoning_effort: "medium",
            developer_instructions: null,
          },
        ],
        nextCursor: null,
      }),
    });
  });

  await page.route("**/api/models?*", async (route) => {
    await delay(deferredDelayMs);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: "gpt-5.3-codex",
            model: "gpt-5.3-codex",
            upgrade: null,
            displayName: "gpt-5.3-codex",
            description: "Test model",
            defaultReasoningEffort: "medium",
            supportedReasoningEfforts: [
              {
                reasoningEffort: "medium",
                description: "Balanced",
              },
            ],
            inputModalities: ["text"],
            supportsPersonality: true,
            isDefault: true,
            hidden: false,
          },
        ],
        nextCursor: null,
      }),
    });
  });

  await page.route("**/api/config/defaults?*", async (route) => {
    await delay(deferredDelayMs);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        agentId: "codex",
        model: "gpt-5.3-codex",
        reasoningEffort: "medium",
      }),
    });
  });

  const startupReadinessElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("app-shell")).toBeVisible();
    await openSidebarIfHidden(page);
    await expectThreadListSettled(page, sentinel);
  });
  assertReadinessBudget({
    label: "startup-under-load",
    elapsedMilliseconds: startupReadinessElapsedMilliseconds,
    maximumMilliseconds: STARTUP_UNDER_LOAD_READY_BUDGET_MILLISECONDS,
  });

  const performanceSnapshot = await readPerformanceProbeSnapshot(page);
  logPerformanceProbeSnapshot("startup-under-load", performanceSnapshot);
  assertRenderPerformanceBudget({
    label: "startup-under-load",
    snapshot: performanceSnapshot,
    maximumCumulativeLayoutShift: STARTUP_UNDER_LOAD_MAX_CUMULATIVE_LAYOUT_SHIFT,
    maximumLongTaskCount: STARTUP_UNDER_LOAD_MAX_LONG_TASK_COUNT,
    maximumLongTaskTotalDurationMilliseconds:
      STARTUP_UNDER_LOAD_MAX_LONG_TASK_DURATION_MILLISECONDS,
    maximumFirstContentfulPaintMilliseconds:
      STARTUP_UNDER_LOAD_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS,
  });

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);

  await page.unroute("**/api/events/session");
  await page.unroute("**/api/health");
  await page.unroute("**/api/agents");
  await page.unroute("**/api/collaboration-modes");
  await page.unroute("**/api/models?*");
  await page.unroute("**/api/config/defaults?*");
});
