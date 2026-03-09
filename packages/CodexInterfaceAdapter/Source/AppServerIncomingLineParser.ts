import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { type JsonRpcIncomingMessage, parseJsonRpcIncomingMessage } from "./JsonRpc.js";

export type AppServerIncomingLineErrorKind = "invalid-json" | "schema-mismatch";

export type AppServerIncomingLineParseResult =
  | { kind: "ignore" }
  | { kind: "message"; message: JsonRpcIncomingMessage }
  | { kind: "error"; errorKind: "line-too-large"; maximumCharacterCount: number }
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
  return parseAppServerIncomingLineWithLimit(trimmedLine, Number.POSITIVE_INFINITY);
}

/**
 * Owns the strict line-size boundary for app-server stdout before JSON parsing begins.
 * Character-count guards avoid secondary full-payload serialization just to reject oversized lines.
 */
export function parseAppServerIncomingLineWithLimit(
  line: string,
  maximumCharacterCount: number,
): AppServerIncomingLineParseResult {
  const trimmedLine = line.trim();
  if (trimmedLine.length === 0) {
    return { kind: "ignore" };
  }

  if (trimmedLine.length > maximumCharacterCount) {
    return {
      kind: "error",
      errorKind: "line-too-large",
      maximumCharacterCount,
    };
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
