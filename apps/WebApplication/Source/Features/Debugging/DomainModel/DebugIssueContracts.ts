import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

export interface DebugErrorDetails {
  actionId?: string | undefined;
  actionName?: string | undefined;
  [detailKey: string]: StructuredDataValue | undefined;
}

export interface DebugErrorLike {
  errorId: string;
  origin: "client" | "server";
  source: string;
  operation: string;
  message: string;
  severity: "error" | "warning";
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  occurredAt: string;
  details: DebugErrorDetails;
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
  kind: "debug-error" | "history-warning";
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
  kind: "debug-error";
  severity: "error" | "warning";
  errorId: string;
  origin: DebugErrorLike["origin"];
  source: string;
  operation: string;
  name: string | null;
  stack: string | null;
  detailsText: string;
}

export interface DebugWarningIssue extends DebugIssueBase {
  kind: "history-warning";
  severity: "warning";
  warningType: "ipc-method" | "system-message";
  historyEntryId: string;
  payloadText: string;
}

export interface RuntimeRequestErrorOperationMetric {
  operation: string;
  count: number;
}

export type DebugIssue = DebugErrorIssue | DebugWarningIssue;
