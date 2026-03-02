#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { FarfieldHealthResponseSchema } from "@farfield/protocol";
import { z } from "zod";

const StressRuntimeConfigurationSchema = z
  .object({
    guardDurationSeconds: z.number().int().positive(),
    safeRunPerformanceBudgetMode: z.enum(["fail", "warn"]),
    apiBaseUrl: z.string().url(),
    apiToken: z.string(),
    readinessTimeoutMilliseconds: z.number().int().positive(),
    readinessPollIntervalMilliseconds: z.number().int().positive(),
  })
  .strict();

const DEFAULT_GUARD_DURATION_SECONDS = 120;
const PROCESS_TERMINATION_GRACE_MILLISECONDS = 10_000;
const PROCESS_FORCE_TERMINATION_GRACE_MILLISECONDS = 5_000;
const DEFAULT_SAFE_RUN_PERFORMANCE_BUDGET_MODE = "warn";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:4311";
const DEFAULT_READINESS_TIMEOUT_MILLISECONDS = 30_000;
const DEFAULT_READINESS_POLL_INTERVAL_MILLISECONDS = 1_000;

function readStressRuntimeConfiguration() {
  const durationSecondsRaw = process.env["CI_STRESS_GUARD_DURATION_SECONDS"]?.trim() ?? "";
  const parsedDurationSeconds =
    durationSecondsRaw.length === 0 ? DEFAULT_GUARD_DURATION_SECONDS : Number(durationSecondsRaw);
  const safeRunPerformanceBudgetMode =
    process.env["CI_STRESS_SAFE_RUN_PERFORMANCE_BUDGET_MODE"]?.trim().toLowerCase() ??
    DEFAULT_SAFE_RUN_PERFORMANCE_BUDGET_MODE;
  const apiBaseUrl = (process.env["E2E_REAL_API_URL"] ?? DEFAULT_API_BASE_URL).trim();
  const apiToken =
    process.env["PLAYWRIGHT_MANUAL_GUARD_TOKEN"] ??
    process.env["API_TOKEN"] ??
    process.env["APP_SMOKE_TOKEN"] ??
    process.env["PUSH_API_TOKEN"] ??
    "";
  const readinessTimeoutRaw = process.env["CI_STRESS_READINESS_TIMEOUT_MS"]?.trim() ?? "";
  const readinessTimeoutMilliseconds =
    readinessTimeoutRaw.length === 0
      ? DEFAULT_READINESS_TIMEOUT_MILLISECONDS
      : Number(readinessTimeoutRaw);
  const readinessPollIntervalRaw = process.env["CI_STRESS_READINESS_POLL_MS"]?.trim() ?? "";
  const readinessPollIntervalMilliseconds =
    readinessPollIntervalRaw.length === 0
      ? DEFAULT_READINESS_POLL_INTERVAL_MILLISECONDS
      : Number(readinessPollIntervalRaw);
  return StressRuntimeConfigurationSchema.parse({
    guardDurationSeconds: parsedDurationSeconds,
    safeRunPerformanceBudgetMode,
    apiBaseUrl,
    apiToken: apiToken.trim(),
    readinessTimeoutMilliseconds,
    readinessPollIntervalMilliseconds,
  });
}

