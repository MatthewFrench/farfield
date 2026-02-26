import { z } from "zod";
import type {
  OpenCodePart,
  OpenCodeTextPart,
  OpenCodeToolPart
} from "./Schemas.js";
import type {
  MappedFileChangeEntry,
  MappedToolLifecycleStatus,
  MappedTurnItem
} from "./MapperContracts.js";

type OpenCodeToolState = OpenCodeToolPart["state"];

const FILE_EDIT_TOOL_NAMES = new Set<string>(["write", "edit", "multiedit"]);
const UNKNOWN_FILE_PATH = "(unknown)";

/**
 * OpenCode tool payloads allow arbitrary key/value input. This projection keeps
 * mapper logic on strict, named fields while preserving strict parse failures
 * for mismatched field types.
 */
const OpenCodeToolInputProjectionSchema = z
  .object({
    command: z.string().optional(),
    cwd: z.string().optional(),
    file_path: z.string().optional(),
    path: z.string().optional()
  })
  .passthrough();

type OpenCodeToolInputProjection = z.infer<typeof OpenCodeToolInputProjectionSchema>;

const OpenCodeToolMetadataProjectionSchema = z
  .object({
    exit_code: z.number().int().optional()
  })
  .passthrough();

export function isTextPart(part: OpenCodePart): part is OpenCodeTextPart {
  return part.type === "text";
}

export function partToTurnItem(part: OpenCodePart): MappedTurnItem | null {
  switch (part.type) {
    case "text": {
      const textPart = part;
      if (textPart.synthetic || textPart.ignored) {
        return null;
      }
      return {
        id: textPart.id,
        type: "agentMessage",
        text: textPart.text
      };
    }

    case "reasoning": {
      const reasoningPart = part;
      return {
        id: reasoningPart.id,
        type: "reasoning",
        text: reasoningPart.text
      };
    }

    case "tool": {
      const toolPart = part;
      return toolPartToTurnItem(toolPart);
    }

    case "file": {
      const filePart = part;
      return {
        id: filePart.id,
        type: "fileChange",
        changes: [{
          path: filePart.url,
          kind: { type: "created" }
        }],
        status: "completed"
      };
    }

    case "step-start":
    case "step-finish":
    case "snapshot":
    case "patch":
    case "agent":
    case "retry":
    case "compaction":
    case "subtask":
      return null;
  }
}

function toolPartToTurnItem(toolPart: OpenCodeToolPart): MappedTurnItem {
  const state = toolPart.state;
  const toolName = toolPart.tool;
  const status = resolveToolStatus(state);
  const input = parseToolInput(state.input);

  if (isFileEditTool(toolName)) {
    return {
      id: toolPart.id,
      type: "fileChange",
      changes: extractFileChanges(toolName, input, state),
      status
    };
  }

  return {
    id: toolPart.id,
    type: "commandExecution",
    command: input.command ?? toolName,
    status,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    aggregatedOutput: extractToolOutput(state),
    exitCode: extractExitCode(state),
    durationMs: extractDurationMs(state)
  };
}

function isFileEditTool(toolName: string): boolean {
  return FILE_EDIT_TOOL_NAMES.has(toolName);
}

function extractFileChanges(
  toolName: string,
  input: OpenCodeToolInputProjection,
  state: OpenCodeToolState
): MappedFileChangeEntry[] {
  const filePath = input.file_path ?? input.path ?? UNKNOWN_FILE_PATH;

  const output = extractToolOutput(state);
  return [{
    path: filePath,
    kind: { type: toolName === "write" ? "created" : "modified" },
    ...(output !== null ? { diff: output } : {})
  }];
}

function resolveToolStatus(state: OpenCodeToolState): MappedToolLifecycleStatus {
  return state.status === "error" ? "error" : state.status;
}

function extractToolOutput(state: OpenCodeToolState): string | null {
  if (state.status === "completed") {
    return state.output;
  }
  if (state.status === "error") {
    return state.error;
  }
  return null;
}

function extractExitCode(state: OpenCodeToolState): number | null {
  if (state.status !== "completed" && state.status !== "error") {
    return null;
  }
  if (state.metadata === undefined) {
    return null;
  }
  const metadata = OpenCodeToolMetadataProjectionSchema.parse(state.metadata);
  return metadata.exit_code ?? null;
}

function extractDurationMs(state: OpenCodeToolState): number | null {
  if (state.status === "completed") {
    return state.time.end - state.time.start;
  }
  if (state.status === "error") {
    return state.time.end - state.time.start;
  }
  return null;
}

function parseToolInput(input: OpenCodeToolState["input"]): OpenCodeToolInputProjection {
  return OpenCodeToolInputProjectionSchema.parse(input);
}
