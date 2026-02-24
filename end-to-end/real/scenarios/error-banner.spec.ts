import {
  openAppHome
} from "../helpers/app-actions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

test("error banner persists until manual dismiss", async ({ page }) => {
  await openAppHome(page);

  let failedThreadListRequest = false;
  await page.route("**/api/threads*", async (route) => {
    if (!failedThreadListRequest) {
      failedThreadListRequest = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "core.load: forced error banner regression"
        })
      });
      return;
    }
    await route.continue();
  });
  await page.getByTestId("refresh-button").click();

  const banner = page.getByTestId("error-banner");
  await expect(banner).toBeVisible();
  await expect(page.getByTestId("error-banner-operation")).toHaveText("core.load:");
  await expect(page.getByTestId("error-banner-message")).toContainText("forced error banner regression");

  await page.waitForTimeout(1_500);
  await expect(banner).toBeVisible();

  await page.getByTestId("error-banner-open-debug").click();
  await expect(page.getByTestId("debug-issues-panel")).toBeVisible();
  await expect(banner).toBeVisible();

  await page.getByTestId("error-banner-dismiss").click();
  await expect(banner).toHaveCount(0);

  await page.unroute("**/api/threads*");
});
