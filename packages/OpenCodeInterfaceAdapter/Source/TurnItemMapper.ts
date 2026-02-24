import { z } from "zod";
import type { OpenCodePart } from "./Schemas.js";
import type { MappedTurnItem } from "./MapperContracts.js";

type OpenCodeToolPart = Extract<OpenCodePart, { type: "tool" }>;
type OpenCodeToolState = OpenCodeToolPart["state"];
type OpenCodeTextPart = Extract<OpenCodePart, { type: "text" }>;

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

    default:
      return null;
  }
}

function toolPartToTurnItem(toolPart: OpenCodeToolPart): MappedTurnItem {
  const state = toolPart.state;
  const toolName = toolPart.tool;
  const status = resolveToolStatus(state);

  if (isFileEditTool(toolName)) {
    return {
      id: toolPart.id,
      type: "fileChange",
      changes: extractFileChanges(toolName, state),
      status
    };
  }

  const input = state.input;
  const command = typeof input["command"] === "string"
    ? input["command"]
    : toolName;

  return {
    id: toolPart.id,
    type: "commandExecution",
    command,
    status,
    ...(typeof input["cwd"] === "string" ? { cwd: input["cwd"] } : {}),
    aggregatedOutput: extractToolOutput(state),
    exitCode: extractExitCode(state),
    durationMs: extractDurationMs(state)
  };
}

function isFileEditTool(toolName: string): boolean {
  return toolName === "write" || toolName === "edit" || toolName === "multiedit";
}

function extractFileChanges(
  toolName: string,
  state: OpenCodeToolState
): Array<{ path: string; kind: { type: string }; diff?: string }> {
  const input = state.input;
  const filePath = typeof input["file_path"] === "string"
    ? input["file_path"]
    : typeof input["path"] === "string"
      ? input["path"]
      : "(unknown)";

  const output = extractToolOutput(state);
  return [{
    path: filePath,
    kind: { type: toolName === "write" ? "created" : "modified" },
    ...(output !== null ? { diff: output } : {})
  }];
}

function resolveToolStatus(state: OpenCodeToolState): string {
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
  if (state.status === "completed" || state.status === "error") {
    const parsedMetadata = z
      .object({
        exit_code: z.number()
      })
      .passthrough()
      .safeParse(state.metadata);
    if (parsedMetadata.success) {
      return parsedMetadata.data.exit_code;
    }
  }
  return null;
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
