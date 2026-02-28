import { z } from "zod";
import type { StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
import {
  type DebugErrorLike,
  DebugErrorLikeSchema,
  type DebugHistoryEntryLike,
  DebugHistoryEntryLikeSchema,
  type DebugIssue,
  DebugIssueSchema,
  RuntimeRequestErrorOperationMetricSchema,
} from "../DomainModel/DebugIssueContracts";
import {
  DEBUG_ISSUE_SEVERITY_FILTER_ALL,
  DEBUG_ISSUE_SEVERITY_FILTER_ERROR,
  DEBUG_ISSUE_SEVERITY_FILTER_WARNING,
  type DebugIssueSeverityFilter,
} from "../DomainModel/DebugIssueStateResolver";

const RequestIdentifierSchema = z.number().int().nonnegative();
const DebugIssueSeverityFilterSchema = z.enum([
  DEBUG_ISSUE_SEVERITY_FILTER_ALL,
  DEBUG_ISSUE_SEVERITY_FILTER_ERROR,
  DEBUG_ISSUE_SEVERITY_FILTER_WARNING,
]);
const DebugErrorLikeWorkerInputSchema = DebugErrorLikeSchema.passthrough();
const DebugHistoryEntryLikeWorkerInputSchema = DebugHistoryEntryLikeSchema.passthrough();

export interface DebugIssueDerivationInput {
  debugErrors: DebugErrorLike[];
  historyEntries: DebugHistoryEntryLike[];
  severityFilter: DebugIssueSeverityFilter;
  filterQuery: string;
  selectedIssueIdentifier: string;
}

const DebugIssueDerivationInputSchema = z
  .object({
    debugErrors: z.array(DebugErrorLikeWorkerInputSchema),
    historyEntries: z.array(DebugHistoryEntryLikeWorkerInputSchema),
    severityFilter: DebugIssueSeverityFilterSchema,
    filterQuery: z.string(),
    selectedIssueIdentifier: z.string(),
  })
  .strict();

export interface DebugIssueDerivationWorkerRequest {
  requestId: number;
  input: DebugIssueDerivationInput;
}

const DebugIssueDerivationWorkerRequestSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    input: DebugIssueDerivationInputSchema,
  })
  .strict();

export interface DebugIssueDerivationResult {
  debugErrorIssues: DebugIssue[];
  debugWarningIssues: DebugIssue[];
  debugIssues: DebugIssue[];
  runtimeRequestErrorOperationMetrics: z.infer<typeof RuntimeRequestErrorOperationMetricSchema>[];
  filteredDebugIssues: DebugIssue[];
  selectedDebugIssue: DebugIssue | null;
}

const DebugIssueDerivationResultSchema = z
  .object({
    debugErrorIssues: z.array(DebugIssueSchema),
    debugWarningIssues: z.array(DebugIssueSchema),
    debugIssues: z.array(DebugIssueSchema),
    runtimeRequestErrorOperationMetrics: z.array(RuntimeRequestErrorOperationMetricSchema),
    filteredDebugIssues: z.array(DebugIssueSchema),
    selectedDebugIssue: DebugIssueSchema.nullable(),
  })
  .strict();

export interface DebugIssueDerivationWorkerSuccessResponse {
  requestId: number;
  kind: "success";
  result: DebugIssueDerivationResult;
}

const DebugIssueDerivationWorkerSuccessResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("success"),
    result: DebugIssueDerivationResultSchema,
  })
  .strict();

export interface DebugIssueDerivationWorkerFailureResponse {
  requestId: number;
  kind: "failure";
  reason: string;
}

const DebugIssueDerivationWorkerFailureResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("failure"),
    reason: z.string().trim().min(1),
  })
  .strict();

export type DebugIssueDerivationWorkerResponse =
  | DebugIssueDerivationWorkerSuccessResponse
  | DebugIssueDerivationWorkerFailureResponse;

const DebugIssueDerivationWorkerResponseSchema = z.discriminatedUnion("kind", [
  DebugIssueDerivationWorkerSuccessResponseSchema,
  DebugIssueDerivationWorkerFailureResponseSchema,
]);

export function parseDebugIssueDerivationWorkerRequest(
  value: StructuredDataValue | DebugIssueDerivationWorkerRequest,
): DebugIssueDerivationWorkerRequest {
  return DebugIssueDerivationWorkerRequestSchema.parse(value);
}

export function safeParseDebugIssueDerivationWorkerResponse(
  value: StructuredDataValue | DebugIssueDerivationWorkerResponse,
):
  | { success: true; data: DebugIssueDerivationWorkerResponse }
  | { success: false; error: z.ZodError } {
  const result = DebugIssueDerivationWorkerResponseSchema.safeParse(value);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    data: result.data,
  };
}
