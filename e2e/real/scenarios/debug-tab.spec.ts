import {
  openAppHome,
  openDebugTab
} from "../helpers/app-actions";
import {
  expectNoUnexpectedClientErrors,
  expectNoFailedApiResponses,
  expectNoUnexpectedWarningsOrErrors
} from "../helpers/app-assertions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

test("debug tab accessibility", async ({ page, sentinel }) => {
  await openAppHome(page);

  await openDebugTab(page);

  await expect(page.getByTestId("debug-history-panel")).toBeVisible();
  await expect(page.getByTestId("debug-errors-panel")).toBeVisible();

  await page.getByTestId("debug-errors-refresh").click();

  const errorRows = page.getByTestId("debug-error-row");
  if ((await errorRows.count()) > 0) {
    await errorRows.first().click();
    await expect(page.getByTestId("debug-error-detail")).toBeVisible();
  } else {
    await expect(page.getByTestId("debug-errors-empty")).toBeVisible();
  }

  await expect(page.getByTestId("debug-errors-session-log-link")).toBeVisible();

  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
