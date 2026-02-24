import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SendRequestOptions } from "@farfield/api";
import {
  CreateDebugClientErrorBodySchema,
  JsonValueSchema,
  type IpcRequestFrame,
  type JsonValue
} from "@farfield/protocol";
import { z } from "zod";
import { parseBody, ReplayBodySchema, TraceMarkBodySchema, TraceStartBodySchema } from "../../HttpSchemas.js";
import type { CodexAgentAdapter } from "../../Agents/Adapters/CodexAgent.js";
import type { ActivityHistoryService } from "../../ActivityHistoryService.js";
import type { ClientErrorStore } from "../../ClientErrorStore.js";
import type { ServerObservabilitySnapshot } from "../ServerObservabilitySnapshotOwner.js";
import { streamDebugFileDownload } from "./DebugFileDownload.js";

const ReplayFrameSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("request"),
        method: z.string().trim().min(1),
        params: JsonValueSchema.optional(),
        targetClientId: z.string().optional(),
        version: z.number().int().optional()
      })
      .passthrough(),
    z
      .object({
        type: z.literal("broadcast"),
        method: z.string().trim().min(1),
        params: JsonValueSchema.optional(),
        targetClientId: z.string().optional(),
        version: z.number().int().optional()
      })
      .passthrough()
  ])
  .superRefine((value, context) => {
    if (value.method.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Captured IPC frame has invalid method"
      });
    }
  });

interface ParsedReplayFrame {
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
    origin: string;
    source: string;
    operation: string;
    requestId: string | null;
    threadId: string | null;
    message: string;
  }) => void;
}

function parseReplayFrame(payload: JsonValue): ParsedReplayFrame {
  const parsed = ReplayFrameSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  return {
    type: parsed.data.type,
    method: parsed.data.method,
    params: parsed.data.params,
    ...(parsed.data.targetClientId ? { targetClientId: parsed.data.targetClientId } : {}),
    ...(typeof parsed.data.version === "number" ? { version: parsed.data.version } : {})
  };
}

