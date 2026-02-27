import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { type JsonRpcIncomingMessage, parseJsonRpcIncomingMessage } from "./JsonRpc.js";

export type AppServerIncomingLineErrorKind = "invalid-json" | "schema-mismatch";

export type AppServerIncomingLineParseResult =
  | { kind: "ignore" }
  | { kind: "message"; message: JsonRpcIncomingMessage }
  | { kind: "error"; errorKind: "invalid-json" }
  | { kind: "error"; errorKind: "schema-mismatch"; errorMessage: string };

function toErrorMessage<ValueType>(value: ValueType): string {
  if (value instanceof Error) {
    return value.message;
  }

  return String(value);
}

/**
 * Owns transport-line parsing for app-server stdout.
 * The transport owner consumes explicit outcomes (ignore/message/error) instead of inline parse branching.
 */
export function parseAppServerIncomingLine(line: string): AppServerIncomingLineParseResult {
  const trimmedLine = line.trim();
  if (trimmedLine.length === 0) {
    return { kind: "ignore" };
  }

  let parsedJsonValue: JsonValue;
  try {
    parsedJsonValue = JsonValueSchema.parse(JSON.parse(trimmedLine));
  } catch {
    return {
      kind: "error",
      errorKind: "invalid-json",
    };
  }

  try {
    return {
      kind: "message",
      message: parseJsonRpcIncomingMessage(parsedJsonValue),
    };
  } catch (error) {
    return {
      kind: "error",
      errorKind: "schema-mismatch",
      errorMessage: toErrorMessage(error),
    };
  }
}
