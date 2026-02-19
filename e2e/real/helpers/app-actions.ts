import { expect, type Page } from "@playwright/test";

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
  await page.getByTestId("tab-debug").click();
}

export async function openPreflightTab(page: Page): Promise<void> {
  await page.getByTestId("tab-preflight").click();
}

export async function selectFirstThreadIfAny(
  page: Page
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
    ...(threadId ? { threadId } : {})
  };
}
