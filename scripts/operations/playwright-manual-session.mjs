#!/usr/bin/env node

import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { z } from "zod";
import { FarfieldHealthResponseSchema } from "@farfield/protocol";

/**
 * Owns the manual Playwright session bootstrap lifecycle:
 * - start runtime
 * - wait for readiness
 * - run baseline smoke checks
 * - start live manual guard monitoring
 * - terminate child processes deterministically on exit
 */

const DEFAULT_API_HOST = "127.0.0.1";
const DEFAULT_API_PORT = "4321";
const DEFAULT_HEALTH_TIMEOUT_MILLISECONDS = 120_000;
const DEFAULT_HEALTH_POLL_INTERVAL_MILLISECONDS = 1_000;
const DEFAULT_PROCESS_SHUTDOWN_GRACE_MILLISECONDS = 5_000;
const DEFAULT_SMOKE_ATTEMPTS = 3;
const DEFAULT_SMOKE_RETRY_DELAY_MILLISECONDS = 1_500;
const DEFAULT_REAL_BASE_URL = "http://127.0.0.1:4322";
const DEFAULT_PORT_PROBE_TIMEOUT_MILLISECONDS = 500;

const InheritedEnvironmentSchema = z.record(z.string().min(1), z.string());

const SessionRuntimeConfigurationSchema = z
  .object({
    apiBaseUrl: z.string().url(),
    apiHost: z.string().trim().min(1),
    apiPort: z.number().int().min(1).max(65_535),
    realBaseUrl: z.string().url(),
    realBaseHost: z.string().trim().min(1),
    realBasePort: z.number().int().min(1).max(65_535),
    apiToken: z.string(),
    healthTimeoutMilliseconds: z.number().int().positive(),
    healthPollIntervalMilliseconds: z.number().int().positive(),
    processShutdownGraceMilliseconds: z.number().int().positive(),
    smokeAttempts: z.number().int().positive(),
    smokeRetryDelayMilliseconds: z.number().int().positive(),
    portProbeTimeoutMilliseconds: z.number().int().positive(),
  })
  .strict();

const ManagedChildProcessExitSchema = z
  .object({
    code: z.number().int(),
    signal: z.string().nullable(),
  })
  .strict();

const INHERITED_ENVIRONMENT_EXACT_KEYS = new Set([
  "ALL_PROXY",
  "APPDATA",
  "CI",
  "CODEX_HOME",
  "COLORTERM",
  "ComSpec",
  "EDITOR",
  "FORCE_COLOR",
  "HOME",
  "HOST",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "LOG_LEVEL",
  "NO_COLOR",
  "NO_PROXY",
  "PATH",
  "PORT",
  "PWD",
  "SHELL",
  "SHLVL",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SystemRoot",
  "TERM",
  "TERM_PROGRAM",
  "TMP",
  "TMPDIR",
  "TEMP",
  "TZ",
  "USER",
  "USERNAME",
  "USERPROFILE",
  "VISUAL",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
]);

const INHERITED_ENVIRONMENT_PREFIXES = [
  "API_",
  "APP_SMOKE_",
  "BUN_",
  "CADDY_",
  "CODEX_",
  "DEBUG_",
  "E2E_REAL_",
  "FARFIELD_",
  "GITHUB_",
  "HOST",
  "IOS_",
  "NODE_",
  "NO_",
  "NTFY_",
  "NPM_",
  "PLAYWRIGHT_",
  "PUSH_",
  "STREAM_BURST_",
  "THREAD_",
  "VITE_",
  "WEB_",
  "npm_",
];

function shouldIncludeInheritedEnvironmentKey(environmentKey) {
  if (INHERITED_ENVIRONMENT_EXACT_KEYS.has(environmentKey)) {
    return true;
  }
  return INHERITED_ENVIRONMENT_PREFIXES.some((prefix) => environmentKey.startsWith(prefix));
}

