import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SendRequestOptions } from "@farfield/api";
import {
  type DebugErrorEvent,
  type DebugErrorSeverity,
  type IpcRequestFrame,
  type JsonValue
} from "@farfield/protocol";
import type { CodexAgentAdapter } from "../../Agents/Adapters/CodexAgentAdapter.js";
import type { ActivityHistoryService } from "../../Modules/Activity/ActivityHistoryService.js";
import type { ClientErrorStore } from "../../Modules/Debugging/ClientErrorStore.js";
import type { ServerObservabilitySnapshot } from "../ServerObservabilitySnapshotOwner.js";

export const DebugRouteMethodByName = {
  get: "GET",
  post: "POST",
  delete: "DELETE"
} as const;

export const DebugRoutePathnameByName = {
  clientErrors: "/api/debug/client-errors",
  clientErrorSessionLog: "/api/debug/client-errors/session-log",
  history: "/api/debug/history",
  observability: "/api/debug/observability",
  replay: "/api/debug/replay",
  traceStatus: "/api/debug/trace/status",
  traceStart: "/api/debug/trace/start",
  traceMark: "/api/debug/trace/mark",
  traceStop: "/api/debug/trace/stop"
} as const;

export const DebugRouteSegmentByName = {
  api: "api",
  debug: "debug",
  clientErrors: "client-errors",
  history: "history",
  trace: "trace",
  download: "download"
} as const;

export const DebugReplayFrameTypeByName = {
  request: "request",
  broadcast: "broadcast"
} as const;

export type DebugReplayFrameType =
  typeof DebugReplayFrameTypeByName[keyof typeof DebugReplayFrameTypeByName];

export interface ParsedReplayFrame {
  type: DebugReplayFrameType;
  method: string;
  params: IpcRequestFrame["params"];
  targetClientId?: string;
  version?: number;
}

export const DebugReplayFrameParseErrorTypeByName = {
  invalidReplayFramePayload: "invalid-replay-frame-payload"
} as const;

export type DebugReplayFrameParseErrorType =
  typeof DebugReplayFrameParseErrorTypeByName[keyof typeof DebugReplayFrameParseErrorTypeByName];

export interface DebugReplayFrameParseIssue {
  path: string;
  issueCode: string;
  message: string;
}

export interface DebugReplayFrameParseErrorDetails {
  errorType: DebugReplayFrameParseErrorType;
  issues: ReadonlyArray<DebugReplayFrameParseIssue>;
}

export const DebugReplayFrameParseErrorMessagePrefix = "Invalid replay frame payload";
const DebugReplayFrameParseErrorMessageLocationPrefix = " at ";
const DebugReplayFrameParseErrorMessageDetailSeparator = ": ";

function cloneReplayFrameParseIssue(issue: DebugReplayFrameParseIssue): DebugReplayFrameParseIssue {
  return {
    path: issue.path,
    issueCode: issue.issueCode,
    message: issue.message
  };
}

function cloneReplayFrameParseErrorDetails(
  details: DebugReplayFrameParseErrorDetails
): DebugReplayFrameParseErrorDetails {
  return {
    errorType: details.errorType,
    issues: details.issues.map(cloneReplayFrameParseIssue)
  };
}

function buildReplayFrameParseErrorMessage(details: DebugReplayFrameParseErrorDetails): string {
  const firstIssue = details.issues[0];
  if (!firstIssue) {
    return DebugReplayFrameParseErrorMessagePrefix;
  }

  return `${DebugReplayFrameParseErrorMessagePrefix}${DebugReplayFrameParseErrorMessageLocationPrefix}${firstIssue.path}${DebugReplayFrameParseErrorMessageDetailSeparator}${firstIssue.message}`;
}

export class DebugReplayFrameParseError extends Error {
  public readonly details: DebugReplayFrameParseErrorDetails;

  public constructor(details: DebugReplayFrameParseErrorDetails) {
    const stableDetails = cloneReplayFrameParseErrorDetails(details);
    super(buildReplayFrameParseErrorMessage(stableDetails));
    this.name = "DebugReplayFrameParseError";
    this.details = stableDetails;
  }
}

export interface DebugRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  segments: string[];
  url: URL;
  traceDirectoryPath: string;
  activityHistoryService: ActivityHistoryService;
  codexAdapter: CodexAgentAdapter | null;
  clientErrorStore: ClientErrorStore;
  readObservabilitySnapshot: () => ServerObservabilitySnapshot;
  parseInteger: (value: string | null, defaultValue: number) => number;
  toErrorMessage: <ErrorType>(error: ErrorType) => string;
  pushSystem: (message: string, details?: Record<string, JsonValue>) => void;
  ensureTraceDirectory: () => void;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  onClientErrorRecorded: (input: {
    errorId: string;
    origin: DebugErrorEvent["origin"];
    severity: DebugErrorSeverity;
    source: string;
    operation: string;
    requestId: string | null;
    threadId: string | null;
    message: string;
  }) => void;
}

export function readFileNameFromPath(filePath: string): string {
  return path.basename(filePath);
}

export function buildSendRequestOptions(parsedReplayFrame: ParsedReplayFrame): SendRequestOptions {
  // Keep optional-field handling explicit so provided values are never dropped by truthy filtering.
  return {
    ...(parsedReplayFrame.targetClientId === undefined
      ? {}
      : { targetClientId: parsedReplayFrame.targetClientId }),
    ...(parsedReplayFrame.version === undefined
      ? {}
      : { version: parsedReplayFrame.version })
  };
}
