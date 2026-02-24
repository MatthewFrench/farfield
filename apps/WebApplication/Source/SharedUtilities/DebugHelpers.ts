import { z } from "zod";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

const SystemHistoryPayloadSchema = z
  .object({
    message: z.string().trim().min(1)
  })
  .passthrough();

const HistoryWarningMetaSchema = z
  .object({
    method: z.string().trim().min(1).optional(),
    threadId: z.string().trim().min(1).optional(),
    requestId: z.string().trim().min(1).optional(),
    actionId: z.string().trim().min(1).optional(),
    actionName: z.string().trim().min(1).optional()
  })
  .passthrough();

export interface DebugErrorLike {
  errorId: string;
  origin: "client" | "server";
  source: string;
  operation: string;
  message: string;
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  occurredAt: string;
  details: Record<string, StructuredDataValue>;
}

export interface DebugHistoryEntryLike {
  id: string;
  at: string;
  source: "ipc" | "app" | "system";
  payload?: StructuredDataValue | undefined;
  meta: Record<string, StructuredDataValue>;
}

export interface ErrorBannerDetails {
  operation: string;
  message: string;
  actionId: string | null;
  requestId: string | null;
  errorId: string | null;
}

export interface DebugIssueBase {
  id: string;
  severity: "error" | "warning";
  occurredAt: string;
  message: string;
  sourceLabel: string;
  threadId: string | null;
  requestId: string | null;
  actionId: string | null;
  actionName: string | null;
  searchText: string;
}

export interface DebugErrorIssue extends DebugIssueBase {
  severity: "error";
  errorId: string;
  origin: DebugErrorLike["origin"];
  source: string;
  operation: string;
  name: string | null;
  stack: string | null;
  detailsText: string;
}

export interface DebugWarningIssue extends DebugIssueBase {
  severity: "warning";
  warningType: "ipc-method" | "system-message";
  historyEntryId: string;
  payloadText: string;
}

export type DebugIssue = DebugErrorIssue | DebugWarningIssue;

export function toErrorMessage<ErrorType>(err: ErrorType): string {
  return err instanceof Error ? err.message : String(err);
}

