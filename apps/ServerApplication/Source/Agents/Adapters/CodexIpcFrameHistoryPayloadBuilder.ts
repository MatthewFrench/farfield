import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import type { CodexIpcFrameEvent } from "./CodexAgentAdapterContracts.js";

const CODEX_IPC_FRAME_HISTORY_SUMMARY_TYPE = "codex-ipc-frame-summary";

interface CodexIpcFrameHistorySummaryBase {
  type: typeof CODEX_IPC_FRAME_HISTORY_SUMMARY_TYPE;
  direction: CodexIpcFrameEvent["direction"];
  frameType: CodexIpcFrameEvent["frame"]["type"];
  method: string | null;
  threadId: string | null;
}

interface CodexIpcRequestFrameHistorySummary extends CodexIpcFrameHistorySummaryBase {
  frameType: "request";
  method: string;
  requestId: string;
  sourceClientId: string | null;
  targetClientId: string | null;
  version: number | null;
}

interface CodexIpcResponseFrameHistorySummary extends CodexIpcFrameHistorySummaryBase {
  frameType: "response";
  method: string | null;
  requestId: string;
  handledByClientId: string | null;
  resultType: "success" | "error";
}

interface CodexIpcBroadcastFrameHistorySummary extends CodexIpcFrameHistorySummaryBase {
  frameType: "broadcast";
  method: string;
  sourceClientId: string | null;
  targetClientId: string | null;
  version: number | null;
}

interface CodexIpcClientDiscoveryRequestHistorySummary extends CodexIpcFrameHistorySummaryBase {
  frameType: "client-discovery-request";
  method: string;
  requestId: string;
  nestedRequestId: string;
}

interface CodexIpcClientDiscoveryResponseHistorySummary extends CodexIpcFrameHistorySummaryBase {
  frameType: "client-discovery-response";
  method: null;
  requestId: string;
  canHandle: boolean;
}

type CodexIpcFrameHistorySummary =
  | CodexIpcBroadcastFrameHistorySummary
  | CodexIpcClientDiscoveryRequestHistorySummary
  | CodexIpcClientDiscoveryResponseHistorySummary
  | CodexIpcRequestFrameHistorySummary
  | CodexIpcResponseFrameHistorySummary;

function buildInboundFrameHistorySummary(event: CodexIpcFrameEvent): CodexIpcFrameHistorySummary {
  const baseSummary: CodexIpcFrameHistorySummaryBase = {
    type: CODEX_IPC_FRAME_HISTORY_SUMMARY_TYPE,
    direction: event.direction,
    frameType: event.frame.type,
    method: event.method,
    threadId: event.threadId,
  };

  switch (event.frame.type) {
    case "request":
      return {
        ...baseSummary,
        frameType: event.frame.type,
        method: event.frame.method,
        requestId: event.frame.requestId,
        sourceClientId: event.frame.sourceClientId ?? null,
        targetClientId: event.frame.targetClientId ?? null,
        version: event.frame.version ?? null,
      };
    case "response":
      return {
        ...baseSummary,
        frameType: event.frame.type,
        method: event.frame.method ?? null,
        requestId: event.frame.requestId,
        handledByClientId: event.frame.handledByClientId ?? null,
        resultType: event.frame.resultType,
      };
    case "broadcast":
      return {
        ...baseSummary,
        frameType: event.frame.type,
        method: event.frame.method,
        sourceClientId: event.frame.sourceClientId ?? null,
        targetClientId: event.frame.targetClientId ?? null,
        version: event.frame.version ?? null,
      };
    case "client-discovery-request":
      return {
        ...baseSummary,
        frameType: event.frame.type,
        method: event.frame.request.method,
        requestId: event.frame.requestId,
        nestedRequestId: event.frame.request.requestId,
      };
    case "client-discovery-response":
      return {
        ...baseSummary,
        frameType: event.frame.type,
        method: null,
        requestId: event.frame.requestId,
        canHandle: event.frame.response.canHandle,
      };
  }
}

/**
 * Owns bounded activity-history payload projection for Codex IPC frames.
 * Inbound frames can carry very large payloads, so history stores only a compact summary.
 * Outbound preview frames remain raw so replay/debug flows keep their request body contract.
 */
export function buildCodexIpcFrameHistoryPayload(event: CodexIpcFrameEvent): JsonValue {
  if (event.direction === "out") {
    return JsonValueSchema.parse(event.frame);
  }
  return JsonValueSchema.parse(buildInboundFrameHistorySummary(event));
}
