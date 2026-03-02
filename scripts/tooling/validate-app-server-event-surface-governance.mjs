#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const UpstreamServerNotificationMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerUpstreamServerNotificationMethods.snapshot.txt",
);
const UpstreamServerRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerUpstreamServerRequestMethods.snapshot.txt",
);
const FarfieldServerRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerFarfieldServerRequestMethods.snapshot.txt",
);
const EventSurfaceDecisionLedgerPath = path.join(
  process.cwd(),
  "docs/debug/AppServerEventSurfaceDecisionLedger.md",
);
const FarfieldTransportConstantsPath = path.join(
  process.cwd(),
  "packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts",
);

const InitializeNotificationMethodPattern =
  /APP_SERVER_INITIALIZED_NOTIFICATION_METHOD\s*=\s*"([^"]+)"/;
const EventLedgerRowPattern =
  /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/;
const DoNotAdoptRecommendationPrefix = "Do not adopt";
const SurfaceTypeByName = {
  serverNotification: "server-to-client notification",
  serverRequest: "server-to-client request",
  clientNotification: "client-to-server notification",
};

const MethodNameSchema = z.string().trim().min(1);
const MethodNameListSchema = z.array(MethodNameSchema);
const EventSurfaceTypeSchema = z.enum([
  SurfaceTypeByName.serverNotification,
  SurfaceTypeByName.serverRequest,
  SurfaceTypeByName.clientNotification,
]);
const EventSurfaceDecisionRowSchema = z
  .object({
    method: MethodNameSchema,
    surfaceType: EventSurfaceTypeSchema,
    state: z.string().trim().min(1),
    recommendation: z.string().trim().min(1),
  })
  .strict();
const EventSurfaceDecisionRowListSchema = z.array(EventSurfaceDecisionRowSchema);

function fail(message) {
  process.stderr.write(`[app-server-event-surface-governance] ${message}\n`);
  process.exit(1);
}