export async function handleDebugRoutes(deps: DebugRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    segments,
    url,
    traceDirectoryPath,
    activityHistoryService,
    codexAdapter,
    clientErrorStore,
    readObservabilitySnapshot,
    parseInteger,
    toErrorMessage,
    pushSystem,
    ensureTraceDirectory,
    jsonResponse,
    readJsonBody,
    onClientErrorRecorded
  } = deps;

  if (segments[0] !== "api" || segments[1] !== "debug") {
    return false;
  }

  if (req.method === "POST" && pathname === "/api/debug/client-errors") {
    const body = parseBody(CreateDebugClientErrorBodySchema, await readJsonBody(req));
    const event = clientErrorStore.recordClientError(body);
    onClientErrorRecorded({
      errorId: event.errorId,
      origin: event.origin,
      source: event.source,
      operation: event.operation,
      requestId: event.requestId,
      threadId: event.threadId,
      message: event.message
    });
    jsonResponse(res, 200, {
      ok: true,
      errorId: event.errorId,
      sessionId: event.sessionId,
      recordedAt: event.recordedAt
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/debug/client-errors") {
    const limit = parseInteger(url.searchParams.get("limit"), 120);
    const data = clientErrorStore.list(limit);
    jsonResponse(res, 200, {
      ok: true,
      data,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath()
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/debug/client-errors/session-log") {
    const filePath = clientErrorStore.getSessionLogPath();
    const fileName = path.basename(filePath);
    try {
      await streamDebugFileDownload(res, filePath, fileName);
      return true;
    } catch (error) {
      if (toErrorMessage(error).includes("ENOENT")) {
        jsonResponse(res, 404, {
          ok: false,
          error: "Client error session log not found"
        });
        return true;
      }
      jsonResponse(res, 500, {
        ok: false,
        error: toErrorMessage(error)
      });
      return true;
    }
  }

  const clientErrorIdSegment = segments[3];
  if (
    req.method === "GET" &&
    segments[2] === "client-errors" &&
    segments.length === 4 &&
    typeof clientErrorIdSegment === "string"
  ) {
    const errorId = decodeURIComponent(clientErrorIdSegment);
    const errorEvent = clientErrorStore.getById(errorId);
    if (!errorEvent) {
      jsonResponse(res, 404, {
        ok: false,
        error: "Client error not found"
      });
      return true;
    }

    jsonResponse(res, 200, {
      ok: true,
      error: errorEvent,
      sessionId: clientErrorStore.getSessionId(),
      sessionLogPath: clientErrorStore.getSessionLogPath()
    });
    return true;
  }

  const historyEntrySegment = segments[3];
  if (
    req.method === "GET" &&
    segments[2] === "history" &&
    segments.length === 4 &&
    typeof historyEntrySegment === "string"
  ) {
    const entryId = decodeURIComponent(historyEntrySegment);
    const entry = activityHistoryService.readHistoryEntries().find((item) => item.id === entryId) ?? null;
    if (!entry) {
      jsonResponse(res, 404, { ok: false, error: "History entry not found" });
      return true;
    }

    jsonResponse(res, 200, {
      ok: true,
      entry,
      fullPayload: activityHistoryService.readHistoryById().get(entryId) ?? null
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/debug/history") {
    const limit = parseInteger(url.searchParams.get("limit"), 120);
    const data = activityHistoryService.readHistoryEntries().slice(-limit);
    jsonResponse(res, 200, { ok: true, history: data });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/debug/observability") {
    jsonResponse(res, 200, {
      ok: true,
      snapshot: readObservabilitySnapshot()
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/debug/replay") {
    if (!codexAdapter) {
      jsonResponse(res, 503, {
        ok: false,
        error: "Codex adapter is not enabled"
      });
      return true;
    }

    if (!codexAdapter.isIpcReady()) {
      jsonResponse(res, 503, {
        ok: false,
        error: codexAdapter.getRuntimeState().lastError ?? "Desktop IPC is not connected"
      });
      return true;
    }

    const body = parseBody(ReplayBodySchema, await readJsonBody(req));
    const entry = activityHistoryService.readHistoryEntries().find((item) => item.id === body.entryId);
    if (!entry) {
      jsonResponse(res, 404, { ok: false, error: "History entry not found" });
      return true;
    }

    const replayPayload = activityHistoryService.readHistoryById().get(entry.id);
    if (replayPayload === undefined) {
      jsonResponse(res, 409, {
        ok: false,
        error: "History payload not found"
      });
      return true;
    }

    let frame: ParsedReplayFrame;
    try {
      frame = parseReplayFrame(replayPayload);
    } catch (error) {
      jsonResponse(res, 409, {
        ok: false,
        error: toErrorMessage(error)
      });
      return true;
    }

    const options: SendRequestOptions = {
      ...(frame.targetClientId ? { targetClientId: frame.targetClientId } : {}),
      ...(typeof frame.version === "number" ? { version: frame.version } : {})
    };

    if (frame.type === "request") {
      const replayPromise = codexAdapter.replayRequest(frame.method, frame.params, options);

      if (body.waitForResponse) {
        const response = await replayPromise;
        jsonResponse(res, 200, {
          ok: true,
          replayed: true,
          response
        });
        return true;
      }

      void replayPromise.catch((error) => {
        pushSystem("Replay request failed", {
          error: toErrorMessage(error),
          entryId: entry.id
        });
      });

      jsonResponse(res, 200, {
        ok: true,
        replayed: true,
        queued: true
      });
      return true;
    }

    codexAdapter.replayBroadcast(frame.method, frame.params, options);
    jsonResponse(res, 200, { ok: true, replayed: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/debug/trace/status") {
    jsonResponse(res, 200, {
      ok: true,
      active: activityHistoryService.readActiveTraceSummary(),
      recent: activityHistoryService.readRecentTraces()
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/debug/trace/start") {
    const body = parseBody(TraceStartBodySchema, await readJsonBody(req));
    const summary = activityHistoryService.startTrace(
      traceDirectoryPath,
      body.label,
      ensureTraceDirectory
    );
    if (!summary) {
      jsonResponse(res, 409, {
        ok: false,
        error: "A trace is already active"
      });
      return true;
    }

    pushSystem("Trace started", {
      traceId: summary.id,
      label: body.label
    });

    jsonResponse(res, 200, {
      ok: true,
      trace: summary
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/debug/trace/mark") {
    const body = parseBody(TraceMarkBodySchema, await readJsonBody(req));
    const marked = activityHistoryService.markTrace(body.note);
    if (!marked) {
      jsonResponse(res, 409, { ok: false, error: "No active trace" });
      return true;
    }

    jsonResponse(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/debug/trace/stop") {
    const summary = activityHistoryService.stopTrace();
    if (!summary) {
      jsonResponse(res, 409, { ok: false, error: "No active trace" });
      return true;
    }

    pushSystem("Trace stopped", { traceId: summary.id });

    jsonResponse(res, 200, {
      ok: true,
      trace: summary
    });
    return true;
  }

  if (
    req.method === "GET" &&
    segments[2] === "trace" &&
    segments[3] &&
    segments[4] === "download"
  ) {
    const traceId = decodeURIComponent(segments[3]);
    const trace = activityHistoryService.readTraceById(traceId);

    if (!trace) {
      jsonResponse(res, 404, { ok: false, error: "Trace not found" });
      return true;
    }

    try {
      await streamDebugFileDownload(res, trace.path, `${trace.id}.ndjson`);
    } catch (error) {
      if (toErrorMessage(error).includes("ENOENT")) {
        jsonResponse(res, 404, { ok: false, error: "Trace not found" });
        return true;
      }
      jsonResponse(res, 500, { ok: false, error: toErrorMessage(error) });
      return true;
    }
    return true;
  }

  return false;
}