function parseOptionalNonEmptyString(value: StructuredDataValue | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTimestampMs(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortDebugIssuesByTimeDesc(left: DebugIssue, right: DebugIssue): number {
  const leftMs = toTimestampMs(left.occurredAt);
  const rightMs = toTimestampMs(right.occurredAt);
  if (leftMs !== rightMs) {
    return rightMs - leftMs;
  }
  return right.id.localeCompare(left.id);
}

export function buildDebugErrorIssue(event: DebugErrorLike): DebugErrorIssue {
  const actionId = parseOptionalNonEmptyString(event.details["actionId"]);
  const actionName = parseOptionalNonEmptyString(event.details["actionName"]);
  const sourceLabel = event.origin === "server"
    ? `Server (${event.operation})`
    : `Client (${event.operation})`;
  const searchText = [
    event.errorId,
    event.origin,
    event.source,
    event.operation,
    event.message,
    event.requestId ?? "",
    event.threadId ?? "",
    actionId ?? "",
    actionName ?? ""
  ].join(" ").toLowerCase();

  return {
    id: `error:${event.errorId}`,
    severity: "error",
    occurredAt: event.occurredAt,
    message: event.message,
    sourceLabel,
    threadId: event.threadId,
    requestId: event.requestId,
    actionId,
    actionName,
    searchText,
    errorId: event.errorId,
    origin: event.origin,
    source: event.source,
    operation: event.operation,
    name: event.name,
    stack: event.stack,
    detailsText: JSON.stringify(event.details, null, 2)
  };
}

export function buildDebugWarningIssuesFromHistory(
  history: DebugHistoryEntryLike[]
): DebugWarningIssue[] {
  const warningIssues: DebugWarningIssue[] = [];

  for (const entry of history) {
    const parsedMeta = HistoryWarningMetaSchema.safeParse(entry.meta);
    const method = parsedMeta.success ? parsedMeta.data.method ?? null : null;

    if (method && /warning|deprecat/i.test(method)) {
      const searchText = [
        entry.id,
        method,
        parsedMeta.success ? parsedMeta.data.threadId ?? "" : "",
        parsedMeta.success ? parsedMeta.data.requestId ?? "" : "",
        parsedMeta.success ? parsedMeta.data.actionId ?? "" : ""
      ].join(" ").toLowerCase();
      warningIssues.push({
        id: `warning:history-method:${entry.id}`,
        severity: "warning",
        warningType: "ipc-method",
        historyEntryId: entry.id,
        occurredAt: entry.at,
        message: `IPC method ${method}`,
        sourceLabel: "IPC warning",
        threadId: parsedMeta.success ? parsedMeta.data.threadId ?? null : null,
        requestId: parsedMeta.success ? parsedMeta.data.requestId ?? null : null,
        actionId: parsedMeta.success ? parsedMeta.data.actionId ?? null : null,
        actionName: parsedMeta.success ? parsedMeta.data.actionName ?? null : null,
        payloadText: JSON.stringify(entry.payload, null, 2),
        searchText
      });
      continue;
    }

    if (entry.source !== "system") {
      continue;
    }

    const parsedPayload = SystemHistoryPayloadSchema.safeParse(entry.payload);
    if (!parsedPayload.success) {
      continue;
    }
    const systemMessage = parsedPayload.data.message;
    if (!/warning|deprecat/i.test(systemMessage)) {
      continue;
    }

    const searchText = [
      entry.id,
      systemMessage,
      parsedMeta.success ? parsedMeta.data.threadId ?? "" : "",
      parsedMeta.success ? parsedMeta.data.requestId ?? "" : "",
      parsedMeta.success ? parsedMeta.data.actionId ?? "" : ""
    ].join(" ").toLowerCase();
    warningIssues.push({
      id: `warning:system:${entry.id}`,
      severity: "warning",
      warningType: "system-message",
      historyEntryId: entry.id,
      occurredAt: entry.at,
      message: systemMessage,
      sourceLabel: "System warning",
      threadId: parsedMeta.success ? parsedMeta.data.threadId ?? null : null,
      requestId: parsedMeta.success ? parsedMeta.data.requestId ?? null : null,
      actionId: parsedMeta.success ? parsedMeta.data.actionId ?? null : null,
      actionName: parsedMeta.success ? parsedMeta.data.actionName ?? null : null,
      payloadText: JSON.stringify(entry.payload, null, 2),
      searchText
    });
  }

  warningIssues.sort(sortDebugIssuesByTimeDesc);
  return warningIssues;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripRepeatedOperationPrefix(message: string, operation: string): string {
  const normalizedMessage = message.trim();
  const normalizedOperation = operation.trim();
  if (normalizedMessage.length === 0 || normalizedOperation.length === 0) {
    return normalizedMessage;
  }

  const operationPattern = new RegExp(`^${escapeRegExp(normalizedOperation)}\\s*[:\\-]\\s*`, "i");
  let nextMessage = normalizedMessage;
  for (let index = 0; index < 3; index += 1) {
    if (!operationPattern.test(nextMessage)) {
      break;
    }
    nextMessage = nextMessage.replace(operationPattern, "").trim();
  }
  return nextMessage.length > 0 ? nextMessage : normalizedMessage;
}

export function toErrorBannerDetails(rawError: string): ErrorBannerDetails {
  const raw = rawError.trim();
  if (raw.length === 0) {
    return {
      operation: "",
      message: "",
      actionId: null,
      requestId: null,
      errorId: null
    };
  }

  const operationMatch = raw.match(/^([a-z][a-z0-9._-]{1,64}):\s*(.+)$/i);
  const operation = operationMatch?.[1] ?? "";
  const messageBody = operationMatch?.[2] ?? raw;
  const message = stripRepeatedOperationPrefix(messageBody, operation);

  const actionIdMatch = raw.match(/\baction(?:Id)?[ =:]+([a-z0-9._-]+)/i);
  const requestIdMatch = raw.match(/\brequest(?:Id)?[ =:]+([a-z0-9._-]+)/i);
  const errorIdMatch = raw.match(/\berror(?:Id)?[ =:]+([a-z0-9._-]+)/i);

  return {
    operation,
    message,
    actionId: actionIdMatch?.[1] ?? null,
    requestId: requestIdMatch?.[1] ?? null,
    errorId: errorIdMatch?.[1] ?? null
  };
}

export function createUiActionId(): string {
  return `action_${String(Date.now())}_${Math.floor(Math.random() * 1_000_000_000).toString(16)}`;
}

export function extractRequestIdFromErrorMessage(errorMessage: string): string | null {
  const requestIdMatch = errorMessage.match(/\brequest(?:Id)?[ =:]+([a-z0-9._-]+)/i);
  return requestIdMatch?.[1] ?? null;
}

export function shouldIgnoreUiErrorMessage(errorMessage: string): boolean {
  return (
    /^Request canceled for /i.test(errorMessage.trim())
    || /Server is shutting down/i.test(errorMessage)
  );
}

export function formatTrackedUiErrorMessage(input: {
  operation: string;
  errorMessage: string;
  actionId: string;
  requestId: string | null;
  errorId: string | null;
}): string {
  const tags = [
    `actionId=${input.actionId}`,
    input.requestId ? `requestId=${input.requestId}` : "",
    input.errorId ? `errorId=${input.errorId}` : ""
  ].filter((value) => value.length > 0);

  if (tags.length === 0) {
    return `${input.operation}: ${input.errorMessage}`;
  }

  return `${input.operation}: ${input.errorMessage} ${tags.join(" ")}`;
}

export function isTransientReadThreadError(errorMessage: string): boolean {
  return (
    /failed to load rollout .* is empty/i.test(errorMessage)
    || /thread not loaded in app-server/i.test(errorMessage)
    || /conversation not found/i.test(errorMessage)
  );
}

export function isThreadNotLoadedReadError(errorMessage: string): boolean {
  return /thread not loaded in app-server/i.test(errorMessage);
}
