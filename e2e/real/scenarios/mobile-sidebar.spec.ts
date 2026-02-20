import {
  openAppHome
} from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled
} from "../helpers/app-assertions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

test("mobile sidebar open and close behavior", async ({ page, sentinel }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await openAppHome(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const openButton = page.getByTestId("sidebar-toggle-open").first();
  await expect(openButton).toBeVisible();

  await openButton.click();
  await expect(page.getByTestId("sidebar-mobile")).toBeVisible();
  await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();

  await page.getByTestId("sidebar-toggle-close").first().click();
  await expect(page.getByTestId("sidebar-mobile")).toHaveCount(0);

  await openButton.click();
  await expect(page.getByTestId("sidebar-mobile")).toBeVisible();
  await page.getByTestId("sidebar-backdrop").click();
  await expect(page.getByTestId("sidebar-mobile")).toHaveCount(0);

  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
