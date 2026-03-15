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
import {
  assertReadinessBudget,
  assertRenderPerformanceBudget,
  installPerformanceProbe,
  logPerformanceProbeSnapshot,
  measureElapsedMilliseconds,
  readPerformanceProbeSnapshot,
} from "../helpers/performance-probe";

const STARTUP_HEADER_READY_BUDGET_MILLISECONDS = 15_000;
const HEADER_REFRESH_READY_BUDGET_MILLISECONDS = 8_000;
const STARTUP_HEADER_MAX_CUMULATIVE_LAYOUT_SHIFT = 0.2;
const STARTUP_HEADER_MAX_LONG_TASK_COUNT = 24;
const STARTUP_HEADER_MAX_LONG_TASK_DURATION_MILLISECONDS = 1_600;
const STARTUP_HEADER_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS = 6_000;

test("startup and header refresh behavior", async ({ page, sentinel }) => {
  await installPerformanceProbe(page);

  const baselineRuntimeRequestErrorOperationCounts =
    await captureRuntimeRequestErrorOperationCounts(page);

  const startupReadinessElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await openAppHome(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
    await expect(page.getByTestId("selected-thread-label")).toBeVisible();
  });
  assertReadinessBudget({
    label: "startup-header-startup",
    elapsedMilliseconds: startupReadinessElapsedMilliseconds,
    maximumMilliseconds: STARTUP_HEADER_READY_BUDGET_MILLISECONDS,
  });
  await expectNoErrorBanner(page);
  await expectNoLoadFailedText(page);

  const headerRefreshElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await triggerHeaderRefresh(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
    await expect(page.getByTestId("selected-thread-label")).toBeVisible();
  });
  assertReadinessBudget({
    label: "startup-header-refresh",
    elapsedMilliseconds: headerRefreshElapsedMilliseconds,
    maximumMilliseconds: HEADER_REFRESH_READY_BUDGET_MILLISECONDS,
  });
  const performanceSnapshot = await readPerformanceProbeSnapshot(page);
  logPerformanceProbeSnapshot("startup-and-header-refresh", performanceSnapshot);
  assertRenderPerformanceBudget({
    label: "startup-and-header-refresh",
    snapshot: performanceSnapshot,
    maximumCumulativeLayoutShift: STARTUP_HEADER_MAX_CUMULATIVE_LAYOUT_SHIFT,
    maximumLongTaskCount: STARTUP_HEADER_MAX_LONG_TASK_COUNT,
    maximumLongTaskTotalDurationMilliseconds: STARTUP_HEADER_MAX_LONG_TASK_DURATION_MILLISECONDS,
    maximumFirstContentfulPaintMilliseconds: STARTUP_HEADER_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS,
  });

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
