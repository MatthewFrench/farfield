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
const ReplayFrameIssuePathPrefix = "frame";
const ReplayFrameIssuePathSeparator = ".";

function createReplayFrameSchema(frameType: DebugReplayFrameType) {
  return z
    .object({
      type: z.literal(frameType),
      method: ReplayFrameMethodSchema,
      params: JsonValueSchema.optional(),
      targetClientId: ReplayFrameTargetClientIdentifierSchema.optional(),
      version: z.number().int().optional()
    })
    .passthrough();
}

const ReplayFrameSchema = z
  .discriminatedUnion("type", [
    createReplayFrameSchema(DebugReplayFrameTypeByName.request),
    createReplayFrameSchema(DebugReplayFrameTypeByName.broadcast)
  ]);

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
  return issues.map((issue) => ({
    path: buildReplayFrameIssuePath(issue.path),
    issueCode: issue.code,
    message: issue.message
  }));
}

function buildReplayFrameIssuePath(pathSegments: ReadonlyArray<string | number>): string {
  if (pathSegments.length === 0) {
    return ReplayFrameIssuePathPrefix;
  }

  return `${ReplayFrameIssuePathPrefix}${ReplayFrameIssuePathSeparator}${pathSegments
    .map((segment) => String(segment))
    .join(ReplayFrameIssuePathSeparator)}`;
}
