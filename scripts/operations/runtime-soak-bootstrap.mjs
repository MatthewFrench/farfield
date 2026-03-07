#!/usr/bin/env node

import childProcess from "node:child_process";
import path from "node:path";
import { z } from "zod";

/**
 * Bootstraps repeated real-path runtime soak runs from the local shell.
 * This script standardizes repeat cadence and artifact reporting, but it does not replace
 * in-chat multi-agent orchestration. The browser/signal/request watcher roles still belong in AI.
 */

const EngineSelectionSchema = z.enum(["chromium", "webkit", "both"]);
const BudgetModeSchema = z.enum(["warn", "fail"]);
const PositiveIntegerSchema = z.coerce.number().int().positive();
const BootstrapConfigurationSchema = z
  .object({
    engines: z.array(z.enum(["chromium", "webkit"])).min(1),
    repeatCount: PositiveIntegerSchema,
    budgetMode: BudgetModeSchema,
    runSmokeBaseline: z.boolean(),
    dryRun: z.boolean(),
  })
  .strict();

const DEFAULT_REPEAT_COUNT = 1;
const DEFAULT_BUDGET_MODE = "warn";
const DEFAULT_ENGINE_SELECTION = "both";
const SCRIPT_DIRECTORY_PATH = path.dirname(new URL(import.meta.url).pathname);
const REPOSITORY_ROOT_PATH = path.resolve(SCRIPT_DIRECTORY_PATH, "..", "..");
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

function readBooleanEnvironmentVariable(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return defaultValue;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "yes") {
    return true;
  }
  if (normalizedValue === "0" || normalizedValue === "false" || normalizedValue === "no") {
    return false;
  }

  throw new Error(`${name} must be one of: 1, 0, true, false, yes, no`);
}

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
  return z.record(z.string().min(1), z.string()).parse(inheritedEnvironment);
}

function parseBootstrapConfiguration(commandLineArguments) {
  let engineSelectionRaw = process.env["RUNTIME_SOAK_BOOTSTRAP_ENGINE"] ?? DEFAULT_ENGINE_SELECTION;
  let repeatCountRaw = process.env["RUNTIME_SOAK_BOOTSTRAP_REPEAT"] ?? String(DEFAULT_REPEAT_COUNT);
  let budgetModeRaw = process.env["RUNTIME_SOAK_BOOTSTRAP_BUDGET_MODE"] ?? DEFAULT_BUDGET_MODE;
  let runSmokeBaseline = readBooleanEnvironmentVariable("RUNTIME_SOAK_BOOTSTRAP_RUN_SMOKE", true);
  let dryRun = readBooleanEnvironmentVariable("RUNTIME_SOAK_BOOTSTRAP_DRY_RUN", false);

  for (let argumentIndex = 0; argumentIndex < commandLineArguments.length; argumentIndex += 1) {
    const argument = commandLineArguments[argumentIndex];
    if (argument === "--engine") {
      const nextArgument = commandLineArguments[argumentIndex + 1];
      if (nextArgument === undefined) {
        throw new Error("--engine requires one value");
      }
      engineSelectionRaw = nextArgument;
      argumentIndex += 1;
      continue;
    }
    if (argument === "--repeat") {
      const nextArgument = commandLineArguments[argumentIndex + 1];
      if (nextArgument === undefined) {
        throw new Error("--repeat requires one value");
      }
      repeatCountRaw = nextArgument;
      argumentIndex += 1;
      continue;
    }
    if (argument === "--budget-mode") {
      const nextArgument = commandLineArguments[argumentIndex + 1];
      if (nextArgument === undefined) {
        throw new Error("--budget-mode requires one value");
      }
      budgetModeRaw = nextArgument;
      argumentIndex += 1;
      continue;
    }
    if (argument === "--skip-smoke") {
      runSmokeBaseline = false;
      continue;
    }
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  const parsedEngineSelection = EngineSelectionSchema.parse(
    engineSelectionRaw.trim().toLowerCase(),
  );
  const engines =
    parsedEngineSelection === "both" ? ["chromium", "webkit"] : [parsedEngineSelection];

  return BootstrapConfigurationSchema.parse({
    engines,
    repeatCount: repeatCountRaw,
    budgetMode: budgetModeRaw.trim().toLowerCase(),
    runSmokeBaseline,
    dryRun,
  });
}

function runCommand(commandArguments, environmentVariables) {
  const executionResult = childProcess.spawnSync("bun", commandArguments, {
    cwd: REPOSITORY_ROOT_PATH,
    env: environmentVariables,
    stdio: "inherit",
  });

  if (executionResult.error) {
    throw executionResult.error;
  }

  return executionResult.status ?? 1;
}

function readSoakScriptName(engine) {
  return engine === "webkit" ? "end-to-end:real:mobile-soak:webkit" : "end-to-end:real:mobile-soak";
}

function readArtifactPath(engine) {
  return path.join(
    REPOSITORY_ROOT_PATH,
    ".runtime",
    "end-to-end-performance",
    `${engine === "webkit" ? "webkit" : "browser"}-mobile-soak.json`,
  );
}

function main() {
  const configuration = parseBootstrapConfiguration(process.argv.slice(2));
  const inheritedEnvironment = buildInheritedEnvironment(process.env);
  const runtimeEnvironment = {
    ...inheritedEnvironment,
    E2E_REAL_PERFORMANCE_BUDGET_MODE: configuration.budgetMode,
  };

  process.stdout.write("[runtime-soak-bootstrap] configuration\n");
  process.stdout.write(
    `${JSON.stringify(
      {
        engines: configuration.engines,
        repeatCount: configuration.repeatCount,
        budgetMode: configuration.budgetMode,
        runSmokeBaseline: configuration.runSmokeBaseline,
        dryRun: configuration.dryRun,
      },
      null,
      2,
    )}\n`,
  );

  const plannedCommands = [];
  if (configuration.runSmokeBaseline) {
    plannedCommands.push(["run", "smoke:app"]);
  }
  for (let repeatIndex = 0; repeatIndex < configuration.repeatCount; repeatIndex += 1) {
    for (const engine of configuration.engines) {
      plannedCommands.push(["run", readSoakScriptName(engine)]);
    }
  }

  if (configuration.dryRun) {
    process.stdout.write("[runtime-soak-bootstrap] dry run plan\n");
    for (const plannedCommand of plannedCommands) {
      process.stdout.write(`bun ${plannedCommand.join(" ")}\n`);
    }
    return;
  }

  for (const plannedCommand of plannedCommands) {
    const exitCode = runCommand(plannedCommand, runtimeEnvironment);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      return;
    }
  }

  process.stdout.write("[runtime-soak-bootstrap] completed successfully\n");
  for (const engine of configuration.engines) {
    process.stdout.write(
      `[runtime-soak-bootstrap] latest ${engine} artifact ${readArtifactPath(engine)}\n`,
    );
  }
  process.stdout.write(
    `[runtime-soak-bootstrap] latest sentinel ${path.join(REPOSITORY_ROOT_PATH, ".runtime", "end-to-end-sentinel", "latest.ndjson")}\n`,
  );
}

main();
