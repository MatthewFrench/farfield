import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const cwd = process.cwd();
const caddyConfigPath = path.join(cwd, "ops", "caddy", "Caddyfile.local");

function parseHttpsOrigin(configText) {
  const siteLine = configText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#") && line.endsWith("{"));

  if (!siteLine) {
    throw new Error(`Could not find a site address in ${caddyConfigPath}`);
  }

  const address = siteLine.slice(0, -1).trim().split(/\s+/)[0];
  if (!address) {
    throw new Error(`Invalid site address in ${caddyConfigPath}`);
  }

  if (address.startsWith("http://") || address.startsWith("https://")) {
    return address;
  }

  return `https://${address}`;
}

function maskSecret(value) {
  if (value.length <= 10) {
    return "***";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function commandExists(command) {
  const whichCommand = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(whichCommand, [command], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function printPrerequisiteError(title, lines) {
  process.stderr.write(`[ios:local] ${title}\n`);
  for (const line of lines) {
    process.stderr.write(`[ios:local] ${line}\n`);
  }
}

function startChild(command, args, label) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit"
  });
  return child;
}

if (!fs.existsSync(caddyConfigPath)) {
  process.stderr.write(`[ios:local] missing config: ${caddyConfigPath}\n`);
  process.exit(1);
}

const caddyConfigText = fs.readFileSync(caddyConfigPath, "utf8");
const origin = parseHttpsOrigin(caddyConfigText);
const apiToken = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();
const webToken = (process.env["VITE_API_TOKEN"] ?? process.env["VITE_PUSH_API_TOKEN"] ?? "").trim();

process.stdout.write(`[ios:local] origin: ${origin}\n`);
if (apiToken.length > 0) {
  process.stdout.write(`[ios:local] API token header: X-Farfield-Token: ${maskSecret(apiToken)}\n`);
} else {
  process.stdout.write("[ios:local] API token header: not set (loopback-only safe; set for remote hosts)\n");
}
if (webToken.length > 0) {
  process.stdout.write("[ios:local] web token env: configured\n");
} else {
  process.stdout.write("[ios:local] web token env: not set\n");
}
process.stdout.write("[ios:local] starting dev server and caddy...\n");

let shuttingDown = false;
let devProcess = null;
let caddyProcess = null;

function stopChildren(signal) {
  if (devProcess && devProcess.exitCode === null) {
    devProcess.kill(signal);
  }
  if (caddyProcess && caddyProcess.exitCode === null) {
    caddyProcess.kill(signal);
  }
}

function exitFromStartError(label, error) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stderr.write(`[ios:local] failed to start ${label}: ${error.message}\n`);
  stopChildren("SIGTERM");
  process.exit(1);
}

function handleTerminationSignal(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  stopChildren(signal);
  process.exit(0);
}

const pnpmExecPath = (process.env["npm_execpath"] ?? "").trim();
const caddyExecutable = (process.env["CADDY_BIN"] ?? "caddy").trim();

if (pnpmExecPath.length === 0 && !commandExists("pnpm")) {
  printPrerequisiteError("pnpm is not available on PATH.", [
    "Install with corepack:",
    "  corepack enable",
    "  corepack prepare pnpm@10 --activate"
  ]);
  process.exit(1);
}

if (caddyExecutable === "caddy" && !commandExists("caddy")) {
  printPrerequisiteError("caddy is not available on PATH.", [
    "Install on macOS with Homebrew:",
    "  brew install caddy",
    "Or set CADDY_BIN=/absolute/path/to/caddy"
  ]);
  process.exit(1);
}

if (pnpmExecPath.length > 0) {
  devProcess = startChild(process.execPath, [pnpmExecPath, "dev"], "pnpm dev");
} else {
  devProcess = startChild("pnpm", ["dev"], "pnpm dev");
}
caddyProcess = startChild(caddyExecutable, ["run", "--config", caddyConfigPath], "caddy");

devProcess.on("error", (error) => {
  exitFromStartError("pnpm dev", error);
});
caddyProcess.on("error", (error) => {
  exitFromStartError("caddy", error);
});

devProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stderr.write(
    `[ios:local] pnpm dev exited (${signal ?? `code ${String(code ?? 0)}`}); stopping caddy.\n`
  );
  stopChildren("SIGTERM");
  process.exit(code ?? 1);
});

caddyProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stderr.write(
    `[ios:local] caddy exited (${signal ?? `code ${String(code ?? 0)}`}); stopping dev server.\n`
  );
  stopChildren("SIGTERM");
  process.exit(code ?? 1);
});

process.on("SIGINT", () => {
  handleTerminationSignal("SIGINT");
});
process.on("SIGTERM", () => {
  handleTerminationSignal("SIGTERM");
});