function buildInheritedEnvironment(sourceEnvironment) {
  const inheritedEnvironment = {};
  for (const [environmentKey, environmentValue] of Object.entries(sourceEnvironment)) {
    if (!shouldIncludeInheritedEnvironmentKey(environmentKey)) {
      continue;
    }
    if (typeof environmentValue !== "string") {
      continue;
    }
    inheritedEnvironment[environmentKey] = environmentValue;
  }
  return InheritedEnvironmentSchema.parse(inheritedEnvironment);
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

function resolvePortFromUrl(url) {
  if (url.port.length > 0) {
    const parsedPort = Number(url.port);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
      throw new Error(`Invalid URL port: ${url.toString()}`);
    }
    return parsedPort;
  }

  if (url.protocol === "https:") {
    return 443;
  }

  return 80;
}

function readSessionRuntimeConfiguration() {
  const host = (process.env["HOST"] ?? DEFAULT_API_HOST).trim();
  const port = (process.env["PORT"] ?? DEFAULT_API_PORT).trim();
  const apiBaseUrlRaw =
    process.env["E2E_REAL_API_URL"] ?? process.env["APP_SMOKE_URL"] ?? `http://${host}:${port}`;
  const realBaseUrlRaw = process.env["E2E_REAL_BASE_URL"] ?? DEFAULT_REAL_BASE_URL;
  const apiUrl = new URL(apiBaseUrlRaw.trim());
  const realBaseUrl = new URL(realBaseUrlRaw.trim());
  const apiToken = (
    process.env["E2E_REAL_API_TOKEN"] ??
    process.env["API_TOKEN"] ??
    process.env["APP_SMOKE_TOKEN"] ??
    process.env["PUSH_API_TOKEN"] ??
    ""
  ).trim();

  return SessionRuntimeConfigurationSchema.parse({
    apiBaseUrl: apiUrl.toString(),
    apiHost: apiUrl.hostname,
    apiPort: resolvePortFromUrl(apiUrl),
    realBaseUrl: realBaseUrl.toString(),
    realBaseHost: realBaseUrl.hostname,
    realBasePort: resolvePortFromUrl(realBaseUrl),
    apiToken,
    healthTimeoutMilliseconds: parsePositiveIntegerEnvironmentVariable(
      "PLAYWRIGHT_MANUAL_SESSION_HEALTH_TIMEOUT_MS",
      DEFAULT_HEALTH_TIMEOUT_MILLISECONDS,
    ),
    healthPollIntervalMilliseconds: parsePositiveIntegerEnvironmentVariable(
      "PLAYWRIGHT_MANUAL_SESSION_HEALTH_POLL_MS",
      DEFAULT_HEALTH_POLL_INTERVAL_MILLISECONDS,
    ),
    processShutdownGraceMilliseconds: parsePositiveIntegerEnvironmentVariable(
      "PLAYWRIGHT_MANUAL_SESSION_SHUTDOWN_GRACE_MS",
      DEFAULT_PROCESS_SHUTDOWN_GRACE_MILLISECONDS,
    ),
    smokeAttempts: parsePositiveIntegerEnvironmentVariable(
      "PLAYWRIGHT_MANUAL_SESSION_SMOKE_ATTEMPTS",
      DEFAULT_SMOKE_ATTEMPTS,
    ),
    smokeRetryDelayMilliseconds: parsePositiveIntegerEnvironmentVariable(
      "PLAYWRIGHT_MANUAL_SESSION_SMOKE_RETRY_DELAY_MS",
      DEFAULT_SMOKE_RETRY_DELAY_MILLISECONDS,
    ),
    portProbeTimeoutMilliseconds: parsePositiveIntegerEnvironmentVariable(
      "PLAYWRIGHT_MANUAL_SESSION_PORT_PROBE_TIMEOUT_MS",
      DEFAULT_PORT_PROBE_TIMEOUT_MILLISECONDS,
    ),
  });
}

function buildApiHeaders(apiToken) {
  const headers = new Headers();
  if (apiToken.length > 0) {
    headers.set("X-Farfield-Token", apiToken);
  }
  return headers;
}

async function delay(milliseconds) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function isTcpPortReachable(host, port, timeoutMilliseconds) {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (reachable) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeoutMilliseconds);
    socket.once("connect", () => {
      onDone(true);
    });
    socket.once("timeout", () => {
      onDone(false);
    });
    socket.once("error", () => {
      onDone(false);
    });

    socket.connect(port, host);
  });
}

