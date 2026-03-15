#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const FeatureCoverageTrackerPath = path.join(
  process.cwd(),
  "docs/debug/AppServerFeatureCoverageTracker.md",
);
const RequestMethodDecisionLedgerPath = path.join(
  process.cwd(),
  "docs/debug/AppServerRequestMethodDecisionLedger.md",
);
const EventSurfaceDecisionLedgerPath = path.join(
  process.cwd(),
  "docs/debug/AppServerEventSurfaceDecisionLedger.md",
);
const UpstreamClientRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt",
);
const FarfieldClientRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt",
);
const RequestGovernanceScriptPath = path.join(
  process.cwd(),
  "scripts/tooling/validate-app-server-method-drift-governance.mjs",
);
const EventGovernanceScriptPath = path.join(
  process.cwd(),
  "scripts/tooling/validate-app-server-event-surface-governance.mjs",
);

const RequestMetricsSchema = z
  .object({
    keepMethods: z.number().int().nonnegative(),
    doNotAdoptMethods: z.number().int().nonnegative(),
    completionNumerator: z.number().int().nonnegative(),
    completionDenominator: z.number().int().positive(),
    antiCompletionMethodsUsed: z.number().int().nonnegative(),
  })
  .strict();
const EventMetricsSchema = z
  .object({
    upstreamServerNotifications: z.number().int().nonnegative(),
    upstreamServerRequests: z.number().int().nonnegative(),
    clientNotifications: z.number().int().nonnegative(),
    keepMethods: z.number().int().nonnegative(),
    doNotAdoptMethods: z.number().int().nonnegative(),
    keepMethodsActive: z.number().int().nonnegative(),
    doNotAdoptMethodsAvoided: z.number().int().nonnegative(),
    antiCompletionMethodsUsed: z.number().int().nonnegative(),
    completionNumerator: z.number().int().nonnegative(),
    completionDenominator: z.number().int().positive(),
    legacyUsageNumerator: z.number().int().nonnegative(),
    legacyUsageDenominator: z.number().int().positive(),
  })
  .strict();
const SyncModeSchema = z.enum(["write", "check"]);

const RequestMetricsBlockStart = "<!-- APP_SERVER_REQUEST_METRICS_START -->";
const RequestMetricsBlockEnd = "<!-- APP_SERVER_REQUEST_METRICS_END -->";
const EventMetricsBlockStart = "<!-- APP_SERVER_EVENT_METRICS_START -->";
const EventMetricsBlockEnd = "<!-- APP_SERVER_EVENT_METRICS_END -->";
const FeatureTrackerMetricsBlockStart = "<!-- APP_SERVER_FEATURE_TRACKER_METRICS_START -->";
const FeatureTrackerMetricsBlockEnd = "<!-- APP_SERVER_FEATURE_TRACKER_METRICS_END -->";

function fail(message) {
  process.stderr.write(`[sync-app-server-coverage-metrics] ${message}\n`);
  process.exit(1);
}

function runGovernanceScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    fail(`Governance script failed: ${scriptPath}`);
  }
  return result.stdout ?? "";
}

function parseNumericOutputLine(outputText, linePrefix) {
  const escapedPrefix = linePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = outputText.match(new RegExp(`^${escapedPrefix}\\s*(\\d+)$`, "m"));
  if (!match || match[1] === undefined) {
    fail(`Unable to parse governance output line: ${linePrefix}`);
  }
  return Number(match[1]);
}

function parseFractionOutputLine(outputText, linePrefix) {
  const escapedPrefix = linePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = outputText.match(new RegExp(`^${escapedPrefix}\\s*(\\d+)\\s*/\\s*(\\d+)$`, "m"));
  if (!match || match[1] === undefined || match[2] === undefined) {
    fail(`Unable to parse governance output line: ${linePrefix}`);
  }
  return {
    numerator: Number(match[1]),
    denominator: Number(match[2]),
  };
}

function parseRequestGovernanceMetrics(governanceOutputText) {
  const completion = parseFractionOutputLine(governanceOutputText, "- completion score:");
  return RequestMetricsSchema.parse({
    keepMethods: parseNumericOutputLine(governanceOutputText, "- keep methods:"),
    doNotAdoptMethods: parseNumericOutputLine(governanceOutputText, "- do-not-adopt methods:"),
    completionNumerator: completion.numerator,
    completionDenominator: completion.denominator,
    antiCompletionMethodsUsed: parseNumericOutputLine(
      governanceOutputText,
      "- anti-completion methods used:",
    ),
  });
}

