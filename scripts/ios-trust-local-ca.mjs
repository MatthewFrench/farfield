import fs from "node:fs";
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

if (!fs.existsSync(caddyConfigPath)) {
  printError("missing generated Caddy local config.", [
    `Missing: ${caddyConfigPath}`,
    "Run:",
    "  pnpm setup:ios-push",
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

if (process.platform === "darwin" && !commandExists("certutil")) {
  process.stdout.write(
    "[ios:trust-local-ca] notice: certutil is not installed (brew install nss). This is optional for iOS Safari but removes NSS trust-store warnings.\n"
  );
}

process.stdout.write(
  "[ios:trust-local-ca] running caddy trust. You may be prompted for your macOS password.\n"
);
const trustResult = spawnSync(caddyExecutable, ["trust", "--config", caddyConfigPath], {
  cwd,
  env: process.env,
  stdio: "inherit"
});

if (trustResult.status !== 0) {
  printError("caddy trust failed.", [
    `Exit status: ${String(trustResult.status ?? 1)}`,
    "Resolve the error above, then rerun:",
    "  pnpm ios:trust-local-ca"
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
      "  pnpm ios:trust-local-ca"
    ]);
    process.exit(1);
  }
}

process.stdout.write(`[ios:trust-local-ca] trusted certificate path: ${caddyRootCertificatePath}\n`);
process.stdout.write("[ios:trust-local-ca] success. Next step: pnpm ios:local\n");
