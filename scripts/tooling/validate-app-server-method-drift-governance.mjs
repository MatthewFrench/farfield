#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Enforces app-server governance by comparing:
 * 1) upstream protocol extraction against tracked upstream snapshots, and
 * 2) Farfield owner extraction against tracked Farfield snapshots.
 *
 * CI should fail when upstream adds/removes methods until snapshots and ledgers
 * are intentionally updated.
 */
const UpstreamClientRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt",
);
const FarfieldClientRequestMethodSnapshotPath = path.join(
  process.cwd(),
  "docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt",
);
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

const FarfieldClientMethodConstantsPath = path.join(
  process.cwd(),
  "packages/CodexInterfaceAdapter/Source/AppServerClientMethodConstants.ts",
);
const FarfieldTransportConstantsPath = path.join(
  process.cwd(),
  "packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts",
);
const FarfieldServerRequestMethodConstantsPath = path.join(
  process.cwd(),
  "packages/CodexInterfaceAdapter/Source/AppServerServerRequestMethodConstants.ts",
);

const UpstreamCommonSourceDefaultUrl =
  "https://raw.githubusercontent.com/openai/codex/main/codex-rs/app-server-protocol/src/protocol/common.rs";
const UpstreamCommonSourcePathEnvironmentVariableName =
  "APP_SERVER_METHOD_DRIFT_UPSTREAM_COMMON_RS_PATH";
const UpstreamCommonSourceUrlEnvironmentVariableName =
  "APP_SERVER_METHOD_DRIFT_UPSTREAM_COMMON_RS_URL";

const ClientRequestMacroInvocationStart = "client_request_definitions! {";
const ServerRequestMacroInvocationStart = "server_request_definitions! {";
const ServerNotificationMacroInvocationStart = "server_notification_definitions! {";
const MethodConstantsBlockPattern = /APP_SERVER_CLIENT_METHODS\s*=\s*\{([\s\S]*?)\}\s*as const/;
const HandledServerRequestMethodConstantsBlockPattern =
  /APP_SERVER_HANDLED_SERVER_REQUEST_METHODS\s*=\s*\{([\s\S]*?)\}\s*as const/;
const MethodStringPattern = /:\s*"([^"]+)"/g;
const InitializeMethodPattern = /APP_SERVER_INITIALIZE_METHOD\s*=\s*"([^"]+)"/;
const ExplicitMethodPattern = /^([A-Za-z][A-Za-z0-9_]*)\s*=>\s*"([^"]+)"/;
const ImplicitMethodPattern = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:\(|\{)/;
const SerdeRenameAttributePattern = /^#\[\s*serde\(\s*rename\s*=\s*"([^"]+)"\s*\)\s*\]/;
const StrumSerializeAttributePattern = /^#\[\s*strum\(\s*serialize\s*=\s*"([^"]+)"\s*\)\s*\]/;

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

function extractMacroInvocationBody(sourceText, invocationStart) {
  const invocationStartIndex = sourceText.indexOf(invocationStart);
  if (invocationStartIndex < 0) {
    fail(`Missing upstream macro invocation start marker: ${invocationStart}`);
  }

  const blockStartIndex = sourceText.indexOf("{", invocationStartIndex);
  if (blockStartIndex < 0) {
    fail(`Missing upstream macro invocation body start: ${invocationStart}`);
  }

  let depth = 0;
  for (let index = blockStartIndex; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character !== "}") {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return sourceText.slice(blockStartIndex + 1, index);
    }
  }

  fail(`Unterminated macro invocation body: ${invocationStart}`);
}

function parseMacroInvocationMethods(macroBody) {
  const methods = [];
  let pendingAttributeMethod = null;

  for (const rawLine of macroBody.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("///") || line.startsWith("//")) {
      continue;
    }

    const serdeRenameMatch = line.match(SerdeRenameAttributePattern);
    if (serdeRenameMatch && serdeRenameMatch[1] !== undefined) {
      pendingAttributeMethod = MethodNameSchema.parse(serdeRenameMatch[1]);
      continue;
    }

    const strumSerializeMatch = line.match(StrumSerializeAttributePattern);
    if (strumSerializeMatch && strumSerializeMatch[1] !== undefined) {
      pendingAttributeMethod = MethodNameSchema.parse(strumSerializeMatch[1]);
      continue;
    }

    if (line.startsWith("#[") || line.startsWith("#(")) {
      continue;
    }

    const explicitMethodMatch = line.match(ExplicitMethodPattern);
    if (explicitMethodMatch && explicitMethodMatch[2] !== undefined) {
      methods.push(MethodNameSchema.parse(explicitMethodMatch[2]));
      pendingAttributeMethod = null;
      continue;
    }

    const implicitMethodMatch = line.match(ImplicitMethodPattern);
    if (!implicitMethodMatch || implicitMethodMatch[1] === undefined) {
      continue;
    }

    const variantName = MethodNameSchema.parse(implicitMethodMatch[1]);
    methods.push(
      pendingAttributeMethod !== null
        ? MethodNameSchema.parse(pendingAttributeMethod)
        : toLowerCamelCaseFromPascalCase(variantName),
    );
    pendingAttributeMethod = null;
  }

  return toSortedUniqueMethodList(methods);
}

function parseUpstreamClientRequestMethods(commonSourceText) {
  return parseMacroInvocationMethods(
    extractMacroInvocationBody(commonSourceText, ClientRequestMacroInvocationStart),
  );
}

