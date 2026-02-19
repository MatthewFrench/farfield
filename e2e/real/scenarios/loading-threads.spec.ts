import {
  openAppHome
} from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled
} from "../helpers/app-assertions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

test("loading threads UX in main pane", async ({ page, sentinel }) => {
  let delayedThreadsRequest = false;
  await page.route("**/api/threads?*", async (route) => {
    if (!delayedThreadsRequest) {
      delayedThreadsRequest = true;
      await page.waitForTimeout(1_500);
    }
    await route.continue();
  });

  await openAppHome(page);

  await expect(page.getByTestId("chat-empty-loading-threads")).toBeVisible();
  await expect(page.getByTestId("chat-empty-no-messages")).toHaveCount(0);

  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  await expect(page.getByTestId("chat-empty-loading-threads")).toHaveCount(0);
  await expect(page.getByTestId("chat-surface")).not.toHaveAttribute("data-state", "loading-threads");

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
