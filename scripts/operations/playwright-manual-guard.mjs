import {
  FarfieldDebugErrorListEnvelopeSchema,
  FarfieldDebugObservabilityEnvelopeSchema,
  FarfieldHealthResponseSchema,
} from "@farfield/protocol";
import { z } from "zod";

/**
 * Owns live runtime guardrails for manual Playwright MCP sessions.
 * It continuously surfaces newly recorded debug errors and request/lag budget regressions
 * so interactive debugging can fail fast with concrete diagnostics.
 */
const DEFAULT_API_HOST = "127.0.0.1";
const DEFAULT_API_PORT = "4321";
const DEFAULT_POLL_INTERVAL_MILLISECONDS = 2_000;
const DEFAULT_HTTP_TIMEOUT_MILLISECONDS = 5_000;
const DEFAULT_DEBUG_ERROR_LIMIT = 300;
const DEFAULT_ROUTE_LAST_DURATION_BUDGET_MILLISECONDS = 3_000;
const DEFAULT_ROUTE_LAST_QUEUE_DELAY_BUDGET_MILLISECONDS = 300;
const DEFAULT_EVENT_LOOP_LAST_LAG_BUDGET_MILLISECONDS = 80;
const DEFAULT_EVENT_LOOP_CONSECUTIVE_VIOLATION_LIMIT = 3;
const DEFAULT_ROUTE_BUDGET_CONSECUTIVE_VIOLATION_LIMIT = 2;
const DEFAULT_BUDGET_WARMUP_SECONDS = 8;
const DEFAULT_MAX_FETCH_FAILURES = 3;
const DEFAULT_BUDGET_MODE = "fail";
const DEFAULT_BASELINE_READINESS_TIMEOUT_MILLISECONDS = 30_000;
const DEFAULT_IGNORED_ROUTE_BUDGET_KEYS = Object.freeze([
  "GET /api/debug/client-errors",
  "GET /api/debug/observability",
]);
const MonitorRunModeByName = {
  finite: "finite",
  continuous: "continuous",
};

const RuntimeConfigurationSchema = z
  .object({
    baseUrl: z.string().url(),
    apiToken: z.string(),
    pollIntervalMilliseconds: z.number().int().positive(),
    httpTimeoutMilliseconds: z.number().int().positive(),
    debugErrorLimit: z.number().int().positive(),
    routeLastDurationBudgetMilliseconds: z.number().int().positive(),
    routeLastQueueDelayBudgetMilliseconds: z.number().int().nonnegative(),
    eventLoopLastLagBudgetMilliseconds: z.number().nonnegative(),
    eventLoopConsecutiveViolationLimit: z.number().int().positive(),
    routeBudgetConsecutiveViolationLimit: z.number().int().positive(),
    ignoredRouteBudgetKeys: z.array(z.string().min(1)),
    allowedDebugErrorMessageSubstrings: z.array(z.string().min(1)),
    allowedDebugErrorOperations: z.array(z.string().min(1)),
    budgetWarmupSeconds: z.number().int().nonnegative(),
    maxFetchFailures: z.number().int().positive(),
    budgetMode: z.enum(["fail", "warn"]),
    baselineReadinessTimeoutMilliseconds: z.number().int().positive(),
    runMode: z.enum([MonitorRunModeByName.finite, MonitorRunModeByName.continuous]),
    runDurationSeconds: z.number().int().positive().nullable(),
  })
  .strict();

const RuntimeSummarySchema = z
  .object({
    baselineDebugErrorCount: z.number().int().nonnegative(),
    newDebugErrorCount: z.number().int().nonnegative(),
    allowedDebugErrorCount: z.number().int().nonnegative(),
    newDebugWarningCount: z.number().int().nonnegative(),
    baselineRequestErrorCount: z.number().int().nonnegative(),
    newRequestErrorCount: z.number().int().nonnegative(),
    budgetViolationCount: z.number().int().nonnegative(),
  })
  .strict();

function parseIntegerEnvironmentVariable(name, defaultValue) {
  const rawValue = process.env[name];
  if (typeof rawValue === "undefined") {
    return defaultValue;
  }
  const parsedValue = Number(rawValue.trim());
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${name} must be a non-negative integer when set`);
  }
  return parsedValue;
}

function parsePositiveIntegerEnvironmentVariable(name, defaultValue) {
  const rawValue = process.env[name];
  if (typeof rawValue === "undefined") {
    return defaultValue;
  }
  const parsedValue = Number(rawValue.trim());
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer when set`);
  }
  return parsedValue;
}

