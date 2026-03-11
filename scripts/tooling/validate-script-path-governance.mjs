#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Enforces canonical repository path naming inside script-owned command surfaces.
 * This keeps script literals aligned with path-migration decisions.
 */
const LegacyPathRuleSchema = z
  .object({
    legacyPathFragment: z.string().trim().min(1),
    canonicalPathFragment: z.string().trim().min(1)
  })
  .strict();

const GovernanceViolationSchema = z
  .object({
    filePath: z.string().trim().min(1),
    lineNumber: z.number().int().positive(),
    legacyPathFragment: z.string().trim().min(1),
    canonicalPathFragment: z.string().trim().min(1),
    lineText: z.string()
  })
  .strict();

const LegacyPathRulesSchema = z.array(LegacyPathRuleSchema).min(1);
const GovernanceViolationsSchema = z.array(GovernanceViolationSchema);
const GovernanceExcludedScriptPathSchema = z.array(z.string().trim().min(1)).min(1);

const legacyPathRules = LegacyPathRulesSchema.parse([
  {
    legacyPathFragment: "apps/web",
    canonicalPathFragment: "apps/WebApplication"
  },
  {
    legacyPathFragment: "apps/server",
    canonicalPathFragment: "apps/ServerApplication"
  },
  {
    legacyPathFragment: "packages/codex-protocol",
    canonicalPathFragment: "packages/CodexProtocol"
  },
  {
    legacyPathFragment: "packages/codex-api",
    canonicalPathFragment: "packages/CodexInterfaceAdapter"
  },
  {
    legacyPathFragment: "packages/opencode-api",
    canonicalPathFragment: "packages/OpenCodeInterfaceAdapter"
  }
]);

const repositoryRootDirectoryPath = process.cwd();
const scriptsDirectoryPath = path.join(repositoryRootDirectoryPath, "scripts");
const governanceExcludedRelativeScriptPaths = new Set(
  GovernanceExcludedScriptPathSchema.parse([
    path.join("scripts", "tooling", "validate-script-path-governance.mjs")
  ]),
);

function fail(message) {
  process.stderr.write(`[script-path-governance] ${message}\n`);
  process.exit(1);
}

function collectScriptFilePaths(directoryPath) {
  const directoryEntries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  const collectedFilePaths = [];
  for (const directoryEntry of directoryEntries) {
    const absoluteEntryPath = path.join(directoryPath, directoryEntry.name);
    if (directoryEntry.isDirectory()) {
      collectedFilePaths.push(...collectScriptFilePaths(absoluteEntryPath));
      continue;
    }
    if (directoryEntry.isFile() && absoluteEntryPath.endsWith(".mjs")) {
      collectedFilePaths.push(absoluteEntryPath);
    }
  }

  return collectedFilePaths;
}

function collectFileViolations(scriptFilePath) {
  const relativeFilePath = path.relative(repositoryRootDirectoryPath, scriptFilePath);
  if (governanceExcludedRelativeScriptPaths.has(relativeFilePath)) {
    return [];
  }

  const fileLines = fs.readFileSync(scriptFilePath, "utf8").split(/\r?\n/);
  const violations = [];

  for (let lineIndex = 0; lineIndex < fileLines.length; lineIndex += 1) {
    const lineText = fileLines[lineIndex];
    for (const rule of legacyPathRules) {
      if (!lineText.includes(rule.legacyPathFragment)) {
        continue;
      }

      violations.push({
        filePath: relativeFilePath,
        lineNumber: lineIndex + 1,
        legacyPathFragment: rule.legacyPathFragment,
        canonicalPathFragment: rule.canonicalPathFragment,
        lineText: lineText.trim()
      });
    }
  }

  return violations;
}

function main() {
  if (!fs.existsSync(scriptsDirectoryPath)) {
    fail(`Missing scripts directory: ${scriptsDirectoryPath}`);
  }

  const scriptFilePaths = collectScriptFilePaths(scriptsDirectoryPath);
  if (scriptFilePaths.length === 0) {
    fail(`No script files found under ${scriptsDirectoryPath}`);
  }

  const violations = [];
  for (const scriptFilePath of scriptFilePaths) {
    violations.push(...collectFileViolations(scriptFilePath));
  }

  const parsedViolations = GovernanceViolationsSchema.parse(violations);
  if (parsedViolations.length > 0) {
    process.stderr.write(
      `[script-path-governance] Found ${String(parsedViolations.length)} legacy path reference(s):\n`
    );
    for (const violation of parsedViolations) {
      process.stderr.write(
        `- ${violation.filePath}:${String(violation.lineNumber)} contains "${violation.legacyPathFragment}". Use "${violation.canonicalPathFragment}"\n`
      );
      process.stderr.write(`  ${violation.lineText}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `[script-path-governance] Checked ${String(scriptFilePaths.length)} script files; no legacy path references found\n`
  );
}

main();