function normalizeExitCode(code) {
  return typeof code === "number" ? code : 1;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForRuntimeReadiness(configuration) {
  const startedAtMilliseconds = Date.now();
  let lastReason = "runtime readiness not yet satisfied";

  while (Date.now() - startedAtMilliseconds < configuration.readinessTimeoutMilliseconds) {
    try {
      const headers = new Headers();
      if (configuration.apiToken.length > 0) {
        headers.set("X-Farfield-Token", configuration.apiToken);
      }
      const response = await fetch(new URL("/api/health", configuration.apiBaseUrl), {
        method: "GET",
        headers,
      });
      if (!response.ok) {
        lastReason = `HTTP ${String(response.status)}`;
        await sleep(configuration.readinessPollIntervalMilliseconds);
        continue;
      }
      const healthResponse = FarfieldHealthResponseSchema.parse(await response.json());
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

    await sleep(configuration.readinessPollIntervalMilliseconds);
  }

  throw new Error(
    `runtime readiness timed out after ${String(configuration.readinessTimeoutMilliseconds)}ms: ${lastReason}`,
  );
}

function waitForProcessExit(childProcess) {
  return new Promise((resolve) => {
    if (childProcess.exitCode !== null) {
      resolve({
        code: normalizeExitCode(childProcess.exitCode),
        signal: childProcess.signalCode ?? null,
      });
      return;
    }
    childProcess.once("exit", (code, signal) => {
      resolve({
        code: normalizeExitCode(code),
        signal,
      });
    });
  });
}

async function waitForProcessExitWithin(processExitPromise, timeoutMilliseconds) {
  return await Promise.race([processExitPromise, sleep(timeoutMilliseconds).then(() => null)]);
}

async function terminateProcess(childProcess, processExitPromise, label) {
  if (childProcess.killed || childProcess.exitCode !== null) {
    return;
  }

  process.stdout.write(`[ci-mode-stress] Stopping ${label} with SIGINT\n`);
  childProcess.kill("SIGINT");

  const gracefulExit = await waitForProcessExitWithin(
    processExitPromise,
    PROCESS_TERMINATION_GRACE_MILLISECONDS,
  );
  if (gracefulExit !== null) {
    return;
  }

  process.stdout.write(`[ci-mode-stress] ${label} did not stop in grace period; sending SIGTERM\n`);
  childProcess.kill("SIGTERM");

  const terminationExit = await waitForProcessExitWithin(
    processExitPromise,
    PROCESS_FORCE_TERMINATION_GRACE_MILLISECONDS,
  );
  if (terminationExit !== null) {
    return;
  }

  process.stdout.write(`[ci-mode-stress] ${label} did not stop after SIGTERM; sending SIGKILL\n`);
  childProcess.kill("SIGKILL");
  await processExitPromise;
}

async function main() {
  const configuration = readStressRuntimeConfiguration();
  const operationsDirectoryPath = path.resolve(process.cwd(), "scripts", "operations");
  const manualGuardScriptPath = path.join(operationsDirectoryPath, "playwright-manual-guard.mjs");
  const safeRunScriptPath = path.join(operationsDirectoryPath, "end-to-end-real-safe-run.mjs");

  process.stdout.write(
    `[ci-mode-stress] Waiting for runtime readiness at ${configuration.apiBaseUrl}\n`,
  );
  await waitForRuntimeReadiness(configuration);

  process.stdout.write("[ci-mode-stress] Starting warning-mode manual guard\n");
  const guardProcess = spawn(process.execPath, [manualGuardScriptPath], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_MANUAL_GUARD_DURATION_SECONDS: String(configuration.guardDurationSeconds),
      PLAYWRIGHT_MANUAL_GUARD_BUDGET_MODE: "warn",
      PLAYWRIGHT_MANUAL_GUARD_ALLOW_DEBUG_ERROR_MESSAGE_SUBSTRINGS:
        "forced error banner regression",
    },
  });

  process.stdout.write(
    `[ci-mode-stress] Starting real safe-run in parallel (perf budget mode=${configuration.safeRunPerformanceBudgetMode})\n`,
  );
  const safeRunProcess = spawn(process.execPath, [safeRunScriptPath], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_REAL_PERFORMANCE_BUDGET_MODE: configuration.safeRunPerformanceBudgetMode,
    },
  });

  const guardExitPromise = waitForProcessExit(guardProcess);
  const safeRunExitPromise = waitForProcessExit(safeRunProcess);
  const safeRunExit = await safeRunExitPromise;
  await terminateProcess(guardProcess, guardExitPromise, "manual guard");
  const guardExit = await guardExitPromise;

  if (safeRunExit.code !== 0) {
    process.exitCode = safeRunExit.code;
    process.stderr.write(
      `[ci-mode-stress] real safe-run failed (code=${String(safeRunExit.code)} signal=${String(safeRunExit.signal)})\n`,
    );
    return;
  }

  if (guardExit.code !== 0) {
    process.stdout.write(
      `[ci-mode-stress] warning-mode guard exited non-zero (code=${String(guardExit.code)} signal=${String(guardExit.signal)}); continuing because stress mode is diagnostic\n`,
    );
  }

  process.stdout.write("[ci-mode-stress] Completed\n");
}

try {
  await main();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ci-mode-stress] failed: ${errorMessage}\n`);
  process.exit(1);
}