function normalizeExitCode(code) {
  return typeof code === "number" ? code : 1;
}

function waitForChildExit(childProcess) {
  return new Promise((resolve) => {
    childProcess.once("exit", (code, signal) => {
      resolve(
        ManagedChildProcessExitSchema.parse({
          code: normalizeExitCode(code),
          signal,
        }),
      );
    });
  });
}

async function terminateChildProcess(childProcess, label, graceMilliseconds) {
  if (!childProcess || childProcess.killed || childProcess.exitCode !== null) {
    return;
  }

  childProcess.kill("SIGINT");
  const gracefulExit = await Promise.race([
    waitForChildExit(childProcess).then(() => true),
    delay(graceMilliseconds).then(() => false),
  ]);
  if (gracefulExit) {
    return;
  }

  process.stdout.write(`[manual-session] ${label} did not exit on SIGINT, sending SIGTERM\n`);
  childProcess.kill("SIGTERM");
}

function runSmokeCheck(childEnvironment) {
  const smokeScriptPath = path.resolve(process.cwd(), "scripts", "smoke", "app-smoke.mjs");
  const result = spawnSync(process.execPath, [smokeScriptPath], {
    cwd: process.cwd(),
    env: childEnvironment,
    stdio: "inherit",
  });
  return normalizeExitCode(result.status);
}

async function runSmokeCheckWithRetry(configuration, childEnvironment) {
  for (let attemptIndex = 0; attemptIndex < configuration.smokeAttempts; attemptIndex += 1) {
    const attemptNumber = attemptIndex + 1;
    process.stdout.write(
      `[manual-session] smoke:app attempt ${String(attemptNumber)}/${String(configuration.smokeAttempts)}\n`,
    );
    const smokeExitCode = runSmokeCheck(childEnvironment);
    if (smokeExitCode === 0) {
      return 0;
    }

    if (attemptNumber >= configuration.smokeAttempts) {
      return smokeExitCode;
    }

    process.stdout.write(
      `[manual-session] smoke:app failed on attempt ${String(attemptNumber)}, retrying after ${String(configuration.smokeRetryDelayMilliseconds)}ms\n`,
    );
    await delay(configuration.smokeRetryDelayMilliseconds);
  }

  return 1;
}

async function waitForRuntimeReadiness(configuration) {
  const startedAt = Date.now();
  let lastReason = "runtime not ready yet";
  const headers = buildApiHeaders(configuration.apiToken);
  process.stdout.write(`[manual-session] waiting for runtime health at ${configuration.apiBaseUrl}\n`);

  while (Date.now() - startedAt < configuration.healthTimeoutMilliseconds) {
    try {
      const response = await fetch(new URL("/api/health", configuration.apiBaseUrl), {
        method: "GET",
        headers,
      });
      if (!response.ok) {
        lastReason = `HTTP ${String(response.status)}`;
        await delay(configuration.healthPollIntervalMilliseconds);
        continue;
      }

      const healthPayload = FarfieldHealthResponseSchema.parse(await response.json());
      const isReady =
        healthPayload.state.appReady &&
        healthPayload.state.ipcConnected &&
        healthPayload.state.ipcInitialized;
      if (isReady) {
        process.stdout.write("[manual-session] runtime health is ready\n");
        return;
      }

      lastReason = `state appReady=${String(healthPayload.state.appReady)} ipcConnected=${String(
        healthPayload.state.ipcConnected,
      )} ipcInitialized=${String(healthPayload.state.ipcInitialized)}`;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }

    await delay(configuration.healthPollIntervalMilliseconds);
  }

  throw new Error(`runtime did not become ready within timeout (${lastReason})`);
}

