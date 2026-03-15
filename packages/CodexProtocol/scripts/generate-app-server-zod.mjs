#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import RefParser from "@apidevtools/json-schema-ref-parser";
import { jsonSchemaToZod } from "json-schema-to-zod";

const root = process.cwd();
const vendorRoot = path.join(root, "vendor", "codex-app-server-schema");
const outDir = path.join(root, "Source", "generated", "app-server");

const schemaTargets = [
  {
    id: "thread-list-response",
    source: path.join(vendorRoot, "stable", "json", "v2", "ThreadListResponse.json"),
    fileName: "ThreadListResponseSchema.ts",
    exportName: "ThreadListResponseSchema"
  },
  {
    id: "thread-read-response",
    source: path.join(vendorRoot, "stable", "json", "v2", "ThreadReadResponse.json"),
    fileName: "ThreadReadResponseSchema.ts",
    exportName: "ThreadReadResponseSchema"
  },
  {
    id: "thread-start-params",
    source: path.join(vendorRoot, "stable", "json", "v2", "ThreadStartParams.json"),
    fileName: "ThreadStartParamsSchema.ts",
    exportName: "ThreadStartParamsSchema"
  },
  {
    id: "thread-start-response",
    source: path.join(vendorRoot, "stable", "json", "v2", "ThreadStartResponse.json"),
    fileName: "ThreadStartResponseSchema.ts",
    exportName: "ThreadStartResponseSchema"
  },
  {
    id: "model-list-response",
    source: path.join(vendorRoot, "stable", "json", "v2", "ModelListResponse.json"),
    fileName: "ModelListResponseSchema.ts",
    exportName: "ModelListResponseSchema"
  },
  {
    id: "send-user-message-params",
    source: path.join(vendorRoot, "stable", "json", "v1", "SendUserMessageParams.json"),
    fileName: "SendUserMessageParamsSchema.ts",
    exportName: "SendUserMessageParamsSchema"
  },
  {
    id: "send-user-message-response",
    source: path.join(vendorRoot, "stable", "json", "v1", "SendUserMessageResponse.json"),
    fileName: "SendUserMessageResponseSchema.ts",
    exportName: "SendUserMessageResponseSchema"
  },
  {
    id: "tool-request-user-input-response",
    source: path.join(vendorRoot, "stable", "json", "ToolRequestUserInputResponse.json"),
    fileName: "ToolRequestUserInputResponseSchema.ts",
    exportName: "ToolRequestUserInputResponseSchema"
  },
  {
    id: "tool-request-user-input-params",
    source: path.join(vendorRoot, "stable", "json", "ToolRequestUserInputParams.json"),
    fileName: "ToolRequestUserInputParamsSchema.ts",
    exportName: "ToolRequestUserInputParamsSchema"
  },
  {
    id: "command-execution-request-approval-params",
    source: path.join(vendorRoot, "stable", "json", "CommandExecutionRequestApprovalParams.json"),
    fileName: "CommandExecutionRequestApprovalParamsSchema.ts",
    exportName: "CommandExecutionRequestApprovalParamsSchema"
  },
  {
    id: "file-change-request-approval-params",
    source: path.join(vendorRoot, "stable", "json", "FileChangeRequestApprovalParams.json"),
    fileName: "FileChangeRequestApprovalParamsSchema.ts",
    exportName: "FileChangeRequestApprovalParamsSchema"
  },
  {
    id: "dynamic-tool-call-params",
    source: path.join(vendorRoot, "stable", "json", "DynamicToolCallParams.json"),
    fileName: "DynamicToolCallParamsSchema.ts",
    exportName: "DynamicToolCallParamsSchema"
  },
  {
    id: "command-execution-request-approval-response",
    source: path.join(vendorRoot, "stable", "json", "CommandExecutionRequestApprovalResponse.json"),
    fileName: "CommandExecutionRequestApprovalResponseSchema.ts",
    exportName: "CommandExecutionRequestApprovalResponseSchema"
  },
  {
    id: "file-change-request-approval-response",
    source: path.join(vendorRoot, "stable", "json", "FileChangeRequestApprovalResponse.json"),
    fileName: "FileChangeRequestApprovalResponseSchema.ts",
    exportName: "FileChangeRequestApprovalResponseSchema"
  },
  {
    id: "dynamic-tool-call-response",
    source: path.join(vendorRoot, "stable", "json", "DynamicToolCallResponse.json"),
    fileName: "DynamicToolCallResponseSchema.ts",
    exportName: "DynamicToolCallResponseSchema"
  },
  {
    id: "collaboration-mode-list-response",
    source: path.join(vendorRoot, "experimental", "json", "v2", "CollaborationModeListResponse.json"),
    fileName: "CollaborationModeListResponseSchema.ts",
    exportName: "CollaborationModeListResponseSchema"
  }
];

function ensureSchemaFilesExist() {
  const missing = schemaTargets.filter((target) => !fs.existsSync(target.source));
  if (missing.length === 0) {
    return;
  }

  const names = missing.map((target) => target.source).join("\n");
  throw new Error(
    [
      "Missing generated Codex JSON Schema files.",
      "Run `bun run generate:codex-schema` first.",
      names
    ].join("\n")
  );
}

async function writeSchemaModule(target) {
  const dereferenced = await RefParser.dereference(target.source);
  const generated = jsonSchemaToZod(dereferenced, {
    name: target.exportName,
    module: "esm"
  });

  const withHeader = [
    "// GENERATED FILE. DO NOT EDIT.",
    `// Source: ${path.relative(root, target.source)}`,
    generated.trim(),
    ""
  ].join("\n");

  fs.writeFileSync(path.join(outDir, target.fileName), withHeader, "utf8");
}

function writeIndexModule() {
  const exportLines = schemaTargets.map((target) => {
    const importPath = `./${target.fileName.replace(/\.ts$/, ".js")}`;
    return `export { ${target.exportName} } from "${importPath}";`;
  });
  const file = [
    "// GENERATED FILE. DO NOT EDIT.",
    ...exportLines,
    ""
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "index.ts"), file, "utf8");
}

async function main() {
  ensureSchemaFilesExist();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const target of schemaTargets) {
    process.stdout.write(`Generating ${target.id}...\n`);
    await writeSchemaModule(target);
  }

  writeIndexModule();
  process.stdout.write("Generated app-server Zod schema modules.\n");
}

await main();
