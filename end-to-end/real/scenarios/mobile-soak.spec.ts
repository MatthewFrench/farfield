/**
 * Exercises a bounded mobile soak loop against the real app stack.
 * The scenario reads existing threads without mutating them, then mutates only one
 * managed thread through the user interface so reload and freeze checks stay isolated.
 * This scenario must use the real product path end to end: no Playwright route stubbing for
 * product API endpoints is allowed here.
 */
import type { Page } from "@playwright/test";
import { z } from "zod";
import { expect, test } from "../fixtures/real-app.fixture";
import {
  openAppHome,
  openSidebarIfHidden,
  selectThreadByIndexIfAny,
  triggerHeaderRefresh,
} from "../helpers/app-actions";
import {
  captureRequestObservabilitySnapshot,
  captureRuntimeRequestErrorOperationCounts,
  expectChatSurfaceSettled,
  expectNoErrorBanner,
  expectNoFailedApiResponses,
  expectNoLoadFailedText,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectRequestObservabilityBudgets,
  expectRuntimeRequestErrorOperationSpikeBudget,
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
const NonNegativeIntegerEnvironmentValueSchema = z.coerce.number().int().nonnegative();
const MANAGED_THREAD_BROWSE_LIMIT = 2;
const MESSAGE_VISIBILITY_TIMEOUT_MILLISECONDS = 30_000;
const SEND_BUTTON_VISIBILITY_TIMEOUT_MILLISECONDS = 20_000;
const SEND_ACTION_LABEL = "Send";
const CONVERSATION_LOG_LABEL = "Conversation updates";
const MANAGED_THREAD_RESPONSE_PREFIX = "SOAK-OK-";
const MANAGED_THREAD_SEED_MESSAGE = "Reply with exactly SOAK-SEED-OK and nothing else.";

const MOBILE_SOAK_ITERATION_COUNT = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SOAK_ITERATIONS"] ?? "3",
);
const MOBILE_SOAK_COLD_ITERATION_READY_BUDGET_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_SOAK_COLD_READY_BUDGET_MS"] ?? "28000",
  );
const MOBILE_SOAK_WARM_ITERATION_READY_BUDGET_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_SOAK_WARM_READY_BUDGET_MS"] ?? "16000",
  );
const MOBILE_SOAK_STARTUP_READY_BUDGET_MILLISECONDS = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SOAK_STARTUP_READY_BUDGET_MS"] ?? "20000",
);
const MOBILE_SOAK_MAX_FREEZE_COUNT = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SOAK_MAX_FREEZE_COUNT"] ?? "4",
);
const MOBILE_SOAK_MAX_FREEZE_DURATION_MILLISECONDS = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SOAK_MAX_FREEZE_DURATION_MS"] ?? "300",
);
const MOBILE_SOAK_MAX_TOTAL_FREEZE_DURATION_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_SOAK_MAX_TOTAL_FREEZE_DURATION_MS"] ?? "600",
  );
const MOBILE_SOAK_MAX_LONG_TASK_DURATION_MILLISECONDS = PositiveIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SOAK_MAX_LONG_TASK_DURATION_MS"] ?? "250",
);
const MOBILE_SOAK_MAX_ROUTE_LAST_DURATION_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_SOAK_MAX_ROUTE_LAST_DURATION_MS"] ?? "3000",
  );
const MOBILE_SOAK_MAX_ROUTE_LAST_QUEUE_DELAY_MILLISECONDS =
  PositiveIntegerEnvironmentValueSchema.parse(
    process.env["E2E_REAL_MOBILE_SOAK_MAX_ROUTE_LAST_QUEUE_DELAY_MS"] ?? "300",
  );
const MOBILE_SOAK_MAX_REQUEST_ERROR_INCREASE = NonNegativeIntegerEnvironmentValueSchema.parse(
  process.env["E2E_REAL_MOBILE_SOAK_MAX_REQUEST_ERROR_INCREASE"] ?? "0",
);
const IGNORE_ROUTE_BUDGET_KEYS = [
  "GET /api/debug/client-errors",
  "GET /api/debug/observability",
] as const;

function buildIterationLabel(index: number): string {
  return `mobile-soak-iteration-${String(index + 1)}`;
}

function buildManagedThreadMessage(iterationIndex: number): string {
  return `Reply with exactly ${buildManagedThreadResponse(iterationIndex)} and nothing else.`;
}

function buildManagedThreadResponse(iterationIndex: number): string {
  return `${MANAGED_THREAD_RESPONSE_PREFIX}${String(iterationIndex + 1)}`;
}

function escapeForRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildThreadRoutePattern(threadId: string): RegExp {
  return new RegExp(`/threads/${escapeForRegularExpression(threadId)}(?:$|[/?#])`);
}

function readMaximumIterationDuration(iterationDurationsMilliseconds: number[]): number {
  return iterationDurationsMilliseconds.reduce(
    (maximumDurationMilliseconds, durationMilliseconds) =>
      Math.max(maximumDurationMilliseconds, durationMilliseconds),
    0,
  );
}

function readMaximumWarmIterationDuration(iterationDurationsMilliseconds: number[]): number {
  const warmIterationDurationsMilliseconds = iterationDurationsMilliseconds.slice(1);
  if (warmIterationDurationsMilliseconds.length === 0) {
    return 0;
  }
  return readMaximumIterationDuration(warmIterationDurationsMilliseconds);
}

interface MobileSoakStateGuard {
  readManagedThreadTurnCount: (threadId: string) => Promise<number>;
  waitForManagedThreadTurnCount: (threadId: string, minimumTurnCount: number) => Promise<void>;
  waitForManagedThreadTurnCompletion: (threadId: string) => Promise<void>;
}

interface MobileSoakIterationStepDurations {
  browseMilliseconds: number;
  openMilliseconds: number;
  sendMilliseconds: number;
  reloadMilliseconds: number;
}

async function closeMobileSidebarIfVisible(page: Page): Promise<void> {
  const sidebarMobile = page.getByTestId("sidebar-mobile");
  const sidebarCount = await sidebarMobile.count();
  if (sidebarCount === 0) {
    return;
  }

  const sidebar = sidebarMobile.first();
  if ((await sidebar.getAttribute("aria-hidden")) !== "false") {
    return;
  }

  await sidebar.getByTestId("sidebar-toggle-close").click();
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
}

async function readThreadIdentifiersInSidebar(page: Page): Promise<string[]> {
  const threadRows = page.getByTestId("thread-list-item");
  const threadCount = await threadRows.count();
  const threadIdentifiers: string[] = [];

  for (let index = 0; index < threadCount; index += 1) {
    const threadIdentifier = await threadRows.nth(index).getAttribute("data-thread-id");
    if (threadIdentifier === null || threadIdentifier.length === 0) {
      continue;
    }
    threadIdentifiers.push(threadIdentifier);
  }

  return threadIdentifiers;
}

async function expectManagedThreadVisibleInSidebar(page: Page, threadId: string): Promise<void> {
  await openSidebarIfHidden(page);
  const threadRow = page
    .locator(`[data-testid="thread-list-item"][data-thread-id="${threadId}"]`)
    .first();
  await expect(threadRow).toBeVisible();
  await closeMobileSidebarIfVisible(page);
}

async function browseExistingThreads(
  page: Page,
  sentinel: ErrorSentinel,
  managedThreadId: string,
): Promise<void> {
  await openSidebarIfHidden(page);
  await expect(page.getByTestId("sidebar-mobile")).toBeVisible();
  await expectThreadListSettled(page, sentinel);

  const threadIdentifiers = await readThreadIdentifiersInSidebar(page);
  let browsedThreadCount = 0;
  for (const [threadIndex, threadIdentifier] of threadIdentifiers.entries()) {
    if (threadIdentifier === managedThreadId) {
      continue;
    }
    const selection = await selectThreadByIndexIfAny(page, threadIndex);
    if (!selection.selected) {
      continue;
    }

    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
    await expect(page).toHaveURL(buildThreadRoutePattern(threadIdentifier));
    browsedThreadCount += 1;

    if (browsedThreadCount >= MANAGED_THREAD_BROWSE_LIMIT) {
      break;
    }

    await openSidebarIfHidden(page);
    await expect(page.getByTestId("sidebar-mobile")).toBeVisible();
    await expectThreadListSettled(page, sentinel);
  }

  await closeMobileSidebarIfVisible(page);
}

async function openManagedThread(
  page: Page,
  sentinel: ErrorSentinel,
  threadId: string,
): Promise<void> {
  await openSidebarIfHidden(page);
  const threadRow = page
    .locator(`[data-testid="thread-list-item"][data-thread-id="${threadId}"]`)
    .first();
  await expect(threadRow).toBeVisible();
  await threadRow.click();
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expect(page).toHaveURL(buildThreadRoutePattern(threadId));
  await expect(page.getByTestId("selected-thread-label")).not.toHaveText("No thread selected");
}

