import {
  openAppHome
} from "../helpers/app-actions";
import { expectThreadListSettled } from "../helpers/app-assertions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

test("error banner persists until manual dismiss", async ({ page, sentinel }) => {
  await openAppHome(page);
  await expectThreadListSettled(page, sentinel);

  let failedRequestCount = 0;
  await page.route("**/api/**", async (route) => {
    if (failedRequestCount === 0 && route.request().method() === "GET") {
      failedRequestCount = 1;
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
  await expect.poll(() => failedRequestCount).toBe(1);

  const banner = page.getByTestId("error-banner");
  await expect(banner).toBeVisible();
  await expect(page.getByTestId("error-banner-message")).toContainText("forced error banner regression");

  await page.waitForTimeout(1_500);
  await expect(banner).toBeVisible();

  const dismissButton = page.getByTestId("error-banner-dismiss").first();
  await expect(dismissButton).toBeVisible();
  await dismissButton.click({ force: true });
  await expect(banner).toHaveCount(0);

  await page.unroute("**/api/**");
});
