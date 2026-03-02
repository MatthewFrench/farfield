import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, openSidebarIfHidden, selectFirstThreadIfAny } from "../helpers/app-actions";
import {
  captureRuntimeRequestErrorOperationCounts,
  expectChatSurfaceSettled,
  expectNoErrorBanner,
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

const THREAD_UNSUBSCRIBE_ROUTE_PATTERN = "**/api/threads/*/unsubscribe";
const THREAD_OPEN_READY_BUDGET_MILLISECONDS = 16_000;
const THREAD_OPEN_MAX_CUMULATIVE_LAYOUT_SHIFT = 0.2;
const THREAD_OPEN_MAX_LONG_TASK_COUNT = 24;
const THREAD_OPEN_MAX_LONG_TASK_DURATION_MILLISECONDS = 1_600;
const THREAD_OPEN_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS = 6_000;

function buildUnsubscribeThreadResponse(threadId: string) {
  return {
    ok: true,
    threadId,
    status: "notSubscribed",
  } as const;
}

test("thread list and open behavior", async ({ page, sentinel }) => {
  await installPerformanceProbe(page);

  await page.route(THREAD_UNSUBSCRIBE_ROUTE_PATTERN, async (route) => {
    const pathSegments = new URL(route.request().url()).pathname
      .split("/")
      .filter((segment) => segment.length > 0);
    const threadIdSegment = pathSegments[2];
    if (threadIdSegment === undefined) {
      await route.continue();
      return;
    }
    const threadId = decodeURIComponent(threadIdSegment);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildUnsubscribeThreadResponse(threadId)),
    });
  });

  const baselineRuntimeRequestErrorOperationCounts =
    await captureRuntimeRequestErrorOperationCounts(page);

  const threadOpenReadinessElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await openAppHome(page);
    await openSidebarIfHidden(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
  });
  assertReadinessBudget({
    label: "thread-open-behavior",
    elapsedMilliseconds: threadOpenReadinessElapsedMilliseconds,
    maximumMilliseconds: THREAD_OPEN_READY_BUDGET_MILLISECONDS,
  });
  const performanceSnapshot = await readPerformanceProbeSnapshot(page);
  logPerformanceProbeSnapshot("thread-open-behavior", performanceSnapshot);
  assertRenderPerformanceBudget({
    label: "thread-open-behavior",
    snapshot: performanceSnapshot,
    maximumCumulativeLayoutShift: THREAD_OPEN_MAX_CUMULATIVE_LAYOUT_SHIFT,
    maximumLongTaskCount: THREAD_OPEN_MAX_LONG_TASK_COUNT,
    maximumLongTaskTotalDurationMilliseconds: THREAD_OPEN_MAX_LONG_TASK_DURATION_MILLISECONDS,
    maximumFirstContentfulPaintMilliseconds: THREAD_OPEN_MAX_FIRST_CONTENTFUL_PAINT_MILLISECONDS,
  });
  const selection = await selectFirstThreadIfAny(page);

  if (selection.selected) {
    await expect(page.getByTestId("selected-thread-label")).not.toHaveText("No thread selected");
  } else {
    await expect(page.getByTestId("thread-list-empty")).toBeVisible();
    await expect(
      page.getByTestId("chat-empty-no-thread").or(page.getByTestId("chat-empty-loading-threads")),
    ).toBeVisible();
  }

  await expectNoErrorBanner(page);
  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);

  const currentRuntimeRequestErrorOperationCounts =
    await captureRuntimeRequestErrorOperationCounts(page);
  expectRuntimeRequestErrorOperationSpikeBudget({
    baselineOperationCounts: baselineRuntimeRequestErrorOperationCounts,
    currentOperationCounts: currentRuntimeRequestErrorOperationCounts,
    maximumIncreasePerOperation: 0,
  });
});
