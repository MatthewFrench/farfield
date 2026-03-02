import { expect, type Locator, type Page } from "@playwright/test";

const ThreadRowMenuActionAttemptLimit = 4;
const ThreadRowMenuActionVisibilityTimeoutMilliseconds = 5_000;
const ThreadRowMenuActionRetryDelayMilliseconds = 80;

export async function openAppHome(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function openSidebarIfHidden(page: Page): Promise<void> {
  const openButtons = page.getByTestId("sidebar-toggle-open");
  const count = await openButtons.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = openButtons.nth(index);
    if (await candidate.isVisible()) {
      await candidate.click();
      return;
    }
  }
}

export async function openDebugTab(page: Page): Promise<void> {
  const debugIssuesPanel = page.getByTestId("debug-issues-panel");
  if (await hasVisibleLocator(debugIssuesPanel)) {
    return;
  }

  const debugSettingsTab = page.getByTestId("settings-tab-debug");
  if (!(await hasVisibleLocator(debugSettingsTab))) {
    await page.getByTestId("tab-settings").click();
  }

  await page.getByTestId("settings-tab-debug").click();
}

export async function triggerHeaderRefresh(page: Page): Promise<void> {
  const settingsPaneDebugTab = page.getByTestId("settings-tab-debug");
  const settingsPaneWasOpen = await hasVisibleLocator(settingsPaneDebugTab);
  if (!settingsPaneWasOpen) {
    await page.getByTestId("tab-settings").click();
    await expect(settingsPaneDebugTab).toBeVisible();
  }

  await page.getByTestId("refresh-button").click();

  if (!settingsPaneWasOpen) {
    await page.getByTestId("tab-settings").click();
  }
}

export async function openPreflightTab(page: Page): Promise<void> {
  await page.getByTestId("tab-preflight").click();
}

export async function selectFirstThreadIfAny(
  page: Page,
): Promise<{ selected: boolean; threadId?: string }> {
  const threadRows = page.getByTestId("thread-list-item");
  const count = await threadRows.count();

  if (count === 0) {
    return { selected: false };
  }

  const first = threadRows.first();
  const threadId = await first.getAttribute("data-thread-id");
  await first.click();

  return {
    selected: true,
    ...(threadId ? { threadId } : {}),
  };
}

export async function openThreadRowMenu(page: Page, threadId: string): Promise<void> {
  await page
    .locator(`[data-testid="thread-row-menu-trigger"][data-thread-id="${threadId}"]`)
    .click();
}

export async function clickThreadRowMenuAction(
  page: Page,
  threadId: string,
  actionLabel: string,
): Promise<void> {
  for (let attemptIndex = 0; attemptIndex < ThreadRowMenuActionAttemptLimit; attemptIndex += 1) {
    await openThreadRowMenu(page, threadId);
    const actionMenuItem = page.getByRole("menuitem", { name: actionLabel }).first();
    try {
      await expect(actionMenuItem).toBeVisible({
        timeout: ThreadRowMenuActionVisibilityTimeoutMilliseconds,
      });
      await actionMenuItem.click({
        timeout: ThreadRowMenuActionVisibilityTimeoutMilliseconds,
      });
      return;
    } catch {
      if (attemptIndex + 1 >= ThreadRowMenuActionAttemptLimit) {
        throw new Error(
          `Unable to click thread-row menu action "${actionLabel}" for thread "${threadId}" after ${String(ThreadRowMenuActionAttemptLimit)} attempts.`,
        );
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(ThreadRowMenuActionRetryDelayMilliseconds);
    }
  }
}

async function hasVisibleLocator(locator: Locator): Promise<boolean> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible()) {
      return true;
    }
  }
  return false;
}
