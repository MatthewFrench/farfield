import {
  openAppHome,
  openSidebarIfHidden,
  selectFirstThreadIfAny
} from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled
} from "../helpers/app-assertions";
import {
  expect,
  test
} from "../fixtures/real-app.fixture";

test("thread list and open behavior", async ({ page, sentinel }) => {
  await openAppHome(page);
  await openSidebarIfHidden(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const selection = await selectFirstThreadIfAny(page);

  if (selection.selected) {
    await expect(page.getByTestId("selected-thread-label")).not.toHaveText("No thread selected");
  } else {
    await expect(page.getByTestId("thread-list-empty")).toBeVisible();
    await expect(
      page.getByTestId("chat-empty-no-thread").or(page.getByTestId("chat-empty-loading"))
    ).toBeVisible();
  }

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
