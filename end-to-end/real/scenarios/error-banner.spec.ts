import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, triggerHeaderRefresh } from "../helpers/app-actions";
import { expectThreadListSettled } from "../helpers/app-assertions";

const THREAD_ROUTE_PATTERN = "**/api/threads**";

test.use({
  enforceUnexpectedSignals: false,
});

test("error banner persists until manual dismiss", async ({ page, sentinel }) => {
  await openAppHome(page);
  await expectThreadListSettled(page, sentinel);

  let failedThreadListRequestCount = 0;
  await page.route(THREAD_ROUTE_PATTERN, async (route) => {
    const requestUrl = new URL(route.request().url());
    const method = route.request().method().toUpperCase();
    const pathSegments = requestUrl.pathname.split("/").filter((segment) => segment.length > 0);
    const isThreadCollectionReadRequest =
      method === "GET" &&
      pathSegments.length === 2 &&
      pathSegments[0] === "api" &&
      pathSegments[1] === "threads";

    if (isThreadCollectionReadRequest && failedThreadListRequestCount === 0) {
      failedThreadListRequestCount = 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "core.load: forced error banner regression",
        }),
      });
      return;
    }

    await route.continue();
  });

  await triggerHeaderRefresh(page);
  await expect.poll(() => failedThreadListRequestCount).toBe(1);

  const banner = page.getByTestId("error-banner");
  await expect(banner).toBeVisible();
  await expect(page.getByTestId("error-banner-message")).toContainText(
    "forced error banner regression",
  );

  await page.waitForTimeout(1_500);
  await expect(banner).toBeVisible();

  const dismissButton = page.getByTestId("error-banner-dismiss").first();
  await expect(dismissButton).toBeVisible();
  await dismissButton.click({ force: true });
  await expect(banner).toHaveCount(0);

  await page.unroute(THREAD_ROUTE_PATTERN);
});
