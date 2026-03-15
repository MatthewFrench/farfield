#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";

/**
 * Owns Codex app-server schema generation and protocol regeneration wiring.
 * Canonical package-path ownership is enforced here so script paths stay aligned after renames.
 */
const root = process.cwd();
const codexProtocolPackageDirectoryPath = path.join(root, "packages", "CodexProtocol");
const defaultOutDir = path.join(
  codexProtocolPackageDirectoryPath,
  "vendor",
  "codex-app-server-schema"
);

const SpawnEnvironmentSchema = z.record(z.string().min(1), z.string());

const SPAWN_ENVIRONMENT_EXACT_KEYS = new Set([
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

const SPAWN_ENVIRONMENT_PREFIXES = [
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

function shouldIncludeSpawnEnvironmentKey(environmentKey) {
  if (SPAWN_ENVIRONMENT_EXACT_KEYS.has(environmentKey)) {
    return true;
  }

  return SPAWN_ENVIRONMENT_PREFIXES.some((prefix) => environmentKey.startsWith(prefix));
}

function buildSpawnEnvironment(sourceEnvironment) {
  const spawnEnvironment = {};

  for (const [environmentKey, environmentValue] of Object.entries(sourceEnvironment)) {
    if (!shouldIncludeSpawnEnvironmentKey(environmentKey)) {
      continue;
    }
    if (typeof environmentValue !== "string") {
      continue;
    }
    spawnEnvironment[environmentKey] = environmentValue;
  }

  return SpawnEnvironmentSchema.parse(spawnEnvironment);
}

const spawnEnvironment = buildSpawnEnvironment(process.env);

function printHelp() {
  process.stdout.write(
    [
      "Usage: bun run generate:codex-schema [--out <dir>] [--codex <path>]",
      "",
      "Options:",
      "  --out <dir>      Output directory",
      "  --codex <path>   Path to codex executable",
      "  --help           Show this help message"
    ].join("\n")
  );
  process.stdout.write("\n");
}

function parseArgs(argv) {
  const result = {
    outDir: defaultOutDir,
    codexPath: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--out") {
      const nextArg = argv[index + 1];
      if (!nextArg || nextArg.startsWith("--")) {
        process.stderr.write("Missing value for --out\n");
        process.exit(1);
      }
      result.outDir = path.resolve(root, nextArg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      result.outDir = path.resolve(root, arg.slice("--out=".length));
      continue;
    }

    if (arg === "--codex") {
      const nextArg = argv[index + 1];
      if (!nextArg || nextArg.startsWith("--")) {
        process.stderr.write("Missing value for --codex\n");
        process.exit(1);
      }
      result.codexPath = nextArg;
      index += 1;
      continue;
    }

    if (arg.startsWith("--codex=")) {
      result.codexPath = arg.slice("--codex=".length);
      continue;
    }

    process.stderr.write(`Unknown argument: ${arg}\n`);
    process.exit(1);
  }

  return result;
}

function resolveCodexExecutable(explicitPath) {
  if (explicitPath.trim().length > 0) {
    return explicitPath;
  }

  if (process.env["CODEX_CLI_PATH"]) {
    return process.env["CODEX_CLI_PATH"];
  }

  const desktopPath = "/Applications/Codex.app/Contents/Resources/codex";
  if (fs.existsSync(desktopPath)) {
    return desktopPath;
  }

  return process.platform === "win32" ? "codex.cmd" : "codex";
}

function runCodex(codexExecutable, args, label) {
  const result = spawnSync(codexExecutable, args, {
    stdio: "inherit",
    env: spawnEnvironment
  });

  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error);
    process.stderr.write(`Failed to run ${label}: ${message}\n`);
    if (String(message).includes("ENOENT")) {
      process.stderr.write(
        [
          "Could not find the codex executable.",
          "Install Codex CLI or pass --codex /path/to/codex.",
          "You can also set CODEX_CLI_PATH."
        ].join("\n")
      );
      process.stderr.write("\n");
    }
    return 1;
  }

  return typeof result.status === "number" ? result.status : 1;
}

function readCodexVersion(codexExecutable) {
  const result = spawnSync(codexExecutable, ["--version"], {
    encoding: "utf8",
    env: spawnEnvironment
  });
  if (result.error || result.status !== 0) {
    return "unknown";
  }
  const text = (result.stdout ?? "").trim();
  return text.length > 0 ? text : "unknown";
}

function runBunScript(script, cwd) {
  const bunExecutable = process.platform === "win32" ? "bun.exe" : "bun";
  const result = spawnSync(bunExecutable, ["run", script], {
    cwd,
    stdio: "inherit",
    env: spawnEnvironment
  });

  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error);
    process.stderr.write(`Failed to run ${script}: ${message}\n`);
    return 1;
  }

  return typeof result.status === "number" ? result.status : 1;
}

function generateVariant(codexExecutable, outDir, variantName, experimental) {
  const variantDir = path.join(outDir, variantName);
  const tsDir = path.join(variantDir, "typescript");
  const jsonDir = path.join(variantDir, "json");

  fs.rmSync(variantDir, { recursive: true, force: true });
  fs.mkdirSync(variantDir, { recursive: true });

  const extraArgs = experimental ? ["--experimental"] : [];

  const tsStatus = runCodex(
    codexExecutable,
    ["app-server", "generate-ts", "--out", tsDir, ...extraArgs],
    `${variantName} TypeScript schema generation`
  );
  if (tsStatus !== 0) {
    process.exit(tsStatus);
  }

  const jsonStatus = runCodex(
    codexExecutable,
    ["app-server", "generate-json-schema", "--out", jsonDir, ...extraArgs],
    `${variantName} JSON schema generation`
  );
  if (jsonStatus !== 0) {
    process.exit(jsonStatus);
  }
}

function writeMetadataFile(codexExecutable, outDir) {
  const metadata = {
    generatedAt: new Date().toISOString(),
    codexExecutable,
    codexVersion: readCodexVersion(codexExecutable),
    outputs: {
      stable: {
        typescript: "stable/typescript",
        json: "stable/json"
      },
      experimental: {
        typescript: "experimental/typescript",
        json: "experimental/json"
      }
    }
  };

  fs.writeFileSync(path.join(outDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

function main() {
  if (!fs.existsSync(codexProtocolPackageDirectoryPath)) {
    process.stderr.write(
      `Missing protocol package directory: ${codexProtocolPackageDirectoryPath}\n`
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const codexExecutable = resolveCodexExecutable(args.codexPath);
  const outDir = args.outDir;

  fs.mkdirSync(outDir, { recursive: true });

  process.stdout.write(`Using codex executable: ${codexExecutable}\n`);
  process.stdout.write(`Writing schema outputs to: ${outDir}\n`);

  generateVariant(codexExecutable, outDir, "stable", false);
  generateVariant(codexExecutable, outDir, "experimental", true);
  writeMetadataFile(codexExecutable, outDir);

  const generateProtocolSchemasStatus = runBunScript(
    "generate:app-server-zod",
    codexProtocolPackageDirectoryPath
  );
  if (generateProtocolSchemasStatus !== 0) {
    process.exit(generateProtocolSchemasStatus);
  }

  process.stdout.write("Done. Generated stable and experimental schema outputs and protocol Zod modules.\n");
}

main();
