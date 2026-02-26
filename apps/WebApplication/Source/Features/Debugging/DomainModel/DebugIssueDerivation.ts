/**
 * Owns projection of debug errors/history entries into searchable debug issues.
 * This module normalizes optional warning metadata and payload message fields once so
 * downstream state owners can filter and sort without ad-hoc shape probing.
 */
import { z } from "zod";
import {
  type DebugErrorIssue,
  type DebugErrorLike,
  type DebugHistoryEntryLike,
  type DebugIssue,
  type DebugWarningIssue
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { buildDebugErrorIssueIdentifier } from "@/Features/Debugging/DomainModel/DebugIssueIdentifier";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

const NORMALIZED_NON_EMPTY_STRING_SCHEMA = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length > 0 ? value : null),
  z.string().trim().min(1).nullable()
);

const SystemHistoryPayloadSchema = z
  .preprocess(
    (value) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return {};
      }
      return value;
    },
    z
      .object({
        message: NORMALIZED_NON_EMPTY_STRING_SCHEMA
      })
      .passthrough()
  );

const HistoryWarningMetaSchema = z
  .object({
    method: NORMALIZED_NON_EMPTY_STRING_SCHEMA,
    threadId: NORMALIZED_NON_EMPTY_STRING_SCHEMA,
    requestId: NORMALIZED_NON_EMPTY_STRING_SCHEMA,
    actionId: NORMALIZED_NON_EMPTY_STRING_SCHEMA,
    actionName: NORMALIZED_NON_EMPTY_STRING_SCHEMA
  })
  .passthrough();
type HistoryWarningMeta = z.infer<typeof HistoryWarningMetaSchema>;
type SystemHistoryPayload = z.infer<typeof SystemHistoryPayloadSchema>;

const WARNING_MESSAGE_PATTERN = /warning|deprecat/i;
const IPC_WARNING_SOURCE_LABEL = "IPC warning";
const SYSTEM_WARNING_SOURCE_LABEL = "System warning";
const HISTORY_METHOD_WARNING_IDENTIFIER_PREFIX = "warning:history-method:";
const SYSTEM_WARNING_IDENTIFIER_PREFIX = "warning:system:";
const SEARCH_TEXT_SEGMENT_SEPARATOR = " ";
const JSON_STRINGIFY_INDENTATION_SPACES = 2;

function toTimestampMilliseconds(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildIssueSearchText(searchSegments: readonly string[]): string {
  return searchSegments.join(SEARCH_TEXT_SEGMENT_SEPARATOR).toLowerCase();
}

function readHistoryWarningMeta(meta: DebugHistoryEntryLike["meta"]): HistoryWarningMeta {
  return HistoryWarningMetaSchema.parse(meta);
}

function readSystemHistoryPayload(payload: DebugHistoryEntryLike["payload"]): SystemHistoryPayload {
  return SystemHistoryPayloadSchema.parse(payload);
}

function serializeStructuredData(value: StructuredDataValue | undefined): string {
  return JSON.stringify(value ?? null, null, JSON_STRINGIFY_INDENTATION_SPACES);
}

function serializeDebugErrorDetails(details: DebugErrorLike["details"]): string {
  return JSON.stringify(details, null, JSON_STRINGIFY_INDENTATION_SPACES);
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
  const searchText = buildIssueSearchText([
    event.errorId,
    event.origin,
    event.source,
    event.operation,
    event.message,
    event.requestId ?? "",
    event.threadId ?? "",
    actionId ?? "",
    actionName ?? ""
  ]);

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
    detailsText: serializeDebugErrorDetails(event.details)
  };
}

export function buildDebugWarningIssuesFromHistory(
  history: DebugHistoryEntryLike[]
): DebugWarningIssue[] {
  const warningIssues: DebugWarningIssue[] = [];

  for (const entry of history) {
    const warningMeta = readHistoryWarningMeta(entry.meta);
    const method = warningMeta.method;

    if (method && WARNING_MESSAGE_PATTERN.test(method)) {
      const searchText = buildIssueSearchText([
        entry.id,
        method,
        warningMeta.threadId ?? "",
        warningMeta.requestId ?? "",
        warningMeta.actionId ?? ""
      ]);
      warningIssues.push({
        id: `${HISTORY_METHOD_WARNING_IDENTIFIER_PREFIX}${entry.id}`,
        kind: "history-warning",
        severity: "warning",
        warningType: "ipc-method",
        historyEntryId: entry.id,
        occurredAt: entry.at,
        message: `IPC method ${method}`,
        sourceLabel: IPC_WARNING_SOURCE_LABEL,
        threadId: warningMeta.threadId,
        requestId: warningMeta.requestId,
        actionId: warningMeta.actionId,
        actionName: warningMeta.actionName,
        payloadText: serializeStructuredData(entry.payload),
        searchText
      });
      continue;
    }

    if (entry.source !== "system") {
      continue;
    }

    const systemPayload = readSystemHistoryPayload(entry.payload);
    const systemMessage = systemPayload.message;
    if (systemMessage === null || !WARNING_MESSAGE_PATTERN.test(systemMessage)) {
      continue;
    }

    const searchText = buildIssueSearchText([
      entry.id,
      systemMessage,
      warningMeta.threadId ?? "",
      warningMeta.requestId ?? "",
      warningMeta.actionId ?? ""
    ]);
    warningIssues.push({
      id: `${SYSTEM_WARNING_IDENTIFIER_PREFIX}${entry.id}`,
      kind: "history-warning",
      severity: "warning",
      warningType: "system-message",
      historyEntryId: entry.id,
      occurredAt: entry.at,
      message: systemMessage,
      sourceLabel: SYSTEM_WARNING_SOURCE_LABEL,
      threadId: warningMeta.threadId,
      requestId: warningMeta.requestId,
      actionId: warningMeta.actionId,
      actionName: warningMeta.actionName,
      payloadText: serializeStructuredData(entry.payload),
      searchText
    });
  }

  warningIssues.sort(sortDebugIssuesByTimeDesc);
  return warningIssues;
}
