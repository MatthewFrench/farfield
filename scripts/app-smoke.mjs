import { z } from "zod";

const host = process.env["HOST"] ?? "127.0.0.1";
const port = Number(process.env["PORT"] ?? "4311");
const baseUrl = (process.env["APP_SMOKE_URL"] ?? `http://${host}:${String(port)}`).trim();
const apiToken = (
  process.env["APP_SMOKE_TOKEN"] ??
  process.env["API_TOKEN"] ??
  process.env["PUSH_API_TOKEN"] ??
  ""
).trim();
const requestTimeoutRaw = Number(process.env["APP_SMOKE_TIMEOUT_MS"] ?? "120000");
const requestTimeoutMs =
  Number.isFinite(requestTimeoutRaw) && requestTimeoutRaw > 0 ? requestTimeoutRaw : 120000;
const retryCountRaw = Number(process.env["APP_SMOKE_RETRIES"] ?? "2");
const retryCount = Number.isFinite(retryCountRaw) && retryCountRaw >= 0 ? Math.floor(retryCountRaw) : 2;
const latencyBudgetModeRaw = (process.env["APP_SMOKE_BUDGET_MODE"] ?? "fail").trim().toLowerCase();
if (latencyBudgetModeRaw !== "warn" && latencyBudgetModeRaw !== "fail") {
  throw new Error('APP_SMOKE_BUDGET_MODE must be "warn" or "fail" when set');
}
const latencyBudgetMode = latencyBudgetModeRaw;

const LABEL_HEALTH = "Runtime /api/health";
const LABEL_THREADS = "Runtime /api/threads";
const LABEL_MODELS = "Runtime /api/models";
const LABEL_COLLABORATION_MODES = "Runtime /api/collaboration-modes";
const LABEL_DEBUG_HISTORY = "Runtime /api/debug/history";
const LABEL_DEBUG_TRACE_STATUS = "Runtime /api/debug/trace/status";
const LABEL_THREAD_LIVE_STATE = "Runtime /api/threads/:id/live-state";
const LABEL_THREAD_STREAM_EVENTS = "Runtime /api/threads/:id/stream-events";

const HealthStateSchema = z
  .object({
    appReady: z.boolean(),
    ipcConnected: z.boolean(),
    ipcInitialized: z.boolean(),
    historyCount: z.number().int().nonnegative(),
    threadOwnerCount: z.number().int().nonnegative(),
    codexAvailable: z.boolean().optional(),
    gitCommit: z.union([z.string(), z.null()]).optional(),
    lastError: z.union([z.string(), z.null()]).optional(),
    activeTrace: z.unknown().optional()
  })
  .passthrough();

const ThreadListResponseSchema = z
  .object({
    data: z.array(
      z.object({
        id: z.string().min(1)
      })
    )
  })
  .passthrough();

const HealthResponseSchema = z
  .object({
    ok: z.literal(true),
    state: HealthStateSchema
  })
  .passthrough();

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

const defaultLatencyBudgetMs = readPositiveIntegerEnv("APP_SMOKE_BUDGET_DEFAULT_MS", 10_000);
const latencyBudgetByLabel = new Map([
  [LABEL_HEALTH, readPositiveIntegerEnv("APP_SMOKE_BUDGET_HEALTH_MS", 5_000)],
  [LABEL_THREADS, readPositiveIntegerEnv("APP_SMOKE_BUDGET_THREADS_MS", defaultLatencyBudgetMs)],
  [LABEL_MODELS, readPositiveIntegerEnv("APP_SMOKE_BUDGET_MODELS_MS", defaultLatencyBudgetMs)],
  [
    LABEL_COLLABORATION_MODES,
    readPositiveIntegerEnv("APP_SMOKE_BUDGET_COLLAB_MODES_MS", defaultLatencyBudgetMs)
  ],
  [LABEL_DEBUG_HISTORY, readPositiveIntegerEnv("APP_SMOKE_BUDGET_DEBUG_HISTORY_MS", defaultLatencyBudgetMs)],
  [
    LABEL_DEBUG_TRACE_STATUS,
    readPositiveIntegerEnv("APP_SMOKE_BUDGET_DEBUG_TRACE_STATUS_MS", defaultLatencyBudgetMs)
  ],
  [LABEL_THREAD_LIVE_STATE, readPositiveIntegerEnv("APP_SMOKE_BUDGET_THREAD_LIVE_STATE_MS", defaultLatencyBudgetMs)],
  [
    LABEL_THREAD_STREAM_EVENTS,
    readPositiveIntegerEnv("APP_SMOKE_BUDGET_THREAD_STREAM_EVENTS_MS", defaultLatencyBudgetMs)
  ]
]);

