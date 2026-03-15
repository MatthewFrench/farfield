import type { Page } from "@playwright/test";
import { z } from "zod";
import { expect, test } from "../fixtures/real-app.fixture";
import { openAppHome } from "../helpers/app-actions";
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

const PositiveIntegerEnvironmentValueSchema = z.coerce.number().int().positive();

const MOBILE_SIDEBAR_PROFILE_ITERATION_COUNT = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SIDEBAR_PROFILE_ITERATIONS"] ?? "16",
);
const MOBILE_SIDEBAR_READY_BUDGET_MILLISECONDS = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SIDEBAR_READY_BUDGET_MS"] ?? "12000",
);
const MOBILE_SIDEBAR_MAX_FREEZE_COUNT = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SIDEBAR_MAX_FREEZE_COUNT"] ?? "20",
);
const MOBILE_SIDEBAR_MAX_FREEZE_DURATION_MILLISECONDS = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SIDEBAR_MAX_FREEZE_DURATION_MS"] ?? "600",
);
const MOBILE_SIDEBAR_MAX_TOTAL_FREEZE_DURATION_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_SIDEBAR_MAX_TOTAL_FREEZE_DURATION_MS"] ?? "2500",
  );
const MOBILE_SIDEBAR_MAX_LONG_TASK_DURATION_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_SIDEBAR_MAX_LONG_TASK_DURATION_MS"] ?? "400",
  );

function buildIterationLabel(index: number): string {
  return `mobile-sidebar-iteration-${String(index + 1)}`;
}

async function openAndCloseSidebarCycle(page: Page, sentinel: ErrorSentinel): Promise<number> {
  return measureElapsedMilliseconds(async () => {
    const openButton = page.getByTestId("sidebar-toggle-open").first();
    await openButton.click();
    await expect(page.getByTestId("sidebar-mobile")).toBeVisible();
    await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();
    await expectThreadListSettled(page, sentinel);

    const sidebarMobile = page.getByTestId("sidebar-mobile");
    await sidebarMobile.getByTestId("sidebar-toggle-close").click();
    await expect(sidebarMobile).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByTestId("sidebar-backdrop")).toHaveClass(/opacity-0/);
  });
}

function readMaximumIterationDuration(iterationDurationsMilliseconds: number[]): number {
  return iterationDurationsMilliseconds.reduce(
    (maximumDurationMilliseconds, durationMilliseconds) =>
      Math.max(maximumDurationMilliseconds, durationMilliseconds),
    0,
  );
}

test("mobile sidebar freeze profile", async ({ page, sentinel }, testInfo) => {
  const browserLabel = testInfo.project.use.browserName ?? "browser";
  const scenarioLabel = `${browserLabel}-mobile-sidebar-freeze-profile`;

  await page.setViewportSize({ width: 390, height: 844 });
  await installPerformanceProbe(page);

  const startupReadinessElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await openAppHome(page);
    await expectChatSurfaceSettled(page, sentinel);
    await page.getByTestId("sidebar-toggle-open").first().waitFor({ state: "visible" });
  });
  assertReadinessBudget({
    label: "mobile-sidebar-freeze-profile-startup",
    elapsedMilliseconds: startupReadinessElapsedMilliseconds,
    maximumMilliseconds: MOBILE_SIDEBAR_READY_BUDGET_MILLISECONDS,
  });

  await resetClientPerformanceProbeSnapshot(page);

  const iterationDurationsMilliseconds: number[] = [];
  for (
    let iterationIndex = 0;
    iterationIndex < MOBILE_SIDEBAR_PROFILE_ITERATION_COUNT;
    iterationIndex += 1
  ) {
    const iterationElapsedMilliseconds = await openAndCloseSidebarCycle(page, sentinel);
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
    label: "mobile-sidebar-freeze-profile-max-iteration",
    elapsedMilliseconds: readMaximumIterationDuration(iterationDurationsMilliseconds),
    maximumMilliseconds: MOBILE_SIDEBAR_READY_BUDGET_MILLISECONDS,
  });
  assertFreezeProfileBudget({
    label: scenarioLabel,
    report: freezeProfileReport,
    maximumFreezeCount: MOBILE_SIDEBAR_MAX_FREEZE_COUNT,
    maximumFreezeDurationMilliseconds: MOBILE_SIDEBAR_MAX_FREEZE_DURATION_MILLISECONDS,
    maximumTotalFreezeDurationMilliseconds: MOBILE_SIDEBAR_MAX_TOTAL_FREEZE_DURATION_MILLISECONDS,
    maximumLongTaskDurationMilliseconds: MOBILE_SIDEBAR_MAX_LONG_TASK_DURATION_MILLISECONDS,
  });

  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
