import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../../Shared/Logging/Logger.js";
import type { EventStreamClientRegistry } from "../../Network/EventStreamClientRegistry.js";
import type { ActiveTrace, HistoryEntry, TraceSummary } from "../../Network/Routes/DebugTypes.js";

const DEFAULT_HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES = 131_072;
const RECENT_TRACE_LIMIT = 20;
const TRACE_FILE_EXTENSION = ".ndjson";
const TRACE_STREAM_OPEN_FLAGS = "a";
const TRACE_MARKER_EVENT_TYPE = "trace-marker";
const TRACE_HISTORY_EVENT_TYPE = "history";
const HISTORY_PAYLOAD_PREVIEW_MAXIMUM_BYTES = 4_096;
const TRACE_STREAM_WRITE_FAILED_LOG_EVENT = "trace-stream-write-failed";
const ACTION_EVENT_LOG_EVENT = "action-event";
const ACTION_ERROR_LOG_EVENT = "action-error";
const SYSTEM_EVENT_LOG_EVENT = "system-event";
const ACTION_DETAIL_SUMMARY_KEYS = [
  "agentId",
  "threadId",
  "ownerClientId",
  "requestId",
  "textLength",
  "cwd",
  "model"
] as const;

/**
 * Owns activity-history snapshots and trace stream lifecycle for debug endpoints.
 * `history` may store summarized payloads while `historyById` preserves the full original payload.
 */
export class ActivityHistoryService {
  private readonly historyLimit: number;
  private readonly historyPayloadSummaryMaximumBytes: number;
  private readonly recentTraceLimit: number;
  private readonly eventStreamClientRegistry: EventStreamClientRegistry;
  private readonly history: HistoryEntry[];
  private readonly historyById: Map<string, HistoryEntry["payload"]>;
  private readonly activeTraceRef: { current: ActiveTrace | null };
  private readonly recentTraces: TraceSummary[];

  public constructor(
    historyLimit: number,
    eventStreamClientRegistry: EventStreamClientRegistry,
    historyPayloadSummaryMaximumBytes = DEFAULT_HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES
  ) {
    if (!Number.isInteger(historyLimit) || historyLimit <= 0) {
      throw new Error("ActivityHistoryService requires positive integer historyLimit");
    }
    if (
      !Number.isInteger(historyPayloadSummaryMaximumBytes)
      || historyPayloadSummaryMaximumBytes <= 0
    ) {
      throw new Error(
        "ActivityHistoryService requires positive integer historyPayloadSummaryMaximumBytes"
      );
    }

    this.historyLimit = historyLimit;
    this.historyPayloadSummaryMaximumBytes = historyPayloadSummaryMaximumBytes;
    this.recentTraceLimit = RECENT_TRACE_LIMIT;
    this.eventStreamClientRegistry = eventStreamClientRegistry;
    this.history = [];
    this.historyById = new Map<string, HistoryEntry["payload"]>();
    this.activeTraceRef = { current: null };
    this.recentTraces = [];
  }

  public readHistoryEntries(): HistoryEntry[] {
    return this.history.map((historyEntry) => ({
      ...historyEntry,
      meta: { ...historyEntry.meta }
    }));
  }

  public readHistoryById(): Map<string, HistoryEntry["payload"]> {
    return new Map(this.historyById);
  }

  public readRecentTraces(): TraceSummary[] {
    return this.recentTraces.map((traceSummary) => ({ ...traceSummary }));
  }

  public readTraceById(traceId: string): TraceSummary | null {
    return this.recentTraces.find((traceSummary) => traceSummary.id === traceId) ?? null;
  }

  public readHistoryCount(): number {
    return this.history.length;
  }

  public readActiveTraceSummary(): TraceSummary | null {
    return this.activeTraceRef.current?.summary ?? null;
  }

  public startTrace(
    traceDirectoryPath: string,
    label: string,
    ensureTraceDirectory: () => void
  ): TraceSummary | null {
    if (this.activeTraceRef.current) {
      return null;
    }

    ensureTraceDirectory();
    const traceIdentifier = `${Date.now()}-${randomUUID()}`;
    const tracePath = path.join(traceDirectoryPath, `${traceIdentifier}${TRACE_FILE_EXTENSION}`);
    const stream = fs.createWriteStream(tracePath, { flags: TRACE_STREAM_OPEN_FLAGS });
    stream.on("error", (error) => {
      logger.error(
        {
          traceId: traceIdentifier,
          tracePath,
          error: error.message
        },
        TRACE_STREAM_WRITE_FAILED_LOG_EVENT
      );
    });

    const summary: TraceSummary = {
      id: traceIdentifier,
      label,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      eventCount: 0,
      path: tracePath
    };

    this.activeTraceRef.current = {
      summary,
      stream
    };

    return summary;
  }

