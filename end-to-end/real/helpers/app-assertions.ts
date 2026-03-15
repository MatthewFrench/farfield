import {
  DebugErrorListResponseSchema,
  FarfieldDebugObservabilityEnvelopeSchema,
} from "@farfield/protocol";
import { expect, type Page } from "@playwright/test";
import { z } from "zod";
import type { ErrorSentinel } from "./error-sentinel";

interface SettleOptions {
  timeoutMs?: number;
}

const DEFAULT_SETTLE_TIMEOUT_MS = 90_000;
const DEBUG_ERROR_LIST_LIMIT = 200;
const RUNTIME_REQUEST_ERROR_OPERATION = "runtime-request-error";
const REQUEST_PATH_IN_MESSAGE_PATTERN = /\/api\/[a-z0-9/_-]+/i;
const RUNTIME_REQUEST_PATH_OPERATION_PREFIX = "request-path";

const RuntimeRequestErrorDetailsSchema = z
  .object({
    actionName: z.string().trim().min(1).optional(),
  })
  .passthrough();

const DebugErrorListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(DebugErrorListResponseSchema)
  .strict();

export interface RuntimeRequestErrorOperationCountSnapshot {
  readonly [operation: string]: number;
}

export interface RuntimeRequestErrorOperationSpikeAssertionInput {
  baselineOperationCounts: RuntimeRequestErrorOperationCountSnapshot;
  currentOperationCounts: RuntimeRequestErrorOperationCountSnapshot;
  maximumIncreasePerOperation: number;
}

export interface RequestObservabilityRouteSnapshot {
  requestCount: number;
  lastDurationMs: number;
  lastQueueDelayMs: number;
}

export interface RequestObservabilitySnapshot {
  totalErrorCount: number;
  routeSnapshotByKey: Record<string, RequestObservabilityRouteSnapshot>;
}

export interface RequestObservabilityBudgetAssertionInput {
  baselineSnapshot: RequestObservabilitySnapshot;
  currentSnapshot: RequestObservabilitySnapshot;
  maximumRequestErrorIncrease: number;
  maximumLastDurationMs: number;
  maximumLastQueueDelayMs: number;
  ignoredRouteKeys?: string[];
}

function readRuntimeRequestOperationLabel(
  debugError: z.infer<typeof DebugErrorListResponseSchema.shape.data.element>,
): string {
  const parsedDetails = RuntimeRequestErrorDetailsSchema.parse(debugError.details);
  if (
    parsedDetails.actionName !== undefined &&
    parsedDetails.actionName.toLowerCase() !== RUNTIME_REQUEST_ERROR_OPERATION
  ) {
    return parsedDetails.actionName;
  }

  const requestPath = debugError.message.match(REQUEST_PATH_IN_MESSAGE_PATTERN)?.[0] ?? null;
  if (requestPath !== null) {
    return `${RUNTIME_REQUEST_PATH_OPERATION_PREFIX}:${requestPath}`;
  }

  return RUNTIME_REQUEST_ERROR_OPERATION;
}

