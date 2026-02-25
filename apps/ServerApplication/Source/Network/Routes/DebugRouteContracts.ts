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

export interface ParsedReplayFrame {
  type: "request" | "broadcast";
  method: string;
  params: IpcRequestFrame["params"];
  targetClientId?: string;
  version?: number;
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
  return {
    ...(parsedReplayFrame.targetClientId ? { targetClientId: parsedReplayFrame.targetClientId } : {}),
    ...(typeof parsedReplayFrame.version === "number" ? { version: parsedReplayFrame.version } : {})
  };
}