async function sendMessageToManagedThread(
  page: Page,
  sentinel: ErrorSentinel,
  stateGuard: MobileSoakStateGuard,
  threadId: string,
  messageText: string,
  expectedAgentResponseText: string,
): Promise<void> {
  const composerInput = page.getByPlaceholder(/Message /i).first();
  const sendButton = page.getByRole("button", { name: SEND_ACTION_LABEL }).first();
  const baselineTurnCount = await stateGuard.readManagedThreadTurnCount(threadId);
  await expect(composerInput).toBeVisible();
  await expect(sendButton).toBeVisible({
    timeout: SEND_BUTTON_VISIBILITY_TIMEOUT_MILLISECONDS,
  });
  await composerInput.fill(messageText);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await stateGuard.waitForManagedThreadTurnCount(threadId, baselineTurnCount + 1);
  await stateGuard.waitForManagedThreadTurnCompletion(threadId);
  await triggerHeaderRefresh(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);

  const conversationLog = page.getByRole("log", { name: CONVERSATION_LOG_LABEL }).first();
  await expect(
    conversationLog.getByText(expectedAgentResponseText, {
      exact: true,
    }),
  ).toBeVisible({
    timeout: MESSAGE_VISIBILITY_TIMEOUT_MILLISECONDS,
  });
}

async function verifyManagedThreadAfterReload(
  page: Page,
  sentinel: ErrorSentinel,
  threadId: string,
  messageText: string,
  expectedAgentResponseText: string,
): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expect(page).toHaveURL(buildThreadRoutePattern(threadId));
  await expect(page.getByTestId("selected-thread-label")).not.toHaveText("No thread selected");

  const conversationLog = page.getByRole("log", { name: CONVERSATION_LOG_LABEL }).first();
  await expect(
    conversationLog.getByText(messageText, {
      exact: true,
    }),
  ).toBeVisible({
    timeout: MESSAGE_VISIBILITY_TIMEOUT_MILLISECONDS,
  });
  await expect(
    conversationLog.getByText(expectedAgentResponseText, {
      exact: true,
    }),
  ).toBeVisible({
    timeout: MESSAGE_VISIBILITY_TIMEOUT_MILLISECONDS,
  });

  await expectManagedThreadVisibleInSidebar(page, threadId);
}

async function runMobileSoakIteration(input: {
  page: Page;
  sentinel: ErrorSentinel;
  stateGuard: MobileSoakStateGuard;
  managedThreadId: string;
  iterationIndex: number;
}): Promise<MobileSoakIterationStepDurations> {
  const browseMilliseconds = await measureElapsedMilliseconds(async () => {
    await browseExistingThreads(input.page, input.sentinel, input.managedThreadId);
  });
  const openMilliseconds = await measureElapsedMilliseconds(async () => {
    await openManagedThread(input.page, input.sentinel, input.managedThreadId);
  });

  const messageText = buildManagedThreadMessage(input.iterationIndex);
  const expectedAgentResponseText = buildManagedThreadResponse(input.iterationIndex);
  const sendMilliseconds = await measureElapsedMilliseconds(async () => {
    await sendMessageToManagedThread(
      input.page,
      input.sentinel,
      input.stateGuard,
      input.managedThreadId,
      messageText,
      expectedAgentResponseText,
    );
  });
  const reloadMilliseconds = await measureElapsedMilliseconds(async () => {
    await verifyManagedThreadAfterReload(
      input.page,
      input.sentinel,
      input.managedThreadId,
      messageText,
      expectedAgentResponseText,
    );
  });

  return {
    browseMilliseconds,
    openMilliseconds,
    sendMilliseconds,
    reloadMilliseconds,
  };
}

function logIterationStepDurations(
  iterationIndex: number,
  stepDurations: MobileSoakIterationStepDurations,
): void {
  process.stdout.write(
    `[end-to-end-performance] ${buildIterationLabel(iterationIndex)} steps browseMs=${String(
      stepDurations.browseMilliseconds,
    )} openMs=${String(stepDurations.openMilliseconds)} sendMs=${String(
      stepDurations.sendMilliseconds,
    )} reloadMs=${String(stepDurations.reloadMilliseconds)}\n`,
  );
}