async function main() {
  const configuration = readSessionRuntimeConfiguration();
  const childEnvironment = buildInheritedEnvironment(process.env);
  const developmentScriptPath = path.resolve(process.cwd(), "scripts", "development", "dev.mjs");
  const manualGuardScriptPath = path.resolve(
    process.cwd(),
    "scripts",
    "operations",
    "playwright-manual-guard.mjs",
  );
  let developmentProcess = null;

  let manualGuardProcess = null;
  let completed = false;
  let shuttingDown = false;
  let resolveCompletion;
  const completionPromise = new Promise((resolve) => {
    resolveCompletion = resolve;
  });

  const complete = (exitCode) => {
    if (completed) {
      return;
    }
    completed = true;
    resolveCompletion(exitCode);
  };

  const shutdown = async (reason, exitCode) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stdout.write(`[manual-session] shutting down: ${reason}\n`);
    await terminateChildProcess(
      manualGuardProcess,
      "manual guard",
      configuration.processShutdownGraceMilliseconds,
    );
    await terminateChildProcess(
      developmentProcess,
      "development runtime",
      configuration.processShutdownGraceMilliseconds,
    );
    complete(exitCode);
  };

  process.on("SIGINT", () => {
    void shutdown("received SIGINT", 0);
  });
  process.on("SIGTERM", () => {
    void shutdown("received SIGTERM", 0);
  });

  try {
    process.stdout.write("[manual-session] probing existing runtime with smoke baseline\n");
    let smokeExitCode = await runSmokeCheckWithRetry(configuration, childEnvironment);
    if (smokeExitCode !== 0) {
      const apiPortReachable = await isTcpPortReachable(
        configuration.apiHost,
        configuration.apiPort,
        configuration.portProbeTimeoutMilliseconds,
      );
      const realBasePortReachable = await isTcpPortReachable(
        configuration.realBaseHost,
        configuration.realBasePort,
        configuration.portProbeTimeoutMilliseconds,
      );
      if (apiPortReachable || realBasePortReachable) {
        throw new Error(
          `Existing services are listening on api ${configuration.apiHost}:${String(
            configuration.apiPort,
          )} or web ${configuration.realBaseHost}:${String(
            configuration.realBasePort,
          )}, but smoke checks failed. Stop conflicting processes and retry.`,
        );
      }

      process.stdout.write("[manual-session] starting development runtime\n");
      developmentProcess = spawn(process.execPath, [developmentScriptPath], {
        cwd: process.cwd(),
        env: childEnvironment,
        stdio: "inherit",
      });
      developmentProcess.once("exit", (code, signal) => {
        if (shuttingDown) {
          return;
        }
        const detail = signal ? `signal ${signal}` : `code ${String(normalizeExitCode(code))}`;
        void shutdown(`development runtime exited unexpectedly (${detail})`, normalizeExitCode(code));
      });

      await waitForRuntimeReadiness(configuration);
      process.stdout.write("[manual-session] re-running smoke baseline after startup\n");
      smokeExitCode = await runSmokeCheckWithRetry(configuration, childEnvironment);
      if (smokeExitCode !== 0) {
        throw new Error(`smoke:app failed with exit code ${String(smokeExitCode)}`);
      }
    } else {
      process.stdout.write("[manual-session] existing runtime passed smoke baseline; reusing it\n");
    }

    process.stdout.write("[manual-session] starting live manual guard\n");
    manualGuardProcess = spawn(process.execPath, [manualGuardScriptPath], {
      cwd: process.cwd(),
      env: childEnvironment,
      stdio: "inherit",
    });

    manualGuardProcess.once("exit", (code, signal) => {
      if (shuttingDown) {
        return;
      }

      const guardExitCode = normalizeExitCode(code);
      if (signal) {
        void shutdown(`manual guard exited by signal ${signal}`, guardExitCode);
        return;
      }

      if (guardExitCode !== 0) {
        void shutdown(
          `manual guard detected blocking issues (exit code ${String(guardExitCode)})`,
          guardExitCode,
        );
        return;
      }

      void shutdown("manual guard completed", 0);
    });

    process.stdout.write(
      "[manual-session] ready: open the app and run Playwright MCP manual scenarios; Ctrl+C stops runtime and guard\n",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[manual-session] ${message}\n`);
    await shutdown("startup failed", 1);
  }

  const exitCode = await completionPromise;
  process.exit(exitCode);
}

await main();