function readTextOrFail(filePath, description) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${description}: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function toSortedUniqueMethodList(methods) {
  return [...new Set(MethodNameListSchema.parse(methods))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function readSnapshotMethods(snapshotPath, description) {
  const snapshotText = readTextOrFail(snapshotPath, description);
  const methods = snapshotText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  return toSortedUniqueMethodList(methods);
}

function parseInitializedNotificationMethod(transportConstantsSourceText) {
  const initializeMethodMatch = transportConstantsSourceText.match(
    InitializeNotificationMethodPattern,
  );
  if (!initializeMethodMatch || initializeMethodMatch[1] === undefined) {
    fail("Unable to parse APP_SERVER_INITIALIZED_NOTIFICATION_METHOD from transport constants");
  }
  return MethodNameSchema.parse(initializeMethodMatch[1]);
}

function parseEventSurfaceDecisionLedgerRows(eventSurfaceDecisionLedgerText) {
  const rows = [];
  for (const rawLine of eventSurfaceDecisionLedgerText.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();
    const match = trimmedLine.match(EventLedgerRowPattern);
    if (
      !match ||
      match[1] === undefined ||
      match[2] === undefined ||
      match[3] === undefined ||
      match[4] === undefined
    ) {
      continue;
    }

    rows.push(
      EventSurfaceDecisionRowSchema.parse({
        method: match[1],
        surfaceType: match[2].trim(),
        state: match[3].trim(),
        recommendation: match[4].trim(),
      }),
    );
  }

  const parsedRows = EventSurfaceDecisionRowListSchema.parse(rows);
  if (parsedRows.length === 0) {
    fail("Unable to parse method rows from app-server event-surface decision ledger");
  }
  return parsedRows;
}

function createMethodSetDifference(leftMethods, rightMethods) {
  const rightSet = new Set(rightMethods);
  return leftMethods.filter((method) => !rightSet.has(method));
}

function assertMethodListsEqual(description, expectedMethods, actualMethods) {
  const addedMethods = createMethodSetDifference(actualMethods, expectedMethods);
  const removedMethods = createMethodSetDifference(expectedMethods, actualMethods);
  if (addedMethods.length === 0 && removedMethods.length === 0) {
    return;
  }

  process.stderr.write(`[app-server-event-surface-governance] ${description} mismatch\n`);
  if (addedMethods.length > 0) {
    process.stderr.write("[app-server-event-surface-governance] Added methods:\n");
    for (const method of addedMethods) {
      process.stderr.write(`+ ${method}\n`);
    }
  }
  if (removedMethods.length > 0) {
    process.stderr.write("[app-server-event-surface-governance] Removed methods:\n");
    for (const method of removedMethods) {
      process.stderr.write(`- ${method}\n`);
    }
  }
  process.exit(1);
}

function assertNoDuplicateMethods(rows) {
  const seenMethods = new Set();
  const duplicateMethods = [];
  for (const row of rows) {
    if (seenMethods.has(row.method)) {
      duplicateMethods.push(row.method);
      continue;
    }
    seenMethods.add(row.method);
  }

  if (duplicateMethods.length === 0) {
    return;
  }

  process.stderr.write(
    "[app-server-event-surface-governance] Event-surface decision ledger contains duplicate methods\n",
  );
  for (const method of toSortedUniqueMethodList(duplicateMethods)) {
    process.stderr.write(`- ${method}\n`);
  }
  process.exit(1);
}

function stateIndicatesActiveUsage(state) {
  return state.startsWith("Consumed") || state === "Used now";
}

function recommendationIndicatesDoNotAdopt(recommendation) {
  return recommendation.startsWith(DoNotAdoptRecommendationPrefix);
}

function main() {
  const upstreamServerNotificationMethods = readSnapshotMethods(
    UpstreamServerNotificationMethodSnapshotPath,
    "upstream app-server server-notification method snapshot",
  );
  const upstreamServerRequestMethods = readSnapshotMethods(
    UpstreamServerRequestMethodSnapshotPath,
    "upstream app-server server-request method snapshot",
  );
  const farfieldServerRequestMethods = readSnapshotMethods(
    FarfieldServerRequestMethodSnapshotPath,
    "Farfield app-server server-request method snapshot",
  );
  const transportConstantsSourceText = readTextOrFail(
    FarfieldTransportConstantsPath,
    "Farfield app-server transport constants",
  );
  const initializedNotificationMethod = parseInitializedNotificationMethod(
    transportConstantsSourceText,
  );

  const eventSurfaceDecisionLedgerText = readTextOrFail(
    EventSurfaceDecisionLedgerPath,
    "app-server event-surface decision ledger",
  );
  const eventSurfaceDecisionRows = parseEventSurfaceDecisionLedgerRows(
    eventSurfaceDecisionLedgerText,
  );
  assertNoDuplicateMethods(eventSurfaceDecisionRows);

  const expectedMethodList = toSortedUniqueMethodList([
    ...upstreamServerNotificationMethods,
    ...upstreamServerRequestMethods,
    initializedNotificationMethod,
  ]);
  const ledgerMethodList = toSortedUniqueMethodList(
    eventSurfaceDecisionRows.map((row) => row.method),
  );
  assertMethodListsEqual(
    "App-server event-surface decision ledger method list drift",
    expectedMethodList,
    ledgerMethodList,
  );

  const upstreamServerNotificationMethodSet = new Set(upstreamServerNotificationMethods);
  const upstreamServerRequestMethodSet = new Set(upstreamServerRequestMethods);

  const invalidSurfaceRows = [];
  for (const row of eventSurfaceDecisionRows) {
    if (row.surfaceType === SurfaceTypeByName.serverNotification) {
      if (upstreamServerNotificationMethodSet.has(row.method)) {
        continue;
      }
      invalidSurfaceRows.push(`${row.method} expected server-notification membership`);
      continue;
    }

    if (row.surfaceType === SurfaceTypeByName.serverRequest) {
      if (upstreamServerRequestMethodSet.has(row.method)) {
        continue;
      }
      invalidSurfaceRows.push(`${row.method} expected server-request membership`);
      continue;
    }

    if (row.surfaceType === SurfaceTypeByName.clientNotification) {
      if (row.method === initializedNotificationMethod) {
        continue;
      }
      invalidSurfaceRows.push(
        `${row.method} expected only client notification method ${initializedNotificationMethod}`,
      );
    }
  }

  if (invalidSurfaceRows.length > 0) {
    process.stderr.write(
      "[app-server-event-surface-governance] Event-surface decision ledger contains invalid surface-type mappings\n",
    );
    for (const invalidSurfaceRow of invalidSurfaceRows) {
      process.stderr.write(`- ${invalidSurfaceRow}\n`);
    }
    process.exit(1);
  }

  const usedServerRequestMethodsFromLedger = toSortedUniqueMethodList(
    eventSurfaceDecisionRows
      .filter(
        (row) =>
          row.surfaceType === SurfaceTypeByName.serverRequest &&
          stateIndicatesActiveUsage(row.state),
      )
      .map((row) => row.method),
  );
  assertMethodListsEqual(
    "App-server event-surface decision ledger used server-request rows drift",
    farfieldServerRequestMethods,
    usedServerRequestMethodsFromLedger,
  );

  const initializedRows = eventSurfaceDecisionRows.filter(
    (row) => row.surfaceType === SurfaceTypeByName.clientNotification,
  );
  if (initializedRows.length !== 1 || !stateIndicatesActiveUsage(initializedRows[0].state)) {
    fail(
      `Event-surface decision ledger must include exactly one active client-notification row for ${initializedNotificationMethod}`,
    );
  }

  const keepRows = eventSurfaceDecisionRows.filter(
    (row) => !recommendationIndicatesDoNotAdopt(row.recommendation),
  );
  const doNotAdoptRows = eventSurfaceDecisionRows.filter((row) =>
    recommendationIndicatesDoNotAdopt(row.recommendation),
  );
  const keepActiveRows = keepRows.filter((row) => stateIndicatesActiveUsage(row.state));
  const doNotAdoptAvoidedRows = doNotAdoptRows.filter(
    (row) => !stateIndicatesActiveUsage(row.state),
  );
  const doNotAdoptActiveRows = doNotAdoptRows.filter((row) => stateIndicatesActiveUsage(row.state));
  if (doNotAdoptActiveRows.length > 0) {
    process.stderr.write(
      '[app-server-event-surface-governance] Anti-completion event methods detected: methods marked "Do not adopt" are currently consumed or used\n',
    );
    for (const row of doNotAdoptActiveRows) {
      process.stderr.write(`- ${row.method}\n`);
    }
    process.exit(1);
  }

  const eventCompletionScoreNumerator = keepActiveRows.length + doNotAdoptAvoidedRows.length;
  const eventCompletionScoreDenominator = eventSurfaceDecisionRows.length;
  const legacyRawUsageNumerator = eventSurfaceDecisionRows.filter((row) =>
    stateIndicatesActiveUsage(row.state),
  ).length;
  const legacyRawUsageDenominator = eventSurfaceDecisionRows.length;

  process.stdout.write(
    [
      "[app-server-event-surface-governance] Event-surface ledger verified",
      `- upstream server-notification methods: ${String(upstreamServerNotificationMethods.length)}`,
      `- upstream server-request methods: ${String(upstreamServerRequestMethods.length)}`,
      `- client-notification methods: 1`,
      `- keep methods: ${String(keepRows.length)}`,
      `- do-not-adopt methods: ${String(doNotAdoptRows.length)}`,
      `- keep methods actively consumed or used: ${String(keepActiveRows.length)}`,
      `- do-not-adopt methods avoided: ${String(doNotAdoptAvoidedRows.length)}`,
      `- anti-completion methods consumed or used: ${String(doNotAdoptActiveRows.length)}`,
      `- completion score: ${String(eventCompletionScoreNumerator)} / ${String(eventCompletionScoreDenominator)}`,
      `- legacy raw usage metric: ${String(legacyRawUsageNumerator)} / ${String(legacyRawUsageDenominator)}`,
    ].join("\n") + "\n",
  );
}

main();