function parseEventGovernanceMetrics(governanceOutputText) {
  const completion = parseFractionOutputLine(governanceOutputText, "- completion score:");
  const legacyUsage = parseFractionOutputLine(governanceOutputText, "- legacy raw usage metric:");
  return EventMetricsSchema.parse({
    upstreamServerNotifications: parseNumericOutputLine(
      governanceOutputText,
      "- upstream server-notification methods:",
    ),
    upstreamServerRequests: parseNumericOutputLine(
      governanceOutputText,
      "- upstream server-request methods:",
    ),
    clientNotifications: parseNumericOutputLine(
      governanceOutputText,
      "- client-notification methods:",
    ),
    keepMethods: parseNumericOutputLine(governanceOutputText, "- keep methods:"),
    doNotAdoptMethods: parseNumericOutputLine(governanceOutputText, "- do-not-adopt methods:"),
    keepMethodsActive: parseNumericOutputLine(
      governanceOutputText,
      "- keep methods actively consumed or used:",
    ),
    doNotAdoptMethodsAvoided: parseNumericOutputLine(
      governanceOutputText,
      "- do-not-adopt methods avoided:",
    ),
    antiCompletionMethodsUsed: parseNumericOutputLine(
      governanceOutputText,
      "- anti-completion methods consumed or used:",
    ),
    completionNumerator: completion.numerator,
    completionDenominator: completion.denominator,
    legacyUsageNumerator: legacyUsage.numerator,
    legacyUsageDenominator: legacyUsage.denominator,
  });
}

