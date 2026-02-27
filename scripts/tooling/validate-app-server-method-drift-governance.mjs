#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Enforces app-server method governance by comparing:
 * 1) upstream protocol method extraction against a tracked upstream snapshot, and
 * 2) Farfield owned method extraction against a tracked Farfield snapshot.
 *
 * CI should fail when upstream adds/removes request methods until the snapshot
 * and tracker are intentionally updated.
 */
const UpstreamClientRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt",
);
const FarfieldClientRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt",
);
const FarfieldMethodConstantsPath = path.join(
  process.cwd(),
  "packages/CodexInterfaceAdapter/Source/AppServerClientMethodConstants.ts",
);
const FarfieldTransportConstantsPath = path.join(
  process.cwd(),
  "packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts",
);

const UpstreamCommonSourceDefaultUrl =
  "https://raw.githubusercontent.com/openai/codex/main/codex-rs/app-server-protocol/src/protocol/common.rs";
const UpstreamCommonSourcePathEnvironmentVariableName =
  "APP_SERVER_METHOD_DRIFT_UPSTREAM_COMMON_RS_PATH";
const UpstreamCommonSourceUrlEnvironmentVariableName =
  "APP_SERVER_METHOD_DRIFT_UPSTREAM_COMMON_RS_URL";

const ClientRequestMacroBlockStart = "client_request_definitions! {";
const ClientRequestMacroBlockEnd = "/// Generates an `enum ServerRequest`";
const MethodConstantsBlockPattern = /APP_SERVER_CLIENT_METHODS\s*=\s*\{([\s\S]*?)\}\s*as const/;
const MethodStringPattern = /:\s*"([^"]+)"/g;
const InitializeMethodPattern = /APP_SERVER_INITIALIZE_METHOD\s*=\s*"([^"]+)"/;
const MacroVariantPattern = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:=>\s*"([^"]+)")?\s*\{/gm;

const MethodNameSchema = z.string().trim().min(1);
const MethodNameListSchema = z.array(MethodNameSchema);

function fail(message) {
  process.stderr.write(`[app-server-method-drift] ${message}\n`);
  process.exit(1);
}

function toLowerCamelCaseFromPascalCase(value) {
  if (value.length === 0) {
    return value;
  }
  return value[0].toLowerCase() + value.slice(1);
}