let hasFailure = false;
let warningCount = 0;

function check(label, pass, detail) {
  const marker = pass ? "PASS" : "FAIL";
  process.stdout.write(`${marker}  ${label}: ${detail}\n`);
  if (!pass) {
    hasFailure = true;
  }
}

function warn(label, detail) {
  process.stdout.write(`WARN  ${label}: ${detail}\n`);
  warningCount += 1;
}

function checkLatencyBudget(label, elapsedMs) {
  const budgetMs = latencyBudgetByLabel.get(label) ?? defaultLatencyBudgetMs;
  if (elapsedMs <= budgetMs) {
    return;
  }
  const detail = `${String(elapsedMs)}ms > budget ${String(budgetMs)}ms`;
  if (latencyBudgetMode === "fail") {
    check(`${label} latency`, false, detail);
    return;
  }
  warn(`${label} latency`, detail);
}

async function getJson(pathname, label) {
  const headers = new Headers();
  if (apiToken.length > 0) {
    headers.set("X-Farfield-Token", apiToken);
  }
  const url = new URL(pathname, baseUrl);
  const maxAttempts = retryCount + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, requestTimeoutMs);

    try {
      const attemptStartedAtMs = Date.now();
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal
      });
      if (!response.ok) {
        const elapsedMs = Date.now() - attemptStartedAtMs;
        const detail = `HTTP ${String(response.status)} ${url.toString()} (${String(elapsedMs)}ms)`;
        if (response.status >= 500 && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
          continue;
        }
        check(label, false, detail);
        return null;
      }
      const parsed = await response.json();
      if (!parsed || typeof parsed !== "object" || parsed.ok !== true) {
        check(label, false, `Unexpected JSON shape from ${url.toString()}`);
        return null;
      }
      const elapsedMs = Date.now() - attemptStartedAtMs;
      const attemptSuffix = attempt > 1 ? ` (attempt ${String(attempt)}/${String(maxAttempts)})` : "";
      check(label, true, `${url.toString()}${attemptSuffix} (${String(elapsedMs)}ms)`);
      checkLatencyBudget(label, elapsedMs);
      return parsed;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        continue;
      }
      check(label, false, `${detail} (${pathname})`);
      return null;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  check(label, false, `Unknown failure (${pathname})`);
  return null;
}

async function main() {
  const health = await getJson("/api/health", LABEL_HEALTH);
  const threads = await getJson(
    "/api/threads?limit=80&archived=0&all=0&maxPages=1",
    LABEL_THREADS
  );
  await getJson("/api/models?limit=200", LABEL_MODELS);
  await getJson("/api/collaboration-modes", LABEL_COLLABORATION_MODES);
  await getJson("/api/debug/history?limit=20", LABEL_DEBUG_HISTORY);
  await getJson("/api/debug/trace/status", LABEL_DEBUG_TRACE_STATUS);

  const threadListResult = ThreadListResponseSchema.safeParse(threads);
  const threadId = threadListResult.success ? (threadListResult.data.data[0]?.id ?? null) : null;

  if (threadId) {
    await getJson(
      `/api/threads/${encodeURIComponent(threadId)}/live-state`,
      LABEL_THREAD_LIVE_STATE
    );
    await getJson(
      `/api/threads/${encodeURIComponent(threadId)}/stream-events?limit=20`,
      LABEL_THREAD_STREAM_EVENTS
    );
  } else {
    check("Runtime thread detail checks", true, "Skipped (no threads returned)");
  }

  const healthResult = HealthResponseSchema.safeParse(health);
  if (!healthResult.success) {
    check("Health state shape", false, "state missing or invalid");
  } else {
    const state = healthResult.data.state;
    check("Health state shape", true, "state present");
    check("Health appReady", state.appReady, String(state.appReady));
    check("Health ipcConnected", state.ipcConnected, String(state.ipcConnected));
    check("Health ipcInitialized", state.ipcInitialized, String(state.ipcInitialized));
    check("Health historyCount", state.historyCount >= 0, String(state.historyCount));
    check("Health threadOwnerCount", state.threadOwnerCount >= 0, String(state.threadOwnerCount));
  }

  if (hasFailure) {
    process.exitCode = 1;
    process.stdout.write("\nApp smoke check found failures.\n");
    return;
  }
  if (warningCount > 0) {
    process.stdout.write(`\nApp smoke check passed with ${String(warningCount)} warning(s).\n`);
    return;
  }
  process.stdout.write("\nApp smoke check passed.\n");
}

void main();