  public markTrace(note: string): boolean {
    if (!this.activeTraceRef.current) {
      return false;
    }

    const marker = {
      type: TRACE_MARKER_EVENT_TYPE,
      at: new Date().toISOString(),
      note
    };

    this.activeTraceRef.current.stream.write(`${JSON.stringify(marker)}\n`);
    this.activeTraceRef.current.summary.eventCount += 1;
    return true;
  }

  public stopTrace(): TraceSummary | null {
    if (!this.activeTraceRef.current) {
      return null;
    }

    const trace = this.activeTraceRef.current;
    this.activeTraceRef.current = null;

    trace.summary.stoppedAt = new Date().toISOString();
    trace.stream.end();

    this.recentTraces.unshift(trace.summary);
    if (this.recentTraces.length > this.recentTraceLimit) {
      this.recentTraces.splice(this.recentTraceLimit);
    }

    return trace.summary;
  }

  public closeActiveTraceIfPresent(): void {
    if (!this.activeTraceRef.current) {
      return;
    }

    this.activeTraceRef.current.stream.end();
    this.activeTraceRef.current = null;
  }

  public pushHistory(
    source: HistoryEntry["source"],
    direction: HistoryEntry["direction"],
    payload: HistoryEntry["payload"],
    meta: HistoryEntry["meta"] = {}
  ): HistoryEntry {
    const historyPayload = this.summarizePayloadForHistory(payload);
    const entry: HistoryEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      source,
      direction,
      payload: historyPayload,
      meta
    };

    this.history.push(entry);
    this.historyById.set(entry.id, payload);

    if (this.history.length > this.historyLimit) {
      const removed = this.history.shift();
      if (removed) {
        this.historyById.delete(removed.id);
      }
    }

    this.recordTraceEvent({ type: TRACE_HISTORY_EVENT_TYPE, ...entry });
    this.eventStreamClientRegistry.broadcast({
      type: "activity-history-appended",
      entry
    });
    return entry;
  }

  public pushActionEvent(
    action: string,
    stage: "attempt" | "success" | "error",
    details: HistoryEntry["meta"]
  ): void {
    logger.debug(
      {
        action,
        stage,
        ...this.summarizeActionDetails(details)
      },
      ACTION_EVENT_LOG_EVENT
    );

    this.pushHistory("app", "out", {
      type: "action",
      action,
      stage,
      ...details
    }, details);
  }

  public pushActionFailure(
    action: string,
    errorMessage: string,
    details: HistoryEntry["meta"]
  ): string {
    logger.error(
      {
        action,
        error: errorMessage,
        ...this.summarizeActionDetails(details)
      },
      ACTION_ERROR_LOG_EVENT
    );

    this.pushActionEvent(action, "error", { ...details, error: errorMessage });
    this.pushSystem("Action failed", { action, ...details, error: errorMessage });
    return errorMessage;
  }

  public pushSystem(message: string, details: HistoryEntry["meta"] = {}): void {
    logger.debug({ message, ...details }, SYSTEM_EVENT_LOG_EVENT);
    this.pushHistory("system", "system", { message, details });
  }

  private recordTraceEvent(event: HistoryEntry["payload"]): void {
    const activeTrace = this.activeTraceRef.current;
    if (!activeTrace) {
      return;
    }

    activeTrace.summary.eventCount += 1;
    activeTrace.stream.write(`${JSON.stringify(event)}\n`);
  }

  private summarizeActionDetails(details: HistoryEntry["meta"]): HistoryEntry["meta"] {
    const summary: HistoryEntry["meta"] = {};
    for (const key of ACTION_DETAIL_SUMMARY_KEYS) {
      const value = details[key];
      if (value !== undefined) {
        summary[key] = value;
      }
    }

    return summary;
  }

  private summarizePayloadForHistory(payload: HistoryEntry["payload"]): HistoryEntry["payload"] {
    const serializedPayload = JSON.stringify(payload);
    const serializedPayloadBytes = Buffer.byteLength(serializedPayload, "utf8");
    if (serializedPayloadBytes <= this.historyPayloadSummaryMaximumBytes) {
      return payload;
    }

    const previewMaximumBytes = Math.min(
      HISTORY_PAYLOAD_PREVIEW_MAXIMUM_BYTES,
      this.historyPayloadSummaryMaximumBytes
    );
    const preview = serializedPayload.slice(0, previewMaximumBytes);
    return {
      type: "history-payload-summary",
      truncated: true,
      originalSizeBytes: serializedPayloadBytes,
      preview
    };
  }
}
