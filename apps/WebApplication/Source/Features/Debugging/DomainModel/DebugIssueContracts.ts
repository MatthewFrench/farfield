import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

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
