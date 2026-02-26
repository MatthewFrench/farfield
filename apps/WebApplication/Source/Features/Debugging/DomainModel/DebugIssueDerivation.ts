import { z } from "zod";
import {
  type DebugErrorIssue,
  type DebugErrorLike,
  type DebugHistoryEntryLike,
  type DebugIssue,
  type DebugWarningIssue
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { buildDebugErrorIssueIdentifier } from "@/Features/Debugging/DomainModel/DebugIssueIdentifier";

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

const WARNING_MESSAGE_PATTERN = /warning|deprecat/i;
const IPC_WARNING_SOURCE_LABEL = "IPC warning";
const SYSTEM_WARNING_SOURCE_LABEL = "System warning";
const HISTORY_METHOD_WARNING_IDENTIFIER_PREFIX = "warning:history-method:";
const SYSTEM_WARNING_IDENTIFIER_PREFIX = "warning:system:";

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
  const actionId = event.details.actionId ?? null;
  const actionName = event.details.actionName ?? null;
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
    id: buildDebugErrorIssueIdentifier(event.errorId),
    kind: "debug-error",
    severity: event.severity,
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
    const warningMeta = parsedMeta.success ? parsedMeta.data : null;
    const method = warningMeta?.method ?? null;

    if (method && WARNING_MESSAGE_PATTERN.test(method)) {
      const searchText = [
        entry.id,
        method,
        warningMeta?.threadId ?? "",
        warningMeta?.requestId ?? "",
        warningMeta?.actionId ?? ""
      ].join(" ").toLowerCase();
      warningIssues.push({
        id: `${HISTORY_METHOD_WARNING_IDENTIFIER_PREFIX}${entry.id}`,
        kind: "history-warning",
        severity: "warning",
        warningType: "ipc-method",
        historyEntryId: entry.id,
        occurredAt: entry.at,
        message: `IPC method ${method}`,
        sourceLabel: IPC_WARNING_SOURCE_LABEL,
        threadId: warningMeta?.threadId ?? null,
        requestId: warningMeta?.requestId ?? null,
        actionId: warningMeta?.actionId ?? null,
        actionName: warningMeta?.actionName ?? null,
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
    if (!WARNING_MESSAGE_PATTERN.test(systemMessage)) {
      continue;
    }

    const searchText = [
      entry.id,
      systemMessage,
      warningMeta?.threadId ?? "",
      warningMeta?.requestId ?? "",
      warningMeta?.actionId ?? ""
    ].join(" ").toLowerCase();
    warningIssues.push({
      id: `${SYSTEM_WARNING_IDENTIFIER_PREFIX}${entry.id}`,
      kind: "history-warning",
      severity: "warning",
      warningType: "system-message",
      historyEntryId: entry.id,
      occurredAt: entry.at,
      message: systemMessage,
      sourceLabel: SYSTEM_WARNING_SOURCE_LABEL,
      threadId: warningMeta?.threadId ?? null,
      requestId: warningMeta?.requestId ?? null,
      actionId: warningMeta?.actionId ?? null,
      actionName: warningMeta?.actionName ?? null,
      payloadText: JSON.stringify(entry.payload, null, 2),
      searchText
    });
  }

  warningIssues.sort(sortDebugIssuesByTimeDesc);
  return warningIssues;
}