test("mobile managed-thread soak behavior", async ({ page, sentinel, stateGuard }, testInfo) => {
  const browserLabel = testInfo.project.use.browserName ?? "browser";
  const scenarioLabel = `${browserLabel}-mobile-soak`;

  await page.setViewportSize({ width: 390, height: 844 });
  await installPerformanceProbe(page);

  const managedThreadId = await stateGuard.createManagedThread({
    ephemeral: false,
  });
  await stateGuard.sendManagedThreadMessage(managedThreadId, MANAGED_THREAD_SEED_MESSAGE);
  await stateGuard.waitForManagedThreadInActiveList(managedThreadId);
  await stateGuard.waitForManagedThreadReadiness(managedThreadId);
  await stateGuard.waitForManagedThreadTurnCompletion(managedThreadId);

  const baselineRuntimeRequestErrorOperationCounts =
    await captureRuntimeRequestErrorOperationCounts(page);

  const startupReadinessElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
    await openAppHome(page);
    await expectThreadListSettled(page, sentinel);
    await expectChatSurfaceSettled(page, sentinel);
  });
  assertReadinessBudget({
    label: "mobile-soak-startup",
    elapsedMilliseconds: startupReadinessElapsedMilliseconds,
    maximumMilliseconds: MOBILE_SOAK_STARTUP_READY_BUDGET_MILLISECONDS,
  });

  await triggerHeaderRefresh(page);
  await expectThreadListSettled(page, sentinel);
  await expectChatSurfaceSettled(page, sentinel);
  await expectManagedThreadVisibleInSidebar(page, managedThreadId);
  await sentinel.markCurrentDebugErrorsAsBaseline();
  await resetClientPerformanceProbeSnapshot(page);
  const baselineRequestObservabilitySnapshot = await captureRequestObservabilitySnapshot(page);

  const iterationDurationsMilliseconds: number[] = [];
  for (let iterationIndex = 0; iterationIndex < MOBILE_SOAK_ITERATION_COUNT; iterationIndex += 1) {
    let stepDurations: MobileSoakIterationStepDurations | null = null;
    const iterationElapsedMilliseconds = await measureElapsedMilliseconds(async () => {
      stepDurations = await runMobileSoakIteration({
        page,
        sentinel,
        stateGuard,
        managedThreadId,
        iterationIndex,
      });
    });

    iterationDurationsMilliseconds.push(iterationElapsedMilliseconds);
    process.stdout.write(
      `[end-to-end-performance] ${buildIterationLabel(iterationIndex)} readinessMs=${String(
        iterationElapsedMilliseconds,
      )}\n`,
    );
    if (stepDurations !== null) {
      logIterationStepDurations(iterationIndex, stepDurations);
    }
  }

  const performanceSnapshot = await readPerformanceProbeSnapshot(page);
  logPerformanceProbeSnapshot(scenarioLabel, performanceSnapshot);

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
    label: "mobile-soak-cold-iteration",
    elapsedMilliseconds: iterationDurationsMilliseconds[0] ?? 0,
    maximumMilliseconds: MOBILE_SOAK_COLD_ITERATION_READY_BUDGET_MILLISECONDS,
  });
  assertReadinessBudget({
    label: "mobile-soak-warm-iteration",
    elapsedMilliseconds: readMaximumWarmIterationDuration(iterationDurationsMilliseconds),
    maximumMilliseconds: MOBILE_SOAK_WARM_ITERATION_READY_BUDGET_MILLISECONDS,
  });
  assertFreezeProfileBudget({
    label: scenarioLabel,
    report: freezeProfileReport,
    maximumFreezeCount: MOBILE_SOAK_MAX_FREEZE_COUNT,
    maximumFreezeDurationMilliseconds: MOBILE_SOAK_MAX_FREEZE_DURATION_MILLISECONDS,
    maximumTotalFreezeDurationMilliseconds: MOBILE_SOAK_MAX_TOTAL_FREEZE_DURATION_MILLISECONDS,
    maximumLongTaskDurationMilliseconds: MOBILE_SOAK_MAX_LONG_TASK_DURATION_MILLISECONDS,
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
  const currentRequestObservabilitySnapshot = await captureRequestObservabilitySnapshot(page);
  expectRequestObservabilityBudgets({
    baselineSnapshot: baselineRequestObservabilitySnapshot,
    currentSnapshot: currentRequestObservabilitySnapshot,
    maximumRequestErrorIncrease: MOBILE_SOAK_MAX_REQUEST_ERROR_INCREASE,
    maximumLastDurationMs: MOBILE_SOAK_MAX_ROUTE_LAST_DURATION_MILLISECONDS,
    maximumLastQueueDelayMs: MOBILE_SOAK_MAX_ROUTE_LAST_QUEUE_DELAY_MILLISECONDS,
    ignoredRouteKeys: [...IGNORE_ROUTE_BUDGET_KEYS],
  });
});
