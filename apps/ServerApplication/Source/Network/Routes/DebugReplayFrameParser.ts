import { JsonValueSchema, type JsonValue } from "@farfield/protocol";
import { z } from "zod";
import {
  DebugReplayFrameParseError,
  DebugReplayFrameParseErrorTypeByName,
  DebugReplayFrameTypeByName,
  type DebugReplayFrameParseIssue,
  type DebugReplayFrameType,
  type ParsedReplayFrame
} from "./DebugRouteContracts.js";

const ReplayFrameMethodSchema = z.string().trim().min(1);
const ReplayFrameTargetClientIdentifierSchema = z.string().trim().min(1);
const ReplayFrameVersionSchema = z.number().int().nonnegative();
const ReplayFrameIssuePathRoot = "frame";
const ReplayFrameIssuePathSeparator = ".";

function createReplayFrameSchema(frameType: DebugReplayFrameType) {
  return z
    .object({
      type: z.literal(frameType),
      method: ReplayFrameMethodSchema,
      params: JsonValueSchema.optional(),
      targetClientId: ReplayFrameTargetClientIdentifierSchema.optional(),
      version: ReplayFrameVersionSchema.optional()
    })
    .passthrough();
}

const ReplayFrameSchema = z
  .discriminatedUnion("type", [
    createReplayFrameSchema(DebugReplayFrameTypeByName.request),
    createReplayFrameSchema(DebugReplayFrameTypeByName.broadcast)
  ]);

/**
 * Owns debug replay frame boundary parsing so route handlers consume a strict, route-owned contract.
 * Issue ordering is canonicalized to keep diagnostics deterministic across invalid payload shapes.
 */
export function parseReplayFrame(payload: JsonValue): ParsedReplayFrame {
  const parsedReplayFrameResult = ReplayFrameSchema.safeParse(payload);
  if (!parsedReplayFrameResult.success) {
    throw new DebugReplayFrameParseError({
      errorType: DebugReplayFrameParseErrorTypeByName.invalidReplayFramePayload,
      issues: mapReplayFrameIssues(parsedReplayFrameResult.error.issues)
    });
  }

  const parsedReplayFrame = parsedReplayFrameResult.data;

  return {
    type: parsedReplayFrame.type,
    method: parsedReplayFrame.method,
    params: parsedReplayFrame.params,
    ...(parsedReplayFrame.targetClientId !== undefined
      ? { targetClientId: parsedReplayFrame.targetClientId }
      : {}),
    ...(parsedReplayFrame.version !== undefined
      ? { version: parsedReplayFrame.version }
      : {})
  };
}

function mapReplayFrameIssues(issues: ReadonlyArray<z.ZodIssue>): DebugReplayFrameParseIssue[] {
  return issues
    .map((issue) => ({
      path: buildReplayFrameIssuePath(issue.path),
      issueCode: issue.code,
      message: issue.message
    }))
    .sort(compareReplayFrameIssues);
}

function compareReplayFrameIssues(
  leftIssue: DebugReplayFrameParseIssue,
  rightIssue: DebugReplayFrameParseIssue
): number {
  const pathOrder = leftIssue.path.localeCompare(rightIssue.path);
  if (pathOrder !== 0) {
    return pathOrder;
  }

  const issueCodeOrder = leftIssue.issueCode.localeCompare(rightIssue.issueCode);
  if (issueCodeOrder !== 0) {
    return issueCodeOrder;
  }

  return leftIssue.message.localeCompare(rightIssue.message);
}

function buildReplayFrameIssuePath(pathSegments: ReadonlyArray<string | number>): string {
  if (pathSegments.length === 0) {
    return ReplayFrameIssuePathRoot;
  }

  return `${ReplayFrameIssuePathRoot}${ReplayFrameIssuePathSeparator}${pathSegments
    .map((segment) => String(segment))
    .join(ReplayFrameIssuePathSeparator)}`;
}
