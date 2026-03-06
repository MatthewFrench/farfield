import type { Page } from "@playwright/test";
import { z } from "zod";
import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome, openSidebarIfHidden, selectThreadByIndexIfAny } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";
import type { ErrorSentinel } from "../helpers/error-sentinel";
import {
  assertFreezeProfileBudget,
  assertReadinessBudget,
  buildFreezeProfileReport,
  installPerformanceProbe,
  logFreezeProfileReport,
  logPerformanceProbeSnapshot,
  measureElapsedMilliseconds,
  readClientPerformanceProbeSnapshot,
  readPerformanceProbeSnapshot,
  resetClientPerformanceProbeSnapshot,
  writeFreezeProfileArtifact,
} from "../helpers/performance-probe";

const THREAD_UNSUBSCRIBE_ROUTE_PATTERN = "**/api/threads/*/unsubscribe";
const PositiveIntegerEnvironmentValueSchema = z.coerce.number().int().positive();

const MOBILE_THREAD_OPEN_PROFILE_ITERATION_COUNT = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_THREAD_OPEN_PROFILE_ITERATIONS"] ?? "8",
);
const MOBILE_THREAD_OPEN_READY_BUDGET_MILLISECONDS = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_THREAD_OPEN_READY_BUDGET_MS"] ?? "12000",
);
const MOBILE_THREAD_OPEN_MAX_FREEZE_COUNT = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_THREAD_OPEN_MAX_FREEZE_COUNT"] ?? "12",
);
const MOBILE_THREAD_OPEN_MAX_FREEZE_DURATION_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_THREAD_OPEN_MAX_FREEZE_DURATION_MS"] ?? "600",
  );
const MOBILE_THREAD_OPEN_MAX_TOTAL_FREEZE_DURATION_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_THREAD_OPEN_MAX_TOTAL_FREEZE_DURATION_MS"] ?? "2500",
  );
const MOBILE_THREAD_OPEN_MAX_LONG_TASK_DURATION_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_THREAD_OPEN_MAX_LONG_TASK_DURATION_MS"] ?? "400",
  );

function buildIterationLabel(index: number): string {
  return `mobile-thread-open-iteration-${String(index + 1)}`;
}

function readMaximumIterationDuration(iterationDurationsMilliseconds: number[]): number {
  return iterationDurationsMilliseconds.reduce(
    (maximumDurationMilliseconds, durationMilliseconds) =>
      Math.max(maximumDurationMilliseconds, durationMilliseconds),
    0,
  );
}

function buildUnsubscribeThreadResponse(threadId: string) {
  return {
    ok: true,
    threadId,
    status: "notSubscribed",
  } as const;
}

async function openThreadCycle(input: {
  page: Page;
  sentinel: ErrorSentinel;
  threadIndex: number;
}): Promise<number> {
  return measureElapsedMilliseconds(async () => {
    await openSidebarIfHidden(input.page);
    await expect(input.page.getByTestId("sidebar-mobile")).toBeVisible();
    await expectThreadListSettled(input.page, input.sentinel);

    const selection = await selectThreadByIndexIfAny(input.page, input.threadIndex);
    if (!selection.selected) {
      throw new Error(`Expected thread selection for index ${String(input.threadIndex)}`);
    }

    await expect(input.page.getByTestId("selected-thread-label")).not.toHaveText(
      "No thread selected",
    );
    await expectChatSurfaceSettled(input.page, input.sentinel);
  });
}

test("mobile thread open freeze profile", async ({ page, sentinel }, testInfo) => {
  const browserLabel = testInfo.project.use.browserName ?? "browser";
  const scenarioLabel = `${browserLabel}-mobile-thread-open-freeze-profile`;

  await page.setViewportSize({ width: 390, height: 844 });
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

  const startupReadinessElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await openAppHome(page);
    await openSidebarIfHidden(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
  });
  assertReadinessBudget({
    label: "mobile-thread-open-freeze-profile-startup",
    elapsedMilliseconds: startupReadinessElapsedMilliseconds,
    maximumMilliseconds: MOBILE_THREAD_OPEN_READY_BUDGET_MILLISECONDS,
  });

  const threadRows = page.getByTestId("thread-list-item");
  const availableThreadCount = await threadRows.count();
  if (availableThreadCount === 0) {
    await expect(page.getByTestId("thread-list-empty")).toBeVisible();
    return;
  }

  const effectiveIterationCount = Math.min(
    MOBILE_THREAD_OPEN_PROFILE_ITERATION_COUNT,
    availableThreadCount >= 2 ? MOBILE_THREAD_OPEN_PROFILE_ITERATION_COUNT : 1,
  );

  await resetClientPerformanceProbeSnapshot(page);

  const iterationDurationsMilliseconds: number[] = [];
  for (let iterationIndex = 0; iterationIndex < effectiveIterationCount; iterationIndex += 1) {
    const threadIndex = availableThreadCount >= 2 ? iterationIndex % 2 : 0;
    const iterationElapsedMilliseconds = await openThreadCycle({
      page,
      sentinel,
      threadIndex,
    });
    iterationDurationsMilliseconds.push(iterationElapsedMilliseconds);
    process.stdout.write(
      `[end-to-end-performance] ${buildIterationLabel(iterationIndex)} readinessMs=${String(
        iterationElapsedMilliseconds,
      )}\n`,
    );
  }

  const renderPerformanceSnapshot = await readPerformanceProbeSnapshot(page);
  logPerformanceProbeSnapshot(scenarioLabel, renderPerformanceSnapshot);

  const freezeSnapshot = await readClientPerformanceProbeSnapshot(page);
  const freezeProfileReport = buildFreezeProfileReport(freezeSnapshot);
  logFreezeProfileReport(scenarioLabel, freezeProfileReport);
  await writeFreezeProfileArtifact({
    testInfo,
    label: scenarioLabel,
    snapshot: freezeSnapshot,
    report: freezeProfileReport,
  });

  assertReadinessBudget({
    label: "mobile-thread-open-freeze-profile-max-iteration",
    elapsedMilliseconds: readMaximumIterationDuration(iterationDurationsMilliseconds),
    maximumMilliseconds: MOBILE_THREAD_OPEN_READY_BUDGET_MILLISECONDS,
  });
  assertFreezeProfileBudget({
    label: scenarioLabel,
    report: freezeProfileReport,
    maximumFreezeCount: MOBILE_THREAD_OPEN_MAX_FREEZE_COUNT,
    maximumFreezeDurationMilliseconds: MOBILE_THREAD_OPEN_MAX_FREEZE_DURATION_MILLISECONDS,
    maximumTotalFreezeDurationMilliseconds:
      MOBILE_THREAD_OPEN_MAX_TOTAL_FREEZE_DURATION_MILLISECONDS,
    maximumLongTaskDurationMilliseconds: MOBILE_THREAD_OPEN_MAX_LONG_TASK_DURATION_MILLISECONDS,
  });

  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
