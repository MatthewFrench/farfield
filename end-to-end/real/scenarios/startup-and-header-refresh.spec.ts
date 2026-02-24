import {
  openAppHome,
  triggerHeaderRefresh
} from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoLoadFailedText,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled
} from "../helpers/app-assertions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

test("startup and header refresh behavior", async ({ page, sentinel }) => {
  await openAppHome(page);

  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expect(page.getByTestId("selected-thread-label")).toBeVisible();
  await expectNoErrorBanner(page);
  await expectNoLoadFailedText(page);

  await triggerHeaderRefresh(page);

  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expect(page.getByTestId("selected-thread-label")).toBeVisible();

  await expectNoErrorBanner(page);
  await expectNoLoadFailedText(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