function readRuntimeRequestErrorOperationCountSnapshot(
  debugErrors: z.infer<typeof DebugErrorListResponseSchema.shape.data>,
): RuntimeRequestErrorOperationCountSnapshot {
  const operationCounts = new Map<string, number>();

  for (const debugError of debugErrors) {
    if (debugError.operation !== RUNTIME_REQUEST_ERROR_OPERATION) {
      continue;
    }
    const operationLabel = readRuntimeRequestOperationLabel(debugError);
    operationCounts.set(operationLabel, (operationCounts.get(operationLabel) ?? 0) + 1);
  }

  return [...operationCounts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .reduce<Record<string, number>>((snapshot, [operation, count]) => {
      snapshot[operation] = count;
      return snapshot;
    }, {});
}

function readOperationIncreaseDetails(
  input: RuntimeRequestErrorOperationSpikeAssertionInput,
): string[] {
  const operations = new Set<string>([
    ...Object.keys(input.baselineOperationCounts),
    ...Object.keys(input.currentOperationCounts),
  ]);

  const operationIncreaseDetails: string[] = [];
  for (const operation of operations) {
    const baselineCount = input.baselineOperationCounts[operation] ?? 0;
    const currentCount = input.currentOperationCounts[operation] ?? 0;
    const increase = currentCount - baselineCount;
    if (increase > input.maximumIncreasePerOperation) {
      operationIncreaseDetails.push(
        `${operation}: baseline=${String(baselineCount)} current=${String(currentCount)} increase=${String(increase)}`,
      );
    }
  }

  return operationIncreaseDetails;
}

async function waitForState(
  page: Page,
  testId: string,
  disallowedState: string,
  surface: string,
  sentinel: ErrorSentinel,
  timeoutMs: number,
): Promise<void> {
  const readVisibleState = async (): Promise<string> => {
    const stateLocators = page.getByTestId(testId);
    const count = await stateLocators.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = stateLocators.nth(index);
      if (await candidate.isVisible()) {
        return (await candidate.getAttribute("data-state")) ?? "";
      }
    }
    return "__hidden__";
  };

  try {
    await expect
      .poll(readVisibleState, {
        timeout: timeoutMs,
        message: `${surface} did not become visible within ${String(timeoutMs)}ms`,
      })
      .not.toBe("__hidden__");
    await expect
      .poll(readVisibleState, {
        timeout: timeoutMs,
        message: `${surface} did not settle within ${String(timeoutMs)}ms`,
      })
      .not.toBe(disallowedState);
  } catch (error) {
    const observedState = await readVisibleState();
    sentinel.recordLoadingTimeoutBreach({
      surface,
      timeoutMs,
      observedState,
    });
    throw error;
  }
}

export async function expectNoErrorBanner(page: Page): Promise<void> {
  await expect(page.getByTestId("error-banner")).toHaveCount(0);
}

export async function expectNoLoadFailedText(page: Page): Promise<void> {
  await expect(page.getByText("Load failed", { exact: false })).toHaveCount(0);
}

export async function expectThreadListSettled(
  page: Page,
  sentinel: ErrorSentinel,
  options?: SettleOptions,
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
  await waitForState(page, "thread-list-status", "loading", "thread-list", sentinel, timeoutMs);
}

export async function expectChatSurfaceSettled(
  page: Page,
  sentinel: ErrorSentinel,
  options?: SettleOptions,
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
  const readVisibleState = async (): Promise<string> => {
    const stateLocators = page.getByTestId("chat-surface");
    const count = await stateLocators.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = stateLocators.nth(index);
      if (await candidate.isVisible()) {
        return (await candidate.getAttribute("data-state")) ?? "";
      }
    }
    return "__hidden__";
  };

  try {
    await expect
      .poll(readVisibleState, {
        timeout: timeoutMs,
        message: `chat-surface did not become visible within ${String(timeoutMs)}ms`,
      })
      .not.toBe("__hidden__");
    await expect
      .poll(
        async () => {
          const state = await readVisibleState();
          return state === "loading-threads" || state === "loading-thread";
        },
        {
          timeout: timeoutMs,
          message: `chat-surface did not settle within ${String(timeoutMs)}ms`,
        },
      )
      .toBe(false);
  } catch (error) {
    const observedState = await readVisibleState();
    sentinel.recordLoadingTimeoutBreach({
      surface: "chat-surface",
      timeoutMs,
      observedState,
    });
    throw error;
  }
}

export async function expectNoUnexpectedClientErrors(sentinel: ErrorSentinel): Promise<void> {
  await sentinel.assertNoUnexpectedClientErrors();
}

export async function expectNoFailedApiResponses(sentinel: ErrorSentinel): Promise<void> {
  await sentinel.assertNoFailedApiResponses();
}

export async function expectNoUnexpectedWarningsOrErrors(sentinel: ErrorSentinel): Promise<void> {
  await sentinel.assertNoUnexpectedWarningsOrErrors();
}

export async function captureRuntimeRequestErrorOperationCounts(
  page: Page,
): Promise<RuntimeRequestErrorOperationCountSnapshot> {
  const response = await page.request.get(
    `/api/debug/client-errors?limit=${String(DEBUG_ERROR_LIST_LIMIT)}`,
  );
  expect(response.ok()).toBe(true);

  const payload = await response.json();
  const parsedEnvelope = DebugErrorListEnvelopeSchema.parse(payload);
  return readRuntimeRequestErrorOperationCountSnapshot(parsedEnvelope.data);
}

