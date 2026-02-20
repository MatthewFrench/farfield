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
  await expect(page.getByTestId("debug-trace-panel")).toBeVisible();
  await expect(page.getByTestId("debug-stream-events-panel")).toBeVisible();

  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
