import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, triggerHeaderRefresh } from "../helpers/app-actions";
import {
  captureRuntimeRequestErrorOperationCounts,
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoLoadFailedText,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectRuntimeRequestErrorOperationSpikeBudget,
  expectThreadListSettled,
} from "../helpers/app-assertions";

test("startup and header refresh behavior", async ({ page, sentinel }) => {
  const baselineRuntimeRequestErrorOperationCounts =
    await captureRuntimeRequestErrorOperationCounts(page);

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

  const currentRuntimeRequestErrorOperationCounts =
    await captureRuntimeRequestErrorOperationCounts(page);
  expectRuntimeRequestErrorOperationSpikeBudget({
    baselineOperationCounts: baselineRuntimeRequestErrorOperationCounts,
    currentOperationCounts: currentRuntimeRequestErrorOperationCounts,
    maximumIncreasePerOperation: 0,
  });
});
