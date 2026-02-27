#!/usr/bin/env node

import childProcess from "node:child_process";
import path from "node:path";

const DisallowedLockfileBaseNames = Object.freeze(["package-lock.json", "yarn.lock"]);

function readTrackedFilePaths() {
  const output = childProcess.execFileSync("git", ["ls-files"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/)
    .map((filePath) => filePath.trim())
    .filter((filePath) => filePath.length > 0);
}

function isDisallowedLockfilePath(filePath) {
  const fileBaseName = path.basename(filePath);
  return DisallowedLockfileBaseNames.includes(fileBaseName);
}

function main() {
  const trackedFilePaths = readTrackedFilePaths();
  const disallowedLockfilePaths = trackedFilePaths.filter(isDisallowedLockfilePath);

  if (disallowedLockfilePaths.length > 0) {
    process.stderr.write(
      `[lockfile-governance] Found disallowed lockfiles (${disallowedLockfilePaths.length}):\n`,
    );

    for (const disallowedLockfilePath of disallowedLockfilePaths) {
      process.stderr.write(`- ${disallowedLockfilePath}\n`);
    }

    process.stderr.write(
      `[lockfile-governance] This repository uses bun.lock only; remove the files above and rerun checks\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `[lockfile-governance] Checked ${trackedFilePaths.length} tracked files; no disallowed lockfiles found\n`,
  );
}

main();