function parseCsvEnvironmentVariable(name, defaultValues) {
  const rawValue = process.env[name];
  if (typeof rawValue === "undefined") {
    return defaultValues;
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function readRuntimeConfiguration() {
  const host = (process.env["HOST"] ?? DEFAULT_API_HOST).trim();
  const port = (process.env["PORT"] ?? DEFAULT_API_PORT).trim();
  const baseUrlRaw =
    process.env["E2E_REAL_API_URL"] ?? process.env["APP_SMOKE_URL"] ?? `http://${host}:${port}`;
  const apiToken =
    process.env["PLAYWRIGHT_MANUAL_GUARD_TOKEN"] ??
    process.env["API_TOKEN"] ??
    process.env["APP_SMOKE_TOKEN"] ??
    process.env["PUSH_API_TOKEN"] ??
    "";
  const pollIntervalMilliseconds = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_POLL_MS",
    DEFAULT_POLL_INTERVAL_MILLISECONDS,
  );
  const httpTimeoutMilliseconds = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_HTTP_TIMEOUT_MS",
    DEFAULT_HTTP_TIMEOUT_MILLISECONDS,
  );
  const debugErrorLimit = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_ERROR_LIMIT",
    DEFAULT_DEBUG_ERROR_LIMIT,
  );
  const routeLastDurationBudgetMilliseconds = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_ROUTE_LAST_DURATION_MS",
    DEFAULT_ROUTE_LAST_DURATION_BUDGET_MILLISECONDS,
  );
  const routeLastQueueDelayBudgetMilliseconds = parseIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_ROUTE_LAST_QUEUE_DELAY_MS",
    DEFAULT_ROUTE_LAST_QUEUE_DELAY_BUDGET_MILLISECONDS,
  );
  const eventLoopLastLagBudgetMilliseconds = parseIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_EVENT_LOOP_LAST_LAG_MS",
    DEFAULT_EVENT_LOOP_LAST_LAG_BUDGET_MILLISECONDS,
  );
  const eventLoopConsecutiveViolationLimit = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_EVENT_LOOP_CONSECUTIVE_LIMIT",
    DEFAULT_EVENT_LOOP_CONSECUTIVE_VIOLATION_LIMIT,
  );
  const routeBudgetConsecutiveViolationLimit = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_ROUTE_BUDGET_CONSECUTIVE_LIMIT",
    DEFAULT_ROUTE_BUDGET_CONSECUTIVE_VIOLATION_LIMIT,
  );
  const ignoredRouteBudgetKeys = parseCsvEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_IGNORE_ROUTE_BUDGET_KEYS",
    [...DEFAULT_IGNORED_ROUTE_BUDGET_KEYS],
  );
  const allowedDebugErrorMessageSubstrings = parseCsvEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_ALLOW_DEBUG_ERROR_MESSAGE_SUBSTRINGS",
    [],
  );
  const allowedDebugErrorOperations = parseCsvEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_ALLOW_DEBUG_ERROR_OPERATIONS",
    [],
  );
  const budgetWarmupSeconds = parseIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_BUDGET_WARMUP_SECONDS",
    DEFAULT_BUDGET_WARMUP_SECONDS,
  );
  const maxFetchFailures = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_MAX_FETCH_FAILURES",
    DEFAULT_MAX_FETCH_FAILURES,
  );
  const budgetModeRaw = (process.env["PLAYWRIGHT_MANUAL_GUARD_BUDGET_MODE"] ?? DEFAULT_BUDGET_MODE)
    .trim()
    .toLowerCase();
  const baselineReadinessTimeoutMilliseconds = parsePositiveIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_BASELINE_READINESS_TIMEOUT_MS",
    DEFAULT_BASELINE_READINESS_TIMEOUT_MILLISECONDS,
  );
  const runDurationSecondsRaw = parseIntegerEnvironmentVariable(
    "PLAYWRIGHT_MANUAL_GUARD_DURATION_SECONDS",
    0,
  );

  return RuntimeConfigurationSchema.parse({
    baseUrl: baseUrlRaw.trim(),
    apiToken: apiToken.trim(),
    pollIntervalMilliseconds,
    httpTimeoutMilliseconds,
    debugErrorLimit,
    routeLastDurationBudgetMilliseconds,
    routeLastQueueDelayBudgetMilliseconds,
    eventLoopLastLagBudgetMilliseconds,
    eventLoopConsecutiveViolationLimit,
    routeBudgetConsecutiveViolationLimit,
    ignoredRouteBudgetKeys,
    allowedDebugErrorMessageSubstrings,
    allowedDebugErrorOperations,
    budgetWarmupSeconds,
    maxFetchFailures,
    budgetMode: budgetModeRaw,
    baselineReadinessTimeoutMilliseconds,
    runMode:
      runDurationSecondsRaw === 0 ? MonitorRunModeByName.continuous : MonitorRunModeByName.finite,
    runDurationSeconds: runDurationSecondsRaw === 0 ? null : runDurationSecondsRaw,
  });
}

