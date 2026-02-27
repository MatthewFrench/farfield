#!/usr/bin/env node

import childProcess from "node:child_process";

const BiomeScopePrefixes = Object.freeze([
  "apps/ServerApplication/Source/",
  "apps/ServerApplication/Tests/",
  "apps/WebApplication/Source/",
  "apps/WebApplication/Tests/",
  "packages/CodexProtocol/Source/",
  "packages/CodexProtocol/Tests/",
  "packages/CodexInterfaceAdapter/Source/",
  "packages/CodexInterfaceAdapter/Tests/",
  "packages/OpenCodeInterfaceAdapter/Source/",
  "packages/OpenCodeInterfaceAdapter/Tests/",
]);

const BiomeScopeExactPaths = Object.freeze(["apps/WebApplication/vite.config.ts"]);

function fail(message) {
  process.stderr.write(`[biome-check-staged] ${message}\n`);
  process.exit(1);
}

function readStagedFilePaths() {
  const output = childProcess.execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return output
    .split(/\r?\n/)
    .map((filePath) => filePath.trim())
    .filter((filePath) => filePath.length > 0);
}

function isBiomeTargetPath(filePath) {
  if (BiomeScopeExactPaths.includes(filePath)) {
    return true;
  }

  return BiomeScopePrefixes.some((prefix) => filePath.startsWith(prefix));
}

function runBiomeCheck(filePaths) {
  const commandArguments = ["@biomejs/biome", "check", "--error-on-warnings", ...filePaths];
  const result = childProcess.spawnSync("bunx", commandArguments, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    fail(`Unable to execute bunx: ${result.error.message}`);
  }

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  if (result.signal) {
    fail(`Biome check terminated by signal ${result.signal}`);
  }

  fail("Biome check exited without status");
}

function main() {
  const stagedFilePaths = readStagedFilePaths();
  const stagedBiomeTargetPaths = stagedFilePaths.filter(isBiomeTargetPath);

  if (stagedBiomeTargetPaths.length === 0) {
    process.stdout.write(
      "[biome-check-staged] No staged files in Biome-managed source/test scope; skipping staged check\n",
    );
    return;
  }

  process.stdout.write(
    `[biome-check-staged] Running Biome check on ${String(stagedBiomeTargetPaths.length)} staged file(s)\n`,
  );
  runBiomeCheck(stagedBiomeTargetPaths);
}

main();
