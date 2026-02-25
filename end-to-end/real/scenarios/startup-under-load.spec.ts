import {
  openSidebarIfHidden,
} from "../helpers/app-actions";
import {
  expectNoErrorBanner,
  expectThreadListSettled
} from "../helpers/app-assertions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

test("startup remains interactive when deferred startup requests are slow", async ({ page, sentinel }) => {
  const deferredDelayMs = 6_000;

  await page.route("**/api/events/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        authRequired: false,
        bootstrapped: true,
        expiresAt: null
      })
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
          pushSubscriptionCount: 0
        }
      })
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
              canReadStreamEvents: true
            },
            projectDirectories: []
          }
        ],
        defaultAgentId: "codex"
      })
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
            developer_instructions: null
          }
        ],
        nextCursor: null
      })
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
                description: "Balanced"
              }
            ],
            inputModalities: ["text"],
            supportsPersonality: true,
            isDefault: true,
            hidden: false
          }
        ],
        nextCursor: null
      })
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
        reasoningEffort: "medium"
      })
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectNoErrorBanner(page);

  await page.unroute("**/api/events/session");
  await page.unroute("**/api/health");
  await page.unroute("**/api/agents");
  await page.unroute("**/api/collaboration-modes");
  await page.unroute("**/api/models?*");
  await page.unroute("**/api/config/defaults?*");
});
