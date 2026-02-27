#!/usr/bin/env node

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SupportedCodeExtensions = Object.freeze([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

const MinimumIgnoreReasonLengthCharacters = 12;
const PlaceholderIgnoreReasonPattern = /^(todo|temporary|temp|fixme|ignore|n\/a)$/i;
const IgnoreDirectiveCommentPattern = /(\/\/|\/\*)\s*biome-ignore(?:-all)?\b/;
const IgnoreDirectiveReasonPattern = /biome-ignore(?:-all)?(?:\s+[^:]+)?\s*:\s*(.+?)\s*(?:\*\/)?$/;

function readTrackedRepositoryFilePaths() {
  const output = childProcess.execFileSync("git", ["ls-files"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/)
    .map((filePath) => filePath.trim())
    .filter((filePath) => filePath.length > 0);
}

function isSupportedCodeFile(filePath) {
  return SupportedCodeExtensions.some((extension) => filePath.endsWith(extension));
}

function collectBiomeIgnoreViolations(filePath) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split(/\r?\n/);
  const violations = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!IgnoreDirectiveCommentPattern.test(line)) {
      continue;
    }

    const reasonMatch = line.match(IgnoreDirectiveReasonPattern);
    if (!reasonMatch) {
      violations.push({
        lineNumber: lineIndex + 1,
        reason: "Missing rationale after ':'",
        lineText: line.trim(),
      });
      continue;
    }

    const reason = reasonMatch[1].trim();
    if (reason.length < MinimumIgnoreReasonLengthCharacters) {
      violations.push({
        lineNumber: lineIndex + 1,
        reason: `Rationale must be at least ${String(MinimumIgnoreReasonLengthCharacters)} characters`,
        lineText: line.trim(),
      });
      continue;
    }

    if (PlaceholderIgnoreReasonPattern.test(reason)) {
      violations.push({
        lineNumber: lineIndex + 1,
        reason: "Rationale must be specific and not placeholder text",
        lineText: line.trim(),
      });
    }
  }

  return violations;
}

function main() {
  const trackedFilePaths = readTrackedRepositoryFilePaths();
  const codeFilePaths = trackedFilePaths.filter(isSupportedCodeFile);
  const violations = [];

  for (const codeFilePath of codeFilePaths) {
    const absoluteFilePath = path.join(process.cwd(), codeFilePath);
    const fileViolations = collectBiomeIgnoreViolations(absoluteFilePath);
    for (const fileViolation of fileViolations) {
      violations.push({
        filePath: codeFilePath,
        lineNumber: fileViolation.lineNumber,
        reason: fileViolation.reason,
        lineText: fileViolation.lineText,
      });
    }
  }

  if (violations.length > 0) {
    process.stderr.write(
      `[biome-ignore-governance] Found ${String(violations.length)} invalid biome-ignore directive(s):\n`,
    );

    for (const violation of violations) {
      process.stderr.write(
        `- ${violation.filePath}:${String(violation.lineNumber)} ${violation.reason}\n`,
      );
      process.stderr.write(`  ${violation.lineText}\n`);
    }

    process.exit(1);
  }

  process.stdout.write(
    `[biome-ignore-governance] Checked ${String(codeFilePaths.length)} code files; ignore directives are valid\n`,
  );
}

main();
