import { z } from "zod";

const host = process.env["HOST"] ?? "127.0.0.1";
const port = Number(process.env["PORT"] ?? "4311");
const baseUrl = (process.env["STREAM_BURST_URL"] ?? `http://${host}:${String(port)}`).trim();
const apiToken = (
  process.env["STREAM_BURST_TOKEN"] ??
  process.env["APP_SMOKE_TOKEN"] ??
  process.env["API_TOKEN"] ??
  process.env["PUSH_API_TOKEN"] ??
  ""
).trim();

const budgetModeRaw = (process.env["STREAM_BURST_BUDGET_MODE"] ?? "fail").trim().toLowerCase();
if (budgetModeRaw !== "warn" && budgetModeRaw !== "fail") {
  throw new Error('STREAM_BURST_BUDGET_MODE must be "warn" or "fail" when set');
}
const budgetMode = budgetModeRaw;

function readPositiveIntegerEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (typeof rawValue === "undefined") {
    return defaultValue;
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    throw new Error(`${name} must be a positive integer when set`);
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer when set`);
  }
  return parsed;
}

const durationMs = readPositiveIntegerEnv("STREAM_BURST_DURATION_MS", 30_000);
const workerCount = readPositiveIntegerEnv("STREAM_BURST_WORKERS", 12);
const healthIntervalMs = readPositiveIntegerEnv("STREAM_BURST_HEALTH_INTERVAL_MS", 1_000);
const requestTimeoutMs = readPositiveIntegerEnv("STREAM_BURST_REQUEST_TIMEOUT_MS", 10_000);
const healthBudgetP95Ms = readPositiveIntegerEnv("STREAM_BURST_HEALTH_BUDGET_P95_MS", 3_000);
const streamEventsLimit = readPositiveIntegerEnv("STREAM_BURST_STREAM_LIMIT", 20);
const threadsLimit = readPositiveIntegerEnv("STREAM_BURST_THREADS_LIMIT", 40);
const threadSampleSize = readPositiveIntegerEnv("STREAM_BURST_THREAD_SAMPLE_SIZE", 8);
const streamRouteQueueDelayBudgetP95Ms = readPositiveIntegerEnv(
  "STREAM_BURST_STREAM_ROUTE_QUEUE_DELAY_BUDGET_P95_MS",
  2_000,
);
const streamRouteQueueDelayBudgetMaxMs = readPositiveIntegerEnv(
  "STREAM_BURST_STREAM_ROUTE_QUEUE_DELAY_BUDGET_MAX_MS",
  5_000,
);
const healthRouteQueueDelayBudgetP95Ms = readPositiveIntegerEnv(
  "STREAM_BURST_HEALTH_ROUTE_QUEUE_DELAY_BUDGET_P95_MS",
  1_000,
);
const healthRouteQueueDelayBudgetMaxMs = readPositiveIntegerEnv(
  "STREAM_BURST_HEALTH_ROUTE_QUEUE_DELAY_BUDGET_MAX_MS",
  3_000,
);
const observabilityRoutePath = "/api/debug/observability";
const getMethodName = "GET";
const streamEventsRoutePath = "/api/threads/:threadId/stream-events";
const healthRoutePath = "/api/health";

const ThreadsResponseSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z.object({
        id: z.string().min(1),
      }),
    ),
    nextCursor: z.string().nullable(),
    pages: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })
  .strict();

const HealthResponseSchema = z
  .object({
    ok: z.literal(true),
    state: z
      .object({
        appReady: z.boolean(),
        ipcConnected: z.boolean(),
        ipcInitialized: z.boolean(),
      })
      .passthrough(),
  })
  .strict();

const StreamEventsResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
    ownerClientId: z.string().nullable(),
    events: z.array(z.unknown()),
    nextSequence: z.number().int().nonnegative(),
    firstAvailableSequence: z.number().int().nonnegative(),
    resetRequired: z.boolean(),
  })
  .strict();

const RouteTimingSummarySchema = z.object({
  route: z.string().min(1),
  method: z.string().min(1),
  p95DurationMs: z.number().nonnegative(),
  p95QueueDelayMs: z.number().nonnegative(),
  maxQueueDelayMs: z.number().nonnegative(),
});

const DebugObservabilityResponseSchema = z.object({
  ok: z.literal(true),
  snapshot: z.object({
    performance: z.object({
      requestRouting: z.object({
        routeTimings: z.array(RouteTimingSummarySchema),
      }),
    }),
  }),
});

const headers = new Headers();
if (apiToken.length > 0) {
  headers.set("X-Farfield-Token", apiToken);
}

let hasFailure = false;
let warningCount = 0;
let streamRequestCount = 0;
let streamFailureCount = 0;
let healthProbeCount = 0;
let healthFailureCount = 0;
let healthNotReadyCount = 0;
const healthLatenciesMs = [];

function report(level, label, detail) {
  process.stdout.write(`${level}  ${label}: ${detail}\n`);
}

function pass(label, detail) {
  report("PASS", label, detail);
}

function fail(label, detail) {
  hasFailure = true;
  report("FAIL", label, detail);
}

function warn(label, detail) {
  warningCount += 1;
  report("WARN", label, detail);
}

function reportBudget(label, detail) {
  if (budgetMode === "fail") {
    fail(label, detail);
    return;
  }
  warn(label, detail);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function findRouteTiming(routeTimings, method, route) {
  return (
    routeTimings.find(
      (routeTiming) =>
        routeTiming.method.toUpperCase() === method.toUpperCase() && routeTiming.route === route,
    ) ?? null
  );
}

async function fetchJson(pathname, schema, label) {
  const url = new URL(pathname, baseUrl);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);
  const startedAtMs = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${String(response.status)} ${url.toString()}`);
    }
    const raw = await response.json();
    const parsed = schema.parse(raw);
    const elapsedMs = Date.now() - startedAtMs;
    return { parsed, elapsedMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} request failed: ${message}`);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function pickThreadIds(threads) {
  if (threads.length <= threadSampleSize) {
    return threads.map((thread) => thread.id);
  }
  return threads.slice(0, threadSampleSize).map((thread) => thread.id);
}

async function runStreamWorker(workerIndex, threadIds, stopAtMs) {
  let iteration = 0;
  while (Date.now() < stopAtMs) {
    const threadId = threadIds[(workerIndex + iteration) % threadIds.length];
    iteration += 1;
    try {
      await fetchJson(
        `/api/threads/${encodeURIComponent(threadId)}/stream-events?limit=${String(streamEventsLimit)}`,
        StreamEventsResponseSchema,
        "stream-events",
      );
      streamRequestCount += 1;
    } catch (error) {
      streamFailureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      fail("Stream burst request", message);
      await sleep(25);
    }
  }
}

async function runHealthProbeLoop(stopAtMs) {
  while (Date.now() < stopAtMs) {
    try {
      const { parsed, elapsedMs } = await fetchJson("/api/health", HealthResponseSchema, "health");
      healthLatenciesMs.push(elapsedMs);
      healthProbeCount += 1;
      if (!parsed.state.appReady || !parsed.state.ipcConnected || !parsed.state.ipcInitialized) {
        healthNotReadyCount += 1;
      }
    } catch (error) {
      healthFailureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      fail("Health probe", message);
    }
    await sleep(healthIntervalMs);
  }
}

async function main() {
  pass(
    "Stream burst config",
    `url=${baseUrl} durationMs=${String(durationMs)} workers=${String(workerCount)}`,
  );

  const { parsed: threadsResponse } = await fetchJson(
    `/api/threads?limit=${String(threadsLimit)}&archived=false&all=false&maxPages=1`,
    ThreadsResponseSchema,
    "threads",
  );
  if (threadsResponse.data.length === 0) {
    fail("Stream burst setup", "No threads available from /api/threads");
    process.exitCode = 1;
    return;
  }

  const threadIds = pickThreadIds(threadsResponse.data);
  pass("Stream burst setup", `threads=${String(threadIds.length)} ids=${threadIds.join(", ")}`);

  const stopAtMs = Date.now() + durationMs;
  const healthProbeTask = runHealthProbeLoop(stopAtMs);
  const workerTasks = Array.from({ length: workerCount }, (_, index) =>
    runStreamWorker(index, threadIds, stopAtMs),
  );

  await Promise.all([...workerTasks, healthProbeTask]);

  if (healthFailureCount > 0) {
    fail("Health probe failures", String(healthFailureCount));
  }

  if (healthProbeCount === 0) {
    fail("Health probes", "No successful /api/health probes were recorded");
  }

  const healthP95Ms = percentile(healthLatenciesMs, 95);
  const healthMaxMs = healthLatenciesMs.length > 0 ? Math.max(...healthLatenciesMs) : 0;
  if (healthP95Ms > healthBudgetP95Ms) {
    const detail = `p95=${String(healthP95Ms)}ms max=${String(healthMaxMs)}ms budget=${String(healthBudgetP95Ms)}ms`;
    reportBudget("Health latency budget", detail);
  }

  let streamRouteQueueDelayP95Ms = 0;
  let streamRouteQueueDelayMaxMs = 0;
  let streamRouteLatencyP95Ms = 0;
  let healthRouteQueueDelayP95Ms = 0;
  let healthRouteQueueDelayMaxMs = 0;

  try {
    const { parsed: observabilityResponse } = await fetchJson(
      observabilityRoutePath,
      DebugObservabilityResponseSchema,
      "observability",
    );
    const routeTimings = observabilityResponse.snapshot.performance.requestRouting.routeTimings;
    const streamEventsRouteTiming = findRouteTiming(
      routeTimings,
      getMethodName,
      streamEventsRoutePath,
    );
    const healthRouteTiming = findRouteTiming(routeTimings, getMethodName, healthRoutePath);

    if (!streamEventsRouteTiming) {
      fail("Observability route timing", `Missing route timing for ${streamEventsRoutePath}`);
    } else {
      streamRouteQueueDelayP95Ms = streamEventsRouteTiming.p95QueueDelayMs;
      streamRouteQueueDelayMaxMs = streamEventsRouteTiming.maxQueueDelayMs;
      streamRouteLatencyP95Ms = streamEventsRouteTiming.p95DurationMs;
      if (streamEventsRouteTiming.p95QueueDelayMs > streamRouteQueueDelayBudgetP95Ms) {
        reportBudget(
          "Stream route queue-delay budget",
          `route=${streamEventsRoutePath} p95QueueDelay=${String(streamEventsRouteTiming.p95QueueDelayMs)}ms budget=${String(streamRouteQueueDelayBudgetP95Ms)}ms`,
        );
      }
      if (streamEventsRouteTiming.maxQueueDelayMs > streamRouteQueueDelayBudgetMaxMs) {
        reportBudget(
          "Stream route queue-delay max budget",
          `route=${streamEventsRoutePath} maxQueueDelay=${String(streamEventsRouteTiming.maxQueueDelayMs)}ms budget=${String(streamRouteQueueDelayBudgetMaxMs)}ms`,
        );
      }
    }

    if (!healthRouteTiming) {
      fail("Observability route timing", `Missing route timing for ${healthRoutePath}`);
    } else {
      healthRouteQueueDelayP95Ms = healthRouteTiming.p95QueueDelayMs;
      healthRouteQueueDelayMaxMs = healthRouteTiming.maxQueueDelayMs;
      if (healthRouteTiming.p95QueueDelayMs > healthRouteQueueDelayBudgetP95Ms) {
        reportBudget(
          "Health route queue-delay budget",
          `route=${healthRoutePath} p95QueueDelay=${String(healthRouteTiming.p95QueueDelayMs)}ms budget=${String(healthRouteQueueDelayBudgetP95Ms)}ms`,
        );
      }
      if (healthRouteTiming.maxQueueDelayMs > healthRouteQueueDelayBudgetMaxMs) {
        reportBudget(
          "Health route queue-delay max budget",
          `route=${healthRoutePath} maxQueueDelay=${String(healthRouteTiming.maxQueueDelayMs)}ms budget=${String(healthRouteQueueDelayBudgetMaxMs)}ms`,
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail("Observability route timing", message);
  }

  pass(
    "Stream burst summary",
    `streamRequests=${String(streamRequestCount)} streamFailures=${String(streamFailureCount)} healthProbes=${String(healthProbeCount)} healthFailures=${String(healthFailureCount)} healthNotReady=${String(healthNotReadyCount)} healthP95=${String(healthP95Ms)}ms healthMax=${String(healthMaxMs)}ms streamRouteP95=${String(streamRouteLatencyP95Ms)}ms streamRouteP95QueueDelay=${String(streamRouteQueueDelayP95Ms)}ms streamRouteMaxQueueDelay=${String(streamRouteQueueDelayMaxMs)}ms healthRouteP95QueueDelay=${String(healthRouteQueueDelayP95Ms)}ms healthRouteMaxQueueDelay=${String(healthRouteQueueDelayMaxMs)}ms`,
  );

  if (hasFailure) {
    process.exitCode = 1;
    process.stdout.write("\nStream burst detected runtime regressions.\n");
    return;
  }

  if (warningCount > 0) {
    process.stdout.write(`\nStream burst completed with ${String(warningCount)} warning(s).\n`);
    return;
  }

  process.stdout.write("\nStream burst completed successfully.\n");
}

void main();
