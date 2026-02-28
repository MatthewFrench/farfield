import { z } from "zod";
import {
  type StructuredDataValue,
  StructuredDataValueSchema,
} from "@/Shared/Contracts/StructuredDataValue";

export interface DebugErrorDetails {
  actionId?: string | undefined;
  actionName?: string | undefined;
  [detailKey: string]: StructuredDataValue | undefined;
}

const OptionalStringSchema = z.string().nullable();

export const DebugErrorDetailsSchema = z
  .record(z.string(), StructuredDataValueSchema.optional())
  .default({})
  .transform((value) => value satisfies DebugErrorDetails);

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

export const DebugErrorLikeSchema = z
  .object({
    errorId: z.string().min(1),
    origin: z.enum(["client", "server"]),
    source: z.string(),
    operation: z.string(),
    message: z.string(),
    severity: z.enum(["error", "warning"]),
    name: OptionalStringSchema,
    stack: OptionalStringSchema,
    requestId: OptionalStringSchema,
    threadId: OptionalStringSchema,
    occurredAt: z.string(),
    details: DebugErrorDetailsSchema,
  })
  .strict();

export interface DebugHistoryEntryLike {
  id: string;
  at: string;
  source: "ipc" | "app" | "system";
  payload?: StructuredDataValue | undefined;
  meta: Record<string, StructuredDataValue>;
}

export const DebugHistoryEntryLikeSchema = z
  .object({
    id: z.string().min(1),
    at: z.string(),
    source: z.enum(["ipc", "app", "system"]),
    payload: StructuredDataValueSchema.optional(),
    meta: z.record(z.string(), StructuredDataValueSchema),
  })
  .strict();

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

const DebugIssueBaseSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["debug-error", "history-warning"]),
    severity: z.enum(["error", "warning"]),
    occurredAt: z.string(),
    message: z.string(),
    sourceLabel: z.string(),
    threadId: OptionalStringSchema,
    requestId: OptionalStringSchema,
    actionId: OptionalStringSchema,
    actionName: OptionalStringSchema,
    searchText: z.string(),
  })
  .strict();

export const DebugErrorIssueSchema = DebugIssueBaseSchema.extend({
  kind: z.literal("debug-error"),
  severity: z.enum(["error", "warning"]),
  errorId: z.string().min(1),
  origin: z.enum(["client", "server"]),
  source: z.string(),
  operation: z.string(),
  name: OptionalStringSchema,
  stack: OptionalStringSchema,
  detailsText: z.string(),
}).strict();

export const DebugWarningIssueSchema = DebugIssueBaseSchema.extend({
  kind: z.literal("history-warning"),
  severity: z.literal("warning"),
  warningType: z.enum(["ipc-method", "system-message"]),
  historyEntryId: z.string().min(1),
  payloadText: z.string(),
}).strict();

export interface RuntimeRequestErrorOperationMetric {
  operation: string;
  count: number;
}

export const RuntimeRequestErrorOperationMetricSchema = z
  .object({
    operation: z.string(),
    count: z.number().int().nonnegative(),
  })
  .strict();

export type DebugIssue = DebugErrorIssue | DebugWarningIssue;
export const DebugIssueSchema = z.discriminatedUnion("kind", [
  DebugErrorIssueSchema,
  DebugWarningIssueSchema,
]);