function parseUpstreamServerRequestMethods(commonSourceText) {
  return parseMacroInvocationMethods(
    extractMacroInvocationBody(commonSourceText, ServerRequestMacroInvocationStart),
  );
}

function parseUpstreamServerNotificationMethods(commonSourceText) {
  return parseMacroInvocationMethods(
    extractMacroInvocationBody(commonSourceText, ServerNotificationMacroInvocationStart),
  );
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

function parseFarfieldServerRequestMethods(methodConstantsSource) {
  const methodConstantsMatch = methodConstantsSource.match(
    HandledServerRequestMethodConstantsBlockPattern,
  );
  if (!methodConstantsMatch || methodConstantsMatch[1] === undefined) {
    fail(
      "Unable to parse APP_SERVER_HANDLED_SERVER_REQUEST_METHODS block from Farfield server-request method constants",
    );
  }

  const methods = [];
  for (const match of methodConstantsMatch[1].matchAll(MethodStringPattern)) {
    methods.push(MethodNameSchema.parse(match[1]));
  }

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
  const upstreamClientRequestSnapshotMethods = readSnapshotMethods(
    UpstreamClientRequestMethodSnapshotPath,
    "upstream app-server client-request method snapshot",
  );
  const farfieldClientRequestSnapshotMethods = readSnapshotMethods(
    FarfieldClientRequestMethodSnapshotPath,
    "Farfield app-server client-request method snapshot",
  );
  const upstreamServerNotificationSnapshotMethods = readSnapshotMethods(
    UpstreamServerNotificationMethodSnapshotPath,
    "upstream app-server server-notification method snapshot",
  );
  const upstreamServerRequestSnapshotMethods = readSnapshotMethods(
    UpstreamServerRequestMethodSnapshotPath,
    "upstream app-server server-request method snapshot",
  );
  const farfieldServerRequestSnapshotMethods = readSnapshotMethods(
    FarfieldServerRequestMethodSnapshotPath,
    "Farfield app-server server-request method snapshot",
  );

  const { sourceText: upstreamCommonSourceText, sourceLabel: upstreamSourceLabel } =
    await readUpstreamCommonSource();
  const upstreamExtractedClientRequestMethods = parseUpstreamClientRequestMethods(
    upstreamCommonSourceText,
  );
  const upstreamExtractedServerNotificationMethods = parseUpstreamServerNotificationMethods(
    upstreamCommonSourceText,
  );
  const upstreamExtractedServerRequestMethods = parseUpstreamServerRequestMethods(
    upstreamCommonSourceText,
  );

  const farfieldClientMethodConstantsSource = readTextOrFail(
    FarfieldClientMethodConstantsPath,
    "Farfield app-server client-request method constants",
  );
  const farfieldTransportConstantsSource = readTextOrFail(
    FarfieldTransportConstantsPath,
    "Farfield app-server transport constants",
  );
  const farfieldServerRequestMethodConstantsSource = readTextOrFail(
    FarfieldServerRequestMethodConstantsPath,
    "Farfield app-server server-request method constants",
  );

  const farfieldExtractedClientRequestMethods = parseFarfieldClientRequestMethods(
    farfieldClientMethodConstantsSource,
    farfieldTransportConstantsSource,
  );
  const farfieldExtractedServerRequestMethods = parseFarfieldServerRequestMethods(
    farfieldServerRequestMethodConstantsSource,
  );

  assertMethodListsEqual(
    "Upstream app-server client-request method snapshot drift",
    upstreamClientRequestSnapshotMethods,
    upstreamExtractedClientRequestMethods,
  );
  assertMethodListsEqual(
    "Farfield app-server client-request method snapshot drift",
    farfieldClientRequestSnapshotMethods,
    farfieldExtractedClientRequestMethods,
  );
  assertSubset(
    "Farfield client-request method snapshot contains methods not present upstream",
    farfieldClientRequestSnapshotMethods,
    upstreamClientRequestSnapshotMethods,
  );

  assertMethodListsEqual(
    "Upstream app-server server-notification method snapshot drift",
    upstreamServerNotificationSnapshotMethods,
    upstreamExtractedServerNotificationMethods,
  );
  assertMethodListsEqual(
    "Upstream app-server server-request method snapshot drift",
    upstreamServerRequestSnapshotMethods,
    upstreamExtractedServerRequestMethods,
  );

  assertMethodListsEqual(
    "Farfield app-server server-request method snapshot drift",
    farfieldServerRequestSnapshotMethods,
    farfieldExtractedServerRequestMethods,
  );
  assertSubset(
    "Farfield server-request method snapshot contains methods not present upstream",
    farfieldServerRequestSnapshotMethods,
    upstreamServerRequestSnapshotMethods,
  );

  process.stdout.write(
    [
      "[app-server-method-drift] Method snapshots verified",
      `- upstream source: ${upstreamSourceLabel}`,
      `- upstream client-request methods: ${String(upstreamClientRequestSnapshotMethods.length)}`,
      `- Farfield client-request methods: ${String(farfieldClientRequestSnapshotMethods.length)}`,
      `- upstream server-notification methods: ${String(upstreamServerNotificationSnapshotMethods.length)}`,
      `- upstream server-request methods: ${String(upstreamServerRequestSnapshotMethods.length)}`,
      `- Farfield server-request methods: ${String(farfieldServerRequestSnapshotMethods.length)}`,
    ].join("\n") + "\n",
  );
}

await main();