function readSnapshotMethods(snapshotPath) {
  const snapshotText = fs.readFileSync(snapshotPath, "utf8");
  return snapshotText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function replaceMarkedBlock(sourceText, blockStart, blockEnd, nextBlockBody) {
  const blockPattern = new RegExp(
    `${blockStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${blockEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "m",
  );
  if (!blockPattern.test(sourceText)) {
    fail(`Missing metrics block markers: ${blockStart} ... ${blockEnd}`);
  }
  return sourceText.replace(blockPattern, `${blockStart}\n${nextBlockBody}\n${blockEnd}`);
}

function formatPercent(numerator, denominator) {
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function main() {
  const mode = SyncModeSchema.parse(process.argv.includes("--check") ? "check" : "write");
  const requestGovernanceOutput = runGovernanceScript(RequestGovernanceScriptPath);
  const eventGovernanceOutput = runGovernanceScript(EventGovernanceScriptPath);
  const requestMetrics = parseRequestGovernanceMetrics(requestGovernanceOutput);
  const eventMetrics = parseEventGovernanceMetrics(eventGovernanceOutput);

  const upstreamRequestMethods = readSnapshotMethods(UpstreamClientRequestMethodSnapshotPath);
  const farfieldRequestMethods = readSnapshotMethods(FarfieldClientRequestMethodSnapshotPath);
  const keepOwnerMethodCount = requestMetrics.keepMethods - 1;
  const keepOwnerMethodUsedCount = farfieldRequestMethods.length - 1;
  const transportKeepMethodCount = 1;
  const transportKeepMethodUsedCount = 1;
  const doNotAdoptAvoidedCount =
    requestMetrics.doNotAdoptMethods - requestMetrics.antiCompletionMethodsUsed;

  const requestLedgerOriginal = fs.readFileSync(RequestMethodDecisionLedgerPath, "utf8");
  const eventLedgerOriginal = fs.readFileSync(EventSurfaceDecisionLedgerPath, "utf8");
  const featureTrackerOriginal = fs.readFileSync(FeatureCoverageTrackerPath, "utf8");

  const requestMetricsBlockBody = [
    `Total methods: ${String(upstreamRequestMethods.length)}`,
    `Keep methods: ${String(requestMetrics.keepMethods)}`,
    `Do-not-adopt methods: ${String(requestMetrics.doNotAdoptMethods)}`,
    `Keep methods used now: ${String(farfieldRequestMethods.length)}`,
    `Do-not-adopt methods avoided (not used): ${String(doNotAdoptAvoidedCount)}`,
    `Do-not-adopt methods used now (anti-completion): ${String(requestMetrics.antiCompletionMethodsUsed)}`,
    `Policy completion score (\`keep used + do-not-adopt avoided - do-not-adopt used\`): ${String(requestMetrics.completionNumerator)} / ${String(requestMetrics.completionDenominator)}`,
    `Legacy raw usage metric (reference only): ${String(farfieldRequestMethods.length)} / ${String(upstreamRequestMethods.length)}`,
  ].join("\n");
  const eventMetricsBlockBody = [
    `Server notifications: ${String(eventMetrics.upstreamServerNotifications)}`,
    `Server requests: ${String(eventMetrics.upstreamServerRequests)}`,
    `Client notifications: ${String(eventMetrics.clientNotifications)}`,
    `Keep methods: ${String(eventMetrics.keepMethods)}`,
    `Do-not-adopt methods: ${String(eventMetrics.doNotAdoptMethods)}`,
    `Keep methods actively consumed or used: ${String(eventMetrics.keepMethodsActive)}`,
    `Do-not-adopt methods avoided (not consumed or used): ${String(eventMetrics.doNotAdoptMethodsAvoided)}`,
    `Do-not-adopt methods consumed or used (anti-completion): ${String(eventMetrics.antiCompletionMethodsUsed)}`,
    `Policy completion score (\`keep active + do-not-adopt avoided - do-not-adopt active\`): ${String(eventMetrics.completionNumerator)} / ${String(eventMetrics.completionDenominator)}`,
    `Legacy raw usage metric (reference only): ${String(eventMetrics.legacyUsageNumerator)} / ${String(eventMetrics.legacyUsageDenominator)}`,
  ].join("\n");
  const featureTrackerMetricsBlockBody = [
    `1. Keep-recommendation coverage at request-owner layer: \`${String(keepOwnerMethodUsedCount)} / ${String(keepOwnerMethodCount)}\` (\`${formatPercent(keepOwnerMethodUsedCount, keepOwnerMethodCount)}\`).`,
    `2. Keep-recommendation coverage at transport handshake layer (\`initialize\`): \`${String(transportKeepMethodUsedCount)} / ${String(transportKeepMethodCount)}\` (\`${formatPercent(transportKeepMethodUsedCount, transportKeepMethodCount)}\`).`,
    `3. Keep-recommendation coverage including transport-owned \`initialize\`: \`${String(farfieldRequestMethods.length)} / ${String(requestMetrics.keepMethods)}\` (\`${formatPercent(farfieldRequestMethods.length, requestMetrics.keepMethods)}\`).`,
    `4. Do-not-adopt avoidance completion: \`${String(doNotAdoptAvoidedCount)} / ${String(requestMetrics.doNotAdoptMethods)}\` (\`${formatPercent(doNotAdoptAvoidedCount, requestMetrics.doNotAdoptMethods)}\`).`,
    `5. Anti-completion count (methods marked \`Do not adopt\` that are still used): \`${String(requestMetrics.antiCompletionMethodsUsed)}\`.`,
    `6. Policy completion score (\`keep used + do-not-adopt avoided - do-not-adopt used\`): \`${String(requestMetrics.completionNumerator)} / ${String(requestMetrics.completionDenominator)}\` (\`${formatPercent(requestMetrics.completionNumerator, requestMetrics.completionDenominator)}\`).`,
    `7. Legacy raw usage metric across all upstream request methods (reference only, not completion): \`${String(farfieldRequestMethods.length)} / ${String(upstreamRequestMethods.length)}\` (\`${formatPercent(farfieldRequestMethods.length, upstreamRequestMethods.length)}\`).`,
    `8. Event-surface policy completion score (\`keep active + do-not-adopt avoided - do-not-adopt active\`): \`${String(eventMetrics.completionNumerator)} / ${String(eventMetrics.completionDenominator)}\` (\`${formatPercent(eventMetrics.completionNumerator, eventMetrics.completionDenominator)}\`); anti-completion events used: \`${String(eventMetrics.antiCompletionMethodsUsed)}\`.`,
  ].join("\n");

  const requestLedgerNext = replaceMarkedBlock(
    requestLedgerOriginal,
    RequestMetricsBlockStart,
    RequestMetricsBlockEnd,
    requestMetricsBlockBody,
  );
  const eventLedgerNext = replaceMarkedBlock(
    eventLedgerOriginal,
    EventMetricsBlockStart,
    EventMetricsBlockEnd,
    eventMetricsBlockBody,
  );
  const featureTrackerNext = replaceMarkedBlock(
    featureTrackerOriginal,
    FeatureTrackerMetricsBlockStart,
    FeatureTrackerMetricsBlockEnd,
    featureTrackerMetricsBlockBody,
  );

  const changedPaths = [];
  if (requestLedgerOriginal !== requestLedgerNext) {
    changedPaths.push(RequestMethodDecisionLedgerPath);
    if (mode === "write") {
      fs.writeFileSync(RequestMethodDecisionLedgerPath, requestLedgerNext, "utf8");
    }
  }
  if (eventLedgerOriginal !== eventLedgerNext) {
    changedPaths.push(EventSurfaceDecisionLedgerPath);
    if (mode === "write") {
      fs.writeFileSync(EventSurfaceDecisionLedgerPath, eventLedgerNext, "utf8");
    }
  }
  if (featureTrackerOriginal !== featureTrackerNext) {
    changedPaths.push(FeatureCoverageTrackerPath);
    if (mode === "write") {
      fs.writeFileSync(FeatureCoverageTrackerPath, featureTrackerNext, "utf8");
    }
  }

  if (mode === "check" && changedPaths.length > 0) {
    process.stderr.write(
      "[sync-app-server-coverage-metrics] Coverage docs are out of date. Run `bun run sync:app-server-coverage-metrics`.\n",
    );
    for (const changedPath of changedPaths) {
      process.stderr.write(`- ${changedPath}\n`);
    }
    process.exit(1);
  }

  const resultPrefix = mode === "check" ? "checked" : "updated";
  process.stdout.write(
    `[sync-app-server-coverage-metrics] Coverage metrics ${resultPrefix}; changed files: ${String(changedPaths.length)}\n`,
  );
}

main();
