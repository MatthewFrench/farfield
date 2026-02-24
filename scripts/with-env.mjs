import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parse } from "dotenv";
import { z } from "zod";

const InheritedEnvironmentSchema = z.record(z.string().min(1), z.string());
const LoadedEnvironmentSchema = z.record(z.string().min(1), z.string());

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
  "XDG_STATE_HOME"
]);

const INHERITED_ENVIRONMENT_PREFIXES = [
  "API_",
  "APP_SMOKE_",
  "BUN_",
  "CADDY_",
  "CODEX_",
  "DEBUG_",
  "FARFIELD_",
  "GITHUB_",
  "IOS_",
  "NODE_",
  "NTFY_",
  "NPM_",
  "PLAYWRIGHT_",
  "PUSH_",
  "STREAM_BURST_",
  "THREAD_",
  "VITE_",
  "WEB_",
  "npm_"
];

function shouldIncludeInheritedEnvironmentKey(environmentKey) {
  if (INHERITED_ENVIRONMENT_EXACT_KEYS.has(environmentKey)) {
    return true;
  }

  return INHERITED_ENVIRONMENT_PREFIXES.some((prefix) => environmentKey.startsWith(prefix));
}

/**
 * Builds a schema-validated inherited environment allowlist for spawned commands.
 * This prevents accidental full-environment propagation while preserving required tool/runtime keys.
 */
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

const cwd = process.cwd();
const envPaths = [path.join(cwd, ".env"), path.join(cwd, ".env.local")];
const loadedEnv = {};

for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) {
    continue;
  }
  const parsed = parse(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    loadedEnv[key] = value;
  }
}

const commandText = process.argv.slice(2).join(" ").trim();
if (commandText.length === 0) {
  process.stderr.write("[with-env] missing command\n");
  process.exit(1);
}

const loadedEnvironment = LoadedEnvironmentSchema.parse(loadedEnv);
const inheritedEnvironment = buildInheritedEnvironment(process.env);

const child = spawn(commandText, {
  cwd,
  env: {
    ...loadedEnvironment,
    ...inheritedEnvironment
  },
  shell: true,
  stdio: "inherit"
});

child.on("error", (error) => {
  process.stderr.write(`[with-env] failed to start command: ${error.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
