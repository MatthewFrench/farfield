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
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    let delayedThreadsRequest = false;
    window.fetch = async (...args) => {
      const [resource] = args;
      const url = typeof resource === "string"
        ? resource
        : resource instanceof Request
          ? resource.url
          : String(resource);

      if (!delayedThreadsRequest && /\/api\/threads(?:\?|$)/.test(url)) {
        delayedThreadsRequest = true;
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 4_000);
        });
      }

      return originalFetch(...args);
    };
  });

  await openAppHome(page);

  await expect
    .poll(async () => {
      const state = await page.getByTestId("chat-surface").getAttribute("data-state");
      return state;
    }, { timeout: 15_000 })
    .toBe("loading-threads");
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