async function readJsonFromApi(input) {
  const { baseUrl, pathname, apiToken, timeoutMilliseconds } = input;
  const headers = new Headers();
  if (apiToken.length > 0) {
    headers.set("X-Farfield-Token", apiToken);
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMilliseconds);

  try {
    const response = await fetch(new URL(pathname, baseUrl), {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GET ${pathname} failed with HTTP ${String(response.status)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function readDebugErrorEnvelope(configuration) {
  return FarfieldDebugErrorListEnvelopeSchema.parse(
    await readJsonFromApi({
      baseUrl: configuration.baseUrl,
      pathname: `/api/debug/client-errors?limit=${String(configuration.debugErrorLimit)}`,
      apiToken: configuration.apiToken,
      timeoutMilliseconds: configuration.httpTimeoutMilliseconds,
    }),
  );
}

async function readObservabilityEnvelope(configuration) {
  return FarfieldDebugObservabilityEnvelopeSchema.parse(
    await readJsonFromApi({
      baseUrl: configuration.baseUrl,
      pathname: "/api/debug/observability",
      apiToken: configuration.apiToken,
      timeoutMilliseconds: configuration.httpTimeoutMilliseconds,
    }),
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForBaselineRuntimeReadiness(configuration) {
  const startedAtMilliseconds = Date.now();
  let lastReason = "runtime readiness not yet satisfied";

  while (Date.now() - startedAtMilliseconds < configuration.baselineReadinessTimeoutMilliseconds) {
    try {
      const healthResponse = FarfieldHealthResponseSchema.parse(
        await readJsonFromApi({
          baseUrl: configuration.baseUrl,
          pathname: "/api/health",
          apiToken: configuration.apiToken,
          timeoutMilliseconds: configuration.httpTimeoutMilliseconds,
        }),
      );
      const isReady =
        healthResponse.state.appReady &&
        healthResponse.state.ipcConnected &&
        healthResponse.state.ipcInitialized;
      if (isReady) {
        return;
      }
      lastReason = `appReady=${String(healthResponse.state.appReady)} ipcConnected=${String(
        healthResponse.state.ipcConnected,
      )} ipcInitialized=${String(healthResponse.state.ipcInitialized)}`;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }

    await sleep(configuration.pollIntervalMilliseconds);
  }

  throw new Error(
    `baseline readiness timed out after ${String(configuration.baselineReadinessTimeoutMilliseconds)}ms: ${lastReason}`,
  );
}

async function readSnapshotPairWithRetry(configuration, label) {
  for (let attemptIndex = 0; attemptIndex < configuration.maxFetchFailures; attemptIndex += 1) {
    try {
      const [debugErrors, observability] = await Promise.all([
        readDebugErrorEnvelope(configuration),
        readObservabilityEnvelope(configuration),
      ]);
      return { debugErrors, observability };
    } catch (error) {
      const attemptNumber = attemptIndex + 1;
      const message = error instanceof Error ? error.message : String(error);
      if (attemptNumber >= configuration.maxFetchFailures) {
        throw new Error(
          `${label} failed after ${String(configuration.maxFetchFailures)} attempts: ${message}`,
        );
      }
      process.stdout.write(
        `WARN  ${label} read failed (attempt ${String(attemptNumber)}/${String(
          configuration.maxFetchFailures,
        )}): ${message}\n`,
      );
      await sleep(configuration.pollIntervalMilliseconds);
    }
  }

  throw new Error(`${label} failed with unknown error`);
}

function routeKey(input) {
  return `${input.method} ${input.route}`;
}

function nowIsoString() {
  return new Date().toISOString();
}

function toDurationString(inputMilliseconds) {
  const seconds = Math.floor(inputMilliseconds / 1_000);
  const milliseconds = inputMilliseconds % 1_000;
  return `${String(seconds)}.${String(milliseconds).padStart(3, "0")}s`;
}

function reportBudgetResult(input) {
  const detail = `${input.label} observed=${String(input.observed)} budget=${String(input.budget)}`;
  if (input.mode === "fail") {
    process.stdout.write(`FAIL  ${detail}\n`);
    return { failed: true, warned: false };
  }
  process.stdout.write(`WARN  ${detail}\n`);
  return { failed: false, warned: true };
}

function shouldAllowDebugError(configuration, errorEvent) {
  if (
    configuration.allowedDebugErrorOperations.length > 0 &&
    configuration.allowedDebugErrorOperations.includes(errorEvent.operation)
  ) {
    return true;
  }

  return configuration.allowedDebugErrorMessageSubstrings.some((substring) =>
    errorEvent.message.includes(substring),
  );
}

function updateConsecutiveViolationCount(violationCountByKey, key, isViolation) {
  if (!isViolation) {
    violationCountByKey.set(key, 0);
    return 0;
  }

  const nextViolationCount = (violationCountByKey.get(key) ?? 0) + 1;
  violationCountByKey.set(key, nextViolationCount);
  return nextViolationCount;
}

async function main() {
  const configuration = readRuntimeConfiguration();
  process.stdout.write("Playwright manual guard started\n");
  process.stdout.write(`API base URL: ${configuration.baseUrl}\n`);
  process.stdout.write(
    `Run mode: ${configuration.runMode === MonitorRunModeByName.continuous ? "continuous" : `${String(configuration.runDurationSeconds)}s`}\n`,
  );
  process.stdout.write(`Budget warmup: ${String(configuration.budgetWarmupSeconds)}s\n`);
  process.stdout.write(`Max fetch failures: ${String(configuration.maxFetchFailures)}\n`);
  process.stdout.write(
    `Baseline readiness timeout: ${String(configuration.baselineReadinessTimeoutMilliseconds)}ms\n`,
  );

  await waitForBaselineRuntimeReadiness(configuration);

  const baselineSnapshotPair = await readSnapshotPairWithRetry(configuration, "baseline");
  const baselineDebugErrors = baselineSnapshotPair.debugErrors;
  const baselineObservability = baselineSnapshotPair.observability;

  const seenErrorIds = new Set(baselineDebugErrors.data.map((errorEvent) => errorEvent.errorId));
  const routeRequestCountByKey = new Map(
    baselineObservability.snapshot.performance.requestRouting.routeTimings.map((routeTiming) => [
      routeKey(routeTiming),
      routeTiming.requestCount,
    ]),
  );

  const baselineRequestErrorCount =
    baselineObservability.snapshot.performance.requestRouting.totalErrorCount;
  const baselineEventLoopSampleCount =
    baselineObservability.snapshot.performance.eventLoop.sampleCount;
  let lastObservedEventLoopSampleCount = baselineEventLoopSampleCount;

  process.stdout.write(
    `Baseline: debugErrors=${String(baselineDebugErrors.data.length)} requestErrors=${String(
      baselineRequestErrorCount,
    )} eventLoopSamples=${String(baselineEventLoopSampleCount)}\n`,
  );
  process.stdout.write(`Session log: ${baselineDebugErrors.sessionLogPath}\n`);

  const startedAtMilliseconds = Date.now();
  let monitoringCancelled = false;
  process.on("SIGINT", () => {
    monitoringCancelled = true;
  });

  let newDebugErrorCount = 0;
  let allowedDebugErrorCount = 0;
  let newDebugWarningCount = 0;
  let newRequestErrorCount = 0;
  let budgetViolationCount = 0;
  let consecutiveFetchFailures = 0;
  let consecutiveEventLoopLagViolationCount = 0;
  const routeDurationViolationCountByKey = new Map();
  const routeQueueDelayViolationCountByKey = new Map();
  let hasFailure = false;

  while (!monitoringCancelled) {
    if (configuration.runMode === MonitorRunModeByName.finite) {
      const elapsedMilliseconds = Date.now() - startedAtMilliseconds;
      const maxDurationMilliseconds = (configuration.runDurationSeconds ?? 0) * 1_000;
      if (elapsedMilliseconds >= maxDurationMilliseconds) {
        break;
      }
    }

    await sleep(configuration.pollIntervalMilliseconds);

    let debugErrors;
    let observability;
    try {
      const snapshotPair = await readSnapshotPairWithRetry(configuration, "poll");
      debugErrors = snapshotPair.debugErrors;
      observability = snapshotPair.observability;
      consecutiveFetchFailures = 0;
    } catch (error) {
      consecutiveFetchFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(
        `WARN  poll read failure count=${String(consecutiveFetchFailures)} message=${message}\n`,
      );
      if (consecutiveFetchFailures >= configuration.maxFetchFailures) {
        hasFailure = true;
        process.stdout.write(
          `FAIL  poll reads failed ${String(consecutiveFetchFailures)} consecutive times\n`,
        );
        break;
      }
      continue;
    }
    const elapsedMilliseconds = Date.now() - startedAtMilliseconds;
    const isPastBudgetWarmup = elapsedMilliseconds >= configuration.budgetWarmupSeconds * 1_000;

    for (const errorEvent of debugErrors.data) {
      if (seenErrorIds.has(errorEvent.errorId)) {
        continue;
      }
      seenErrorIds.add(errorEvent.errorId);
      if (errorEvent.severity === "error") {
        if (shouldAllowDebugError(configuration, errorEvent)) {
          allowedDebugErrorCount += 1;
          process.stdout.write(
            `INFO  allowed debug error ${errorEvent.errorId} origin=${errorEvent.origin} source=${errorEvent.source} operation=${errorEvent.operation} message=${errorEvent.message}\n`,
          );
          continue;
        }
        newDebugErrorCount += 1;
        hasFailure = true;
        process.stdout.write(
          `FAIL  unexpected debug error ${errorEvent.errorId} origin=${errorEvent.origin} source=${errorEvent.source} operation=${errorEvent.operation} message=${errorEvent.message}\n`,
        );
        continue;
      }
      newDebugWarningCount += 1;
      process.stdout.write(
        `WARN  unexpected debug warning ${errorEvent.errorId} origin=${errorEvent.origin} source=${errorEvent.source} operation=${errorEvent.operation} message=${errorEvent.message}\n`,
      );
    }

    const requestErrorCount = observability.snapshot.performance.requestRouting.totalErrorCount;
    if (requestErrorCount > baselineRequestErrorCount + newRequestErrorCount) {
      const delta = requestErrorCount - baselineRequestErrorCount - newRequestErrorCount;
      newRequestErrorCount += delta;
      hasFailure = true;
      process.stdout.write(
        `FAIL  request error count increased by ${String(delta)} (baseline=${String(
          baselineRequestErrorCount,
        )} now=${String(requestErrorCount)})\n`,
      );
    }

    const currentEventLoop = observability.snapshot.performance.eventLoop;
    if (isPastBudgetWarmup) {
      if (
        currentEventLoop.sampleCount > lastObservedEventLoopSampleCount &&
        currentEventLoop.lastLagMs > configuration.eventLoopLastLagBudgetMilliseconds
      ) {
        consecutiveEventLoopLagViolationCount += 1;
        if (
          consecutiveEventLoopLagViolationCount >= configuration.eventLoopConsecutiveViolationLimit
        ) {
          const budgetResult = reportBudgetResult({
            mode: configuration.budgetMode,
            label: "event-loop last lag",
            observed: currentEventLoop.lastLagMs,
            budget: configuration.eventLoopLastLagBudgetMilliseconds,
          });
          if (budgetResult.failed) {
            hasFailure = true;
            budgetViolationCount += 1;
          }
          if (budgetResult.warned) {
            budgetViolationCount += 1;
          }
        } else {
          process.stdout.write(
            `WARN  event-loop last lag streak ${String(consecutiveEventLoopLagViolationCount)}/${String(
              configuration.eventLoopConsecutiveViolationLimit,
            )} observed=${String(currentEventLoop.lastLagMs)} budget=${String(configuration.eventLoopLastLagBudgetMilliseconds)}\n`,
          );
        }
      } else if (currentEventLoop.sampleCount > lastObservedEventLoopSampleCount) {
        consecutiveEventLoopLagViolationCount = 0;
      }
    }
    lastObservedEventLoopSampleCount = currentEventLoop.sampleCount;

    for (const routeTiming of observability.snapshot.performance.requestRouting.routeTimings) {
      const key = routeKey(routeTiming);
      const previousRequestCount = routeRequestCountByKey.get(key) ?? 0;
      routeRequestCountByKey.set(key, routeTiming.requestCount);
      if (routeTiming.requestCount <= previousRequestCount) {
        continue;
      }
      if (!isPastBudgetWarmup) {
        continue;
      }
      if (configuration.ignoredRouteBudgetKeys.includes(key)) {
        continue;
      }

      const durationViolationCount = updateConsecutiveViolationCount(
        routeDurationViolationCountByKey,
        key,
        routeTiming.lastDurationMs > configuration.routeLastDurationBudgetMilliseconds,
      );
      if (durationViolationCount >= configuration.routeBudgetConsecutiveViolationLimit) {
        const budgetResult = reportBudgetResult({
          mode: configuration.budgetMode,
          label: `${key} last duration`,
          observed: routeTiming.lastDurationMs,
          budget: configuration.routeLastDurationBudgetMilliseconds,
        });
        if (budgetResult.failed) {
          hasFailure = true;
          budgetViolationCount += 1;
        }
        if (budgetResult.warned) {
          budgetViolationCount += 1;
        }
      } else if (durationViolationCount > 0) {
        process.stdout.write(
          `WARN  ${key} last duration streak ${String(durationViolationCount)}/${String(
            configuration.routeBudgetConsecutiveViolationLimit,
          )} observed=${String(routeTiming.lastDurationMs)} budget=${String(configuration.routeLastDurationBudgetMilliseconds)}\n`,
        );
      }

      const queueDelayViolationCount = updateConsecutiveViolationCount(
        routeQueueDelayViolationCountByKey,
        key,
        routeTiming.lastQueueDelayMs > configuration.routeLastQueueDelayBudgetMilliseconds,
      );
      if (queueDelayViolationCount >= configuration.routeBudgetConsecutiveViolationLimit) {
        const budgetResult = reportBudgetResult({
          mode: configuration.budgetMode,
          label: `${key} last queue-delay`,
          observed: routeTiming.lastQueueDelayMs,
          budget: configuration.routeLastQueueDelayBudgetMilliseconds,
        });
        if (budgetResult.failed) {
          hasFailure = true;
          budgetViolationCount += 1;
        }
        if (budgetResult.warned) {
          budgetViolationCount += 1;
        }
      } else if (queueDelayViolationCount > 0) {
        process.stdout.write(
          `WARN  ${key} last queue-delay streak ${String(queueDelayViolationCount)}/${String(
            configuration.routeBudgetConsecutiveViolationLimit,
          )} observed=${String(routeTiming.lastQueueDelayMs)} budget=${String(configuration.routeLastQueueDelayBudgetMilliseconds)}\n`,
        );
      }
    }

    process.stdout.write(
      `INFO  ${nowIsoString()} elapsed=${toDurationString(
        elapsedMilliseconds,
      )} debugErrors=${String(newDebugErrorCount)} debugWarnings=${String(
        newDebugWarningCount,
      )} requestErrors=${String(newRequestErrorCount)} budgetViolations=${String(
        budgetViolationCount,
      )} warmupActive=${String(!isPastBudgetWarmup)}\n`,
    );
  }

  const summary = RuntimeSummarySchema.parse({
    baselineDebugErrorCount: baselineDebugErrors.data.length,
    newDebugErrorCount,
    allowedDebugErrorCount,
    newDebugWarningCount,
    baselineRequestErrorCount,
    newRequestErrorCount,
    budgetViolationCount,
  });

  process.stdout.write("\nPlaywright manual guard summary\n");
  process.stdout.write(`baseline debug errors: ${String(summary.baselineDebugErrorCount)}\n`);
  process.stdout.write(`new debug errors: ${String(summary.newDebugErrorCount)}\n`);
  process.stdout.write(`allowed debug errors: ${String(summary.allowedDebugErrorCount)}\n`);
  process.stdout.write(`new debug warnings: ${String(summary.newDebugWarningCount)}\n`);
  process.stdout.write(`baseline request errors: ${String(summary.baselineRequestErrorCount)}\n`);
  process.stdout.write(`new request errors: ${String(summary.newRequestErrorCount)}\n`);
  process.stdout.write(`budget violations: ${String(summary.budgetViolationCount)}\n`);

  if (hasFailure) {
    process.exitCode = 1;
    process.stdout.write("Manual guard detected blocking issues.\n");
    return;
  }

  process.stdout.write("Manual guard completed with no blocking issues.\n");
}

void main();
