import { test } from "../fixtures/real-app.fixture";
import { openAppHome } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoLoadFailedText,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
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

const APP_LOAD_READY_BUDGET_MILLISECONDS = 15_000;
const APP_LOAD_MAX_CUMULATIVE_LAYOUT_SHIFT = 0.2;
const APP_LOAD_MAX_LONG_TASK_COUNT = 24;
const APP_LOAD_MAX_LONG_TASK_DURATION_MILLISECONDS = 1_600;
const APP_LOAD_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS = 6_000;

test("app load health", async ({ page, sentinel }) => {
  await installPerformanceProbe(page);

  const appLoadReadinessElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await openAppHome(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
  });

  assertReadinessBudget({
    label: "app-load-health",
    elapsedMilliseconds: appLoadReadinessElapsedMilliseconds,
    maximumMilliseconds: APP_LOAD_READY_BUDGET_MILLISECONDS,
  });

  const performanceSnapshot = await readPerformanceProbeSnapshot(page);
  logPerformanceProbeSnapshot("app-load-health", performanceSnapshot);
  assertRenderPerformanceBudget({
    label: "app-load-health",
    snapshot: performanceSnapshot,
    maximumCumulativeLayoutShift: APP_LOAD_MAX_CUMULATIVE_LAYOUT_SHIFT,
    maximumLongTaskCount: APP_LOAD_MAX_LONG_TASK_COUNT,
    maximumLongTaskTotalDurationMilliseconds: APP_LOAD_MAX_LONG_TASK_DURATION_MILLISECONDS,
    maximumFirstContentfulPaintMilliseconds: APP_LOAD_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS,
  });

  await expectNoErrorBanner(page);
  await expectNoLoadFailedText(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