function buildRequestObservabilityRouteKey(input: { method: string; route: string }): string {
  return `${input.method} ${input.route}`;
}

export async function captureRequestObservabilitySnapshot(
  page: Page,
): Promise<RequestObservabilitySnapshot> {
  const response = await page.request.get("/api/debug/observability");
  expect(response.ok()).toBe(true);

  const payload = await response.json();
  const parsedEnvelope = FarfieldDebugObservabilityEnvelopeSchema.parse(payload);
  const routeSnapshotByKey = parsedEnvelope.snapshot.performance.requestRouting.routeTimings.reduce<
    Record<string, RequestObservabilityRouteSnapshot>
  >((snapshot, routeTiming) => {
    snapshot[buildRequestObservabilityRouteKey(routeTiming)] = {
      requestCount: routeTiming.requestCount,
      lastDurationMs: routeTiming.lastDurationMs,
      lastQueueDelayMs: routeTiming.lastQueueDelayMs,
    };
    return snapshot;
  }, {});

  return {
    totalErrorCount: parsedEnvelope.snapshot.performance.requestRouting.totalErrorCount,
    routeSnapshotByKey,
  };
}

function readRequestObservabilityBudgetViolations(
  input: RequestObservabilityBudgetAssertionInput,
): string[] {
  const ignoredRouteKeys = new Set(input.ignoredRouteKeys ?? []);
  const routeKeys = new Set<string>([
    ...Object.keys(input.baselineSnapshot.routeSnapshotByKey),
    ...Object.keys(input.currentSnapshot.routeSnapshotByKey),
  ]);

  const violations: string[] = [];
  for (const routeKey of routeKeys) {
    if (ignoredRouteKeys.has(routeKey)) {
      continue;
    }

    const baselineRouteSnapshot = input.baselineSnapshot.routeSnapshotByKey[routeKey];
    const currentRouteSnapshot = input.currentSnapshot.routeSnapshotByKey[routeKey];
    if (currentRouteSnapshot === undefined) {
      continue;
    }

    const baselineRequestCount = baselineRouteSnapshot?.requestCount ?? 0;
    if (currentRouteSnapshot.requestCount <= baselineRequestCount) {
      continue;
    }

    if (currentRouteSnapshot.lastDurationMs > input.maximumLastDurationMs) {
      violations.push(
        `${routeKey}: lastDurationMs=${String(currentRouteSnapshot.lastDurationMs)} budget=${String(input.maximumLastDurationMs)}`,
      );
    }
    if (currentRouteSnapshot.lastQueueDelayMs > input.maximumLastQueueDelayMs) {
      violations.push(
        `${routeKey}: lastQueueDelayMs=${String(currentRouteSnapshot.lastQueueDelayMs)} budget=${String(input.maximumLastQueueDelayMs)}`,
      );
    }
  }

  return violations;
}

export function expectRuntimeRequestErrorOperationSpikeBudget(
  input: RuntimeRequestErrorOperationSpikeAssertionInput,
): void {
  const operationIncreaseDetails = readOperationIncreaseDetails(input);
  expect(
    operationIncreaseDetails,
    `runtime-request-error operation increases exceeded budget ${String(input.maximumIncreasePerOperation)}:\n${operationIncreaseDetails.join("\n")}`,
  ).toEqual([]);
}

export function expectRequestObservabilityBudgets(
  input: RequestObservabilityBudgetAssertionInput,
): void {
  const requestErrorIncrease =
    input.currentSnapshot.totalErrorCount - input.baselineSnapshot.totalErrorCount;
  expect(
    requestErrorIncrease,
    `requestRouting.totalErrorCount increased beyond budget ${String(input.maximumRequestErrorIncrease)}`,
  ).toBeLessThanOrEqual(input.maximumRequestErrorIncrease);

  const violations = readRequestObservabilityBudgetViolations(input);
  expect(
    violations,
    `request observability route budgets were exceeded:\n${violations.join("\n")}`,
  ).toEqual([]);
}