function toSortedUniqueMethodList(methods) {
  return [...new Set(MethodNameListSchema.parse(methods))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function readTextOrFail(filePath, description) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${description}: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function readSnapshotMethods(snapshotPath, description) {
  const snapshotText = readTextOrFail(snapshotPath, description);
  const methods = snapshotText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  return toSortedUniqueMethodList(methods);
}

function extractClientRequestMacroBlock(commonSourceText) {
  const startIndex = commonSourceText.indexOf(ClientRequestMacroBlockStart);
  if (startIndex < 0) {
    fail(`Missing upstream macro block start marker: ${ClientRequestMacroBlockStart}`);
  }

  const endIndex = commonSourceText.indexOf(ClientRequestMacroBlockEnd, startIndex);
  if (endIndex < 0) {
    fail(`Missing upstream macro block end marker: ${ClientRequestMacroBlockEnd}`);
  }

  return commonSourceText.slice(startIndex, endIndex);
}

function parseUpstreamClientRequestMethods(commonSourceText) {
  const macroBlock = extractClientRequestMacroBlock(commonSourceText);
  const methods = [];

  for (const match of macroBlock.matchAll(MacroVariantPattern)) {
    const variantName = MethodNameSchema.parse(match[1]);
    const explicitWireMethod = match[2];
    methods.push(
      explicitWireMethod !== undefined
        ? MethodNameSchema.parse(explicitWireMethod)
        : toLowerCamelCaseFromPascalCase(variantName),
    );
  }

  return toSortedUniqueMethodList(methods);
}

function parseFarfieldClientRequestMethods(methodConstantsSource, transportConstantsSource) {
  const methodConstantsMatch = methodConstantsSource.match(MethodConstantsBlockPattern);
  if (!methodConstantsMatch || methodConstantsMatch[1] === undefined) {
    fail("Unable to parse APP_SERVER_CLIENT_METHODS block from Farfield method constants");
  }

  const methods = [];
  for (const match of methodConstantsMatch[1].matchAll(MethodStringPattern)) {
    methods.push(MethodNameSchema.parse(match[1]));
  }

  const initializeMethodMatch = transportConstantsSource.match(InitializeMethodPattern);
  if (!initializeMethodMatch || initializeMethodMatch[1] === undefined) {
    fail("Unable to parse APP_SERVER_INITIALIZE_METHOD from Farfield transport constants");
  }
  methods.push(MethodNameSchema.parse(initializeMethodMatch[1]));

  return toSortedUniqueMethodList(methods);
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

  process.stderr.write(`[app-server-method-drift] ${description} mismatch\n`);
  if (addedMethods.length > 0) {
    process.stderr.write("[app-server-method-drift] Added methods:\n");
    for (const method of addedMethods) {
      process.stderr.write(`+ ${method}\n`);
    }
  }
  if (removedMethods.length > 0) {
    process.stderr.write("[app-server-method-drift] Removed methods:\n");
    for (const method of removedMethods) {
      process.stderr.write(`- ${method}\n`);
    }
  }
  process.exit(1);
}

function assertSubset(description, subsetMethods, supersetMethods) {
  const superset = new Set(supersetMethods);
  const outOfScopeMethods = subsetMethods.filter((method) => !superset.has(method));
  if (outOfScopeMethods.length === 0) {
    return;
  }

  process.stderr.write(`[app-server-method-drift] ${description}\n`);
  for (const method of outOfScopeMethods) {
    process.stderr.write(`- ${method}\n`);
  }
  process.exit(1);
}

async function readUpstreamCommonSource() {
  const overridePath = process.env[UpstreamCommonSourcePathEnvironmentVariableName];
  if (overridePath !== undefined && overridePath.trim().length > 0) {
    return {
      sourceText: readTextOrFail(overridePath, "override upstream protocol source file"),
      sourceLabel: `path:${overridePath}`,
    };
  }

  const overrideUrl = process.env[UpstreamCommonSourceUrlEnvironmentVariableName];
  const sourceUrl =
    overrideUrl !== undefined && overrideUrl.trim().length > 0
      ? overrideUrl
      : UpstreamCommonSourceDefaultUrl;

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    fail(
      `Unable to fetch upstream protocol source: ${sourceUrl} (status ${String(response.status)})`,
    );
  }

  return {
    sourceText: await response.text(),
    sourceLabel: sourceUrl,
  };
}

async function main() {
  const upstreamSnapshotMethods = readSnapshotMethods(
    UpstreamClientRequestMethodSnapshotPath,
    "upstream app-server method snapshot",
  );
  const farfieldSnapshotMethods = readSnapshotMethods(
    FarfieldClientRequestMethodSnapshotPath,
    "Farfield app-server method snapshot",
  );

  const { sourceText: upstreamCommonSourceText, sourceLabel: upstreamSourceLabel } =
    await readUpstreamCommonSource();
  const upstreamExtractedMethods = parseUpstreamClientRequestMethods(upstreamCommonSourceText);

  const farfieldMethodConstantsSource = readTextOrFail(
    FarfieldMethodConstantsPath,
    "Farfield app-server method constants",
  );
  const farfieldTransportConstantsSource = readTextOrFail(
    FarfieldTransportConstantsPath,
    "Farfield app-server transport constants",
  );
  const farfieldExtractedMethods = parseFarfieldClientRequestMethods(
    farfieldMethodConstantsSource,
    farfieldTransportConstantsSource,
  );

  assertMethodListsEqual(
    "Upstream app-server method snapshot drift",
    upstreamSnapshotMethods,
    upstreamExtractedMethods,
  );
  assertMethodListsEqual(
    "Farfield app-server method snapshot drift",
    farfieldSnapshotMethods,
    farfieldExtractedMethods,
  );
  assertSubset(
    "Farfield method snapshot contains methods not present upstream",
    farfieldSnapshotMethods,
    upstreamSnapshotMethods,
  );

  process.stdout.write(
    [
      "[app-server-method-drift] Method snapshots verified",
      `- upstream source: ${upstreamSourceLabel}`,
      `- upstream methods: ${String(upstreamSnapshotMethods.length)}`,
      `- farfield methods: ${String(farfieldSnapshotMethods.length)}`,
    ].join("\n") + "\n",
  );
}

await main();
