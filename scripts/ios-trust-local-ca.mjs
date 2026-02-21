import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const caddyConfigPath = path.join(cwd, "ops", "caddy", "Caddyfile.local");
const caddyConfigTemplatePath = path.join(cwd, "ops", "caddy", "Caddyfile.local.template");
const caddyRootCertificatePath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Caddy",
  "pki",
  "authorities",
  "local",
  "root.crt"
);
const caddyAdminAddress = (process.env["CADDY_ADMIN_ADDRESS"] ?? "127.0.0.1:2019").trim();
const caddyAdminReadyTimeoutMs = Number(process.env["CADDY_ADMIN_READY_TIMEOUT_MS"] ?? "10000");

function commandExists(command) {
  const whichCommand = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(whichCommand, [command], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function printError(title, lines) {
  process.stderr.write(`[ios:trust-local-ca] ${title}\n`);
  for (const line of lines) {
    process.stderr.write(`[ios:trust-local-ca] ${line}\n`);
  }
}

function parseAdminAddress(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("CADDY_ADMIN_ADDRESS cannot be empty");
  }
  const normalizedValue = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
  let parsedAddress;
  try {
    parsedAddress = new URL(normalizedValue);
  } catch (error) {
    throw new Error(
      `Invalid CADDY_ADMIN_ADDRESS (${trimmed}): ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!parsedAddress.hostname || !parsedAddress.port) {
    throw new Error(
      `Invalid CADDY_ADMIN_ADDRESS (${trimmed}): expected host:port, for example 127.0.0.1:2019`
    );
  }

  const port = Number(parsedAddress.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid CADDY_ADMIN_ADDRESS (${trimmed}): port must be in the range 1-65535`);
  }

  return {
    host: parsedAddress.hostname,
    port
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isAddressReachable(host, port) {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(500);
    socket.once("connect", () => {
      finalize(true);
    });
    socket.once("timeout", () => {
      finalize(false);
    });
    socket.once("error", () => {
      finalize(false);
    });
    socket.connect(port, host);
  });
}

async function waitForAddressReachable(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAddressReachable(host, port)) {
      return true;
    }
    await delay(200);
  }
  return false;
}

function runCaddyCommand(caddyExecutable, args, stdio = "inherit") {
  return spawnSync(caddyExecutable, args, {
    cwd,
    env: process.env,
    stdio
  });
}

async function ensureAdminApiForTrust(caddyExecutable, adminAddress, adminHost, adminPort) {
  const isReachable = await isAddressReachable(adminHost, adminPort);
  if (isReachable) {
    return {
      startedTemporaryAdmin: false
    };
  }

  process.stdout.write(
    `[ios:trust-local-ca] admin API is not reachable at ${adminAddress}; starting temporary Caddy admin.\n`
  );

  const tempDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-caddy-trust-"));
  const tempConfigPath = path.join(tempDirectoryPath, "Caddyfile");
  const tempConfigBody = [`{`, `  admin ${adminAddress}`, `}`].join("\n");
  fs.writeFileSync(tempConfigPath, `${tempConfigBody}\n`, "utf8");

  const startResult = runCaddyCommand(
    caddyExecutable,
    ["start", "--config", tempConfigPath, "--adapter", "caddyfile"]
  );
  if (startResult.status !== 0) {
    throw new Error(
      `failed to start temporary Caddy admin (exit ${String(startResult.status ?? 1)}) for address ${adminAddress}`
    );
  }

  const ready = await waitForAddressReachable(adminHost, adminPort, caddyAdminReadyTimeoutMs);
  if (!ready) {
    throw new Error(
      `temporary Caddy admin did not become reachable at ${adminAddress} within ${String(caddyAdminReadyTimeoutMs)}ms`
    );
  }

  return {
    startedTemporaryAdmin: true
  };
}

