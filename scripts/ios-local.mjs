import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const cwd = process.cwd();
const caddyConfigTemplatePath = path.join(cwd, "ops", "caddy", "Caddyfile.local.template");
const caddyConfigPath = path.join(cwd, "ops", "caddy", "Caddyfile.local");
const backendPort = Number(process.env["PORT"] ?? "4311");
const frontendPort = 4312;
const caddyHttpPort = 80;
const caddyHttpsPort = 443;
const caddyReadyTimeoutMs = Number(process.env["IOS_LOCAL_CADDY_READY_TIMEOUT_MS"] ?? "180000");

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

const hasLsofCommand = commandExists("lsof");

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function printPrerequisiteError(title, lines) {
  process.stderr.write(`[ios:local] ${title}\n`);
  for (const line of lines) {
    process.stderr.write(`[ios:local] ${line}\n`);
  }
}

function startChild(command, args, label, useProcessGroup = false) {
  const detached = useProcessGroup && process.platform !== "win32";
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    detached
  });
  return child;
}

function listListeningProcesses(port) {
  if (!hasLsofCommand) {
    return [];
  }

  const result = spawnSync("lsof", ["-nP", `-iTCP:${String(port)}`, "-sTCP:LISTEN"], {
    encoding: "utf8"
  });
  if (result.status !== 0 || result.stdout.trim().length === 0) {
    return [];
  }

  const lines = result.stdout.trim().split(/\r?\n/);
  if (lines.length <= 1) {
    return [];
  }
  return lines.slice(1).map((line) => line.trim().replace(/\s+/g, " "));
}

async function probePortBinding(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve({
        available: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    server.listen(port, "0.0.0.0", () => {
      server.close((closeError) => {
        if (closeError) {
          resolve({
            available: false,
            error: closeError instanceof Error ? closeError.message : String(closeError)
          });
          return;
        }
        resolve({
          available: true,
          error: ""
        });
      });
    });
  });
}

async function ensurePortIsAvailable(port, label) {
  const listeners = listListeningProcesses(port);
  if (listeners.length > 0) {
    printPrerequisiteError(`${label} port ${String(port)} is already in use.`, [
      "Stop existing listeners, then retry:",
      ...listeners.map((line) => `  ${line}`)
    ]);
    process.exit(1);
  }

  if (hasLsofCommand || port < 1024) {
    return;
  }

  const probe = await probePortBinding(port);
  if (probe.available) {
    return;
  }

  printPrerequisiteError(`${label} port ${String(port)} appears unavailable.`, [
    "Port probe failed before startup:",
    `  ${probe.error}`,
    "Stop existing listeners, then retry."
  ]);
  process.exit(1);
}

function stopChild(child, signal, useProcessGroup = false) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (useProcessGroup && process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to single-process kill if process group is unavailable.
    }
  }

  child.kill(signal);
}

function resolvePackageManagerCommand(pnpmPathFromEnv) {
  if (pnpmPathFromEnv.length === 0) {
    return {
      command: "pnpm",
      args: ["dev"],
      label: "pnpm dev"
    };
  }

  const extension = path.extname(pnpmPathFromEnv).toLowerCase();
  if (extension === ".js" || extension === ".cjs" || extension === ".mjs") {
    return {
      command: process.execPath,
      args: [pnpmPathFromEnv, "dev"],
      label: "pnpm dev"
    };
  }

  return {
    command: pnpmPathFromEnv,
    args: ["dev"],
    label: "pnpm dev"
  };
}

async function isPortAcceptingConnections(port, host = "127.0.0.1") {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));
    socket.connect(port, host);
  });
}

async function waitForCaddyReady(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortAcceptingConnections(port)) {
      return;
    }
    await delay(250);
  }
  throw new Error(
    `Caddy HTTPS listener was not ready on port ${String(port)} within ${String(timeoutMs)}ms`
  );
}

if (!fs.existsSync(caddyConfigPath)) {
  printPrerequisiteError("missing generated Caddy local config.", [
    `Missing: ${caddyConfigPath}`,
    "Run:",
    "  pnpm setup:ios-push",
    `Template source: ${caddyConfigTemplatePath}`
  ]);
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
process.stdout.write("[ios:local] starting caddy, then dev server after HTTPS is ready...\n");

let shuttingDown = false;
let devProcess = null;
let caddyProcess = null;

function stopChildren(signal) {
  stopChild(devProcess, signal, true);
  stopChild(caddyProcess, signal, false);
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

if (process.platform === "darwin" && !commandExists("certutil")) {
  process.stdout.write(
    "[ios:local] notice: certutil is not installed (brew install nss). This is optional for iOS Safari but removes NSS trust-store warnings.\n"
  );
}

await ensurePortIsAvailable(backendPort, "Backend");
await ensurePortIsAvailable(frontendPort, "Frontend");
await ensurePortIsAvailable(caddyHttpPort, "Caddy HTTP");
await ensurePortIsAvailable(caddyHttpsPort, "Caddy HTTPS");

const packageManagerCommand = resolvePackageManagerCommand(pnpmExecPath);
caddyProcess = startChild(caddyExecutable, ["run", "--config", caddyConfigPath], "caddy", false);
caddyProcess.on("error", (error) => {
  exitFromStartError("caddy", error);
});
caddyProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (!devProcess) {
    process.stderr.write(
      `[ios:local] caddy exited (${signal ?? `code ${String(code ?? 0)}`}) before HTTPS startup completed.\n`
    );
    process.exit(code ?? 1);
    return;
  }
  process.stderr.write(
    `[ios:local] caddy exited (${signal ?? `code ${String(code ?? 0)}`}); stopping dev server.\n`
  );
  stopChildren("SIGTERM");
  process.exit(code ?? 1);
});

try {
  await waitForCaddyReady(caddyHttpsPort, caddyReadyTimeoutMs);
} catch (error) {
  if (!shuttingDown) {
    const detail = error instanceof Error ? error.message : String(error);
    printPrerequisiteError("caddy did not become ready.", [
      detail,
      "If a password prompt is waiting, finish it or run:",
      "  pnpm ios:trust-local-ca",
      "Then run:",
      "  pnpm ios:local"
    ]);
  }
  stopChildren("SIGTERM");
  process.exit(1);
}

devProcess = startChild(packageManagerCommand.command, packageManagerCommand.args, packageManagerCommand.label, true);
devProcess.on("error", (error) => {
  exitFromStartError("pnpm dev", error);
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

process.on("SIGINT", () => {
  handleTerminationSignal("SIGINT");
});
process.on("SIGTERM", () => {
  handleTerminationSignal("SIGTERM");
});
