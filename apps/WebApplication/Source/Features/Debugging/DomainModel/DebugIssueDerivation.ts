import { z } from "zod";
import {
  type DebugErrorIssue,
  type DebugErrorLike,
  type DebugHistoryEntryLike,
  type DebugIssue,
  type DebugWarningIssue
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
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

function parseOptionalNonEmptyString(value: StructuredDataValue | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTimestampMilliseconds(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortDebugIssuesByTimeDesc(left: DebugIssue, right: DebugIssue): number {
  const leftMilliseconds = toTimestampMilliseconds(left.occurredAt);
  const rightMilliseconds = toTimestampMilliseconds(right.occurredAt);
  if (leftMilliseconds !== rightMilliseconds) {
    return rightMilliseconds - leftMilliseconds;
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