function stopTemporaryAdminIfNeeded(startedTemporaryAdmin, caddyExecutable, adminAddress) {
  if (!startedTemporaryAdmin) {
    return;
  }

  const stopResult = runCaddyCommand(caddyExecutable, ["stop", "--address", adminAddress], "ignore");
  if (stopResult.status !== 0) {
    printError("could not stop temporary Caddy admin.", [
      `Address: ${adminAddress}`,
      "You can stop it manually with:",
      `  ${caddyExecutable} stop --address ${adminAddress}`
    ]);
  }
}

async function main() {
  if (!fs.existsSync(caddyConfigPath)) {
    printError("missing generated Caddy local config.", [
      `Missing: ${caddyConfigPath}`,
      "Run:",
      "  bun run setup:ios-push",
      `Template source: ${caddyConfigTemplatePath}`
    ]);
    process.exit(1);
  }

  const caddyExecutable = (process.env["CADDY_BIN"] ?? "caddy").trim();
  if (caddyExecutable === "caddy" && !commandExists("caddy")) {
    printError("caddy is not available on PATH.", [
      "Install on macOS with Homebrew:",
      "  brew install caddy",
      "Or set CADDY_BIN=/absolute/path/to/caddy"
    ]);
    process.exit(1);
  }

  let adminAddressDetails;
  try {
    adminAddressDetails = parseAdminAddress(caddyAdminAddress);
  } catch (error) {
    printError("invalid admin address configuration.", [
      error instanceof Error ? error.message : String(error)
    ]);
    process.exit(1);
  }

  if (process.platform === "darwin" && !commandExists("certutil")) {
    process.stdout.write(
      "[ios:trust-local-ca] notice: certutil is not installed (brew install nss). This is optional for iOS Safari but removes NSS trust-store warnings.\n"
    );
  }

  let startedTemporaryAdmin = false;
  try {
    const adminResult = await ensureAdminApiForTrust(
      caddyExecutable,
      caddyAdminAddress,
      adminAddressDetails.host,
      adminAddressDetails.port
    );
    startedTemporaryAdmin = adminResult.startedTemporaryAdmin;
  } catch (error) {
    printError("could not prepare Caddy admin API for trust.", [
      error instanceof Error ? error.message : String(error),
      "Resolve the error above, then rerun:",
      "  bun run ios:trust-local-ca"
    ]);
    process.exit(1);
  }

  process.stdout.write(
    "[ios:trust-local-ca] running caddy trust. You may be prompted for your macOS password.\n"
  );
  const trustResult = runCaddyCommand(caddyExecutable, ["trust", "--address", caddyAdminAddress]);

  stopTemporaryAdminIfNeeded(startedTemporaryAdmin, caddyExecutable, caddyAdminAddress);

  if (trustResult.status !== 0) {
    printError("caddy trust failed.", [
      `Exit status: ${String(trustResult.status ?? 1)}`,
      "Resolve the error above, then rerun:",
      "  bun run ios:trust-local-ca"
    ]);
    process.exit(trustResult.status ?? 1);
  }

  if (!fs.existsSync(caddyRootCertificatePath)) {
    printError("local Caddy root certificate was not found after trust setup.", [
      `Expected: ${caddyRootCertificatePath}`
    ]);
    process.exit(1);
  }

  if (process.platform === "darwin" && commandExists("security")) {
    const verifyResult = spawnSync(
      "security",
      ["find-certificate", "-a", "-c", "Caddy Local Authority"],
      { stdio: "ignore" }
    );
    if (verifyResult.status !== 0) {
      printError("could not verify Caddy Local Authority in macOS keychains.", [
        "Run again and complete keychain trust prompts:",
        "  bun run ios:trust-local-ca"
      ]);
      process.exit(1);
    }
  }

  process.stdout.write(`[ios:trust-local-ca] trusted certificate path: ${caddyRootCertificatePath}\n`);
  process.stdout.write(
    "[ios:trust-local-ca] success. Next steps: bun run caddy:local (terminal 1), bun run dev (terminal 2)\n"
  );
}

await main();
