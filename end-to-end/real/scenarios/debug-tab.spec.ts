import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, openDebugTab } from "../helpers/app-actions";
import {
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
} from "../helpers/app-assertions";
import {
  assertReadinessBudget,
  assertRenderPerformanceBudget,
  installPerformanceProbe,
  logPerformanceProbeSnapshot,
  measureElapsedMilliseconds,
  readPerformanceProbeSnapshot,
} from "../helpers/performance-probe";

const DEBUG_HISTORY_ROUTE_PATTERN = "**/api/debug/history?*";
const DEBUG_TAB_OPEN_BUDGET_MILLISECONDS = 8_000;
const DEBUG_TAB_SWITCH_BUDGET_MILLISECONDS = 2_500;
const DEBUG_TAB_MAX_CUMULATIVE_LAYOUT_SHIFT = 0.25;
const DEBUG_TAB_MAX_LONG_TASK_COUNT = 24;
const DEBUG_TAB_MAX_LONG_TASK_DURATION_MILLISECONDS = 1_600;
const DEBUG_TAB_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS = 6_000;

function buildEmptyDebugHistoryResponse() {
  return {
    ok: true,
    history: [],
  } as const;
}

test("debug tab accessibility", async ({ page, sentinel }) => {
  await installPerformanceProbe(page);

  await page.route(DEBUG_HISTORY_ROUTE_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildEmptyDebugHistoryResponse()),
    });
  });

  try {
    await openAppHome(page);

    const openDebugTabElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
      await openDebugTab(page);
      await expect(page.getByTestId("debug-issues-panel")).toBeVisible();
    });
    assertReadinessBudget({
      label: "debug-tab-open",
      elapsedMilliseconds: openDebugTabElapsedMilliseconds,
      maximumMilliseconds: DEBUG_TAB_OPEN_BUDGET_MILLISECONDS,
    });

    const switchToHistoryElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
      await page.getByRole("tab", { name: "History" }).click();
      await expect(page.getByTestId("debug-history-panel")).toBeVisible();
    });
    assertReadinessBudget({
      label: "debug-tab-switch-history",
      elapsedMilliseconds: switchToHistoryElapsedMilliseconds,
      maximumMilliseconds: DEBUG_TAB_SWITCH_BUDGET_MILLISECONDS,
    });

    const switchToTraceElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
      await page.getByRole("tab", { name: "Trace" }).click();
      await expect(page.getByTestId("debug-trace-panel")).toBeVisible();
    });
    assertReadinessBudget({
      label: "debug-tab-switch-trace",
      elapsedMilliseconds: switchToTraceElapsedMilliseconds,
      maximumMilliseconds: DEBUG_TAB_SWITCH_BUDGET_MILLISECONDS,
    });

    const switchToStreamElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
      await page.getByRole("tab", { name: "Stream" }).click();
      await expect(page.getByTestId("debug-stream-events-panel")).toBeVisible();
    });
    assertReadinessBudget({
      label: "debug-tab-switch-stream",
      elapsedMilliseconds: switchToStreamElapsedMilliseconds,
      maximumMilliseconds: DEBUG_TAB_SWITCH_BUDGET_MILLISECONDS,
    });

    const performanceSnapshot = await readPerformanceProbeSnapshot(page);
    logPerformanceProbeSnapshot("debug-tab-accessibility", performanceSnapshot);
    assertRenderPerformanceBudget({
      label: "debug-tab-accessibility",
      snapshot: performanceSnapshot,
      maximumCumulativeLayoutShift: DEBUG_TAB_MAX_CUMULATIVE_LAYOUT_SHIFT,
      maximumLongTaskCount: DEBUG_TAB_MAX_LONG_TASK_COUNT,
      maximumLongTaskTotalDurationMilliseconds: DEBUG_TAB_MAX_LONG_TASK_DURATION_MILLISECONDS,
      maximumFirstContentfulPaintMilliseconds: DEBUG_TAB_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS,
    });

    await expectNoUnexpectedClientErrors(sentinel);
    await expectNoFailedApiResponses(sentinel);
    await expectNoUnexpectedWarningsOrErrors(sentinel);
  } finally {
    await page.unroute(DEBUG_HISTORY_ROUTE_PATTERN);
  }
});
