import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const cwd = process.cwd();
const caddyConfigTemplatePath = path.join(cwd, "operations", "caddy", "Caddyfile.local.template");
const caddyConfigPath = path.join(cwd, "operations", "caddy", "Caddyfile.local");
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
  process.stderr.write(`[caddy:local] ${title}\n`);
  for (const line of lines) {
    process.stderr.write(`[caddy:local] ${line}\n`);
  }
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
    "  bun run setup:ios-push",
    `Template source: ${caddyConfigTemplatePath}`
  ]);
  process.exit(1);
}

const caddyConfigText = fs.readFileSync(caddyConfigPath, "utf8");
const origin = parseHttpsOrigin(caddyConfigText);
const apiToken = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();
const webToken = (process.env["VITE_API_TOKEN"] ?? process.env["VITE_PUSH_API_TOKEN"] ?? "").trim();

process.stdout.write(`[caddy:local] origin: ${origin}\n`);
if (apiToken.length > 0) {
  process.stdout.write(`[caddy:local] API token header: X-Farfield-Token: ${maskSecret(apiToken)}\n`);
} else {
  process.stdout.write(
    "[caddy:local] API token header: not set (loopback-only safe; set for remote hosts)\n"
  );
}
if (webToken.length > 0) {
  process.stdout.write("[caddy:local] web token env: configured\n");
} else {
  process.stdout.write("[caddy:local] web token env: not set\n");
}

const caddyExecutable = (process.env["CADDY_BIN"] ?? "caddy").trim();
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
    "[caddy:local] notice: certutil is not installed (brew install nss). This is optional for iOS Safari but removes NSS trust-store warnings.\n"
  );
}

await ensurePortIsAvailable(caddyHttpPort, "Caddy HTTP");
await ensurePortIsAvailable(caddyHttpsPort, "Caddy HTTPS");

let shuttingDown = false;
const caddyProcess = spawn(caddyExecutable, ["run", "--config", caddyConfigPath], {
  cwd,
  env: process.env,
  stdio: "inherit"
});

function stopCaddy(signal) {
  if (caddyProcess.exitCode !== null) {
    return;
  }
  caddyProcess.kill(signal);
}

function terminate(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  stopCaddy(signal);
  process.exit(0);
}

caddyProcess.on("error", (error) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stderr.write(`[caddy:local] failed to start caddy: ${error.message}\n`);
  process.exit(1);
});

caddyProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stderr.write(`[caddy:local] caddy exited (${signal ?? `code ${String(code ?? 0)}`}).\n`);
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
      "  bun run ios:trust-local-ca",
      "Then rerun:",
      "  bun run caddy:local"
    ]);
  }
  stopCaddy("SIGTERM");
  process.exit(1);
}

process.stdout.write("[caddy:local] HTTPS proxy is ready.\n");
process.stdout.write("[caddy:local] Keep this running, then start app dev server in another terminal: bun run dev\n");

process.on("SIGINT", () => {
  terminate("SIGINT");
});
process.on("SIGTERM", () => {
  terminate("SIGTERM");
});
