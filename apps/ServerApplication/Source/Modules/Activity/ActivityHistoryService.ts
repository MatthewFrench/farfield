import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ActiveTrace, HistoryEntry, TraceSummary } from "../../Network/DebugContracts.js";
import type { EventStreamClientRegistry } from "../../Network/EventStreamClientRegistry.js";
import { logger } from "../../Shared/Logging/Logger.js";

const DEFAULT_HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES = 131_072;
const RECENT_TRACE_LIMIT = 20;
const TRACE_FILE_EXTENSION = ".ndjson";
const TRACE_STREAM_OPEN_FLAGS = "a";
const TRACE_MARKER_EVENT_TYPE = "trace-marker";
const TRACE_HISTORY_EVENT_TYPE = "history";
const HISTORY_PAYLOAD_SUMMARY_TYPE = "history-payload-summary";
const HISTORY_PAYLOAD_PREVIEW_MAXIMUM_BYTES = 4_096;
const TRACE_STREAM_WRITE_FAILED_LOG_EVENT = "trace-stream-write-failed";
const ACTION_EVENT_LOG_EVENT = "action-event";
const ACTION_ERROR_LOG_EVENT = "action-error";
const SYSTEM_EVENT_LOG_EVENT = "system-event";
const ACTIVITY_HISTORY_APPENDED_EVENT_TYPE = "activity-history-appended";
const TRACE_RECORD_LINE_ENDING = "\n";
const ACTION_DETAIL_SUMMARY_KEYS = [
  "agentId",
  "threadId",
  "ownerClientId",
  "requestId",
  "textLength",
  "cwd",
  "model",
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
    historyPayloadSummaryMaximumBytes = DEFAULT_HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES,
  ) {
    if (!Number.isInteger(historyLimit) || historyLimit <= 0) {
      throw new Error("ActivityHistoryService requires positive integer historyLimit");
    }
    if (
      !Number.isInteger(historyPayloadSummaryMaximumBytes) ||
      historyPayloadSummaryMaximumBytes <= 0
    ) {
      throw new Error(
        "ActivityHistoryService requires positive integer historyPayloadSummaryMaximumBytes",
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
      meta: { ...historyEntry.meta },
    }));
  }

  public readHistoryById(): Map<string, HistoryEntry["payload"]> {
    return new Map(this.historyById);
  }

  public readRecentTraces(): TraceSummary[] {
    return this.recentTraces.map((traceSummary) => ({ ...traceSummary }));
  }

  public readTraceById(traceId: string): TraceSummary | null {
    const traceSummary = this.recentTraces.find((summary) => summary.id === traceId);
    return traceSummary ? { ...traceSummary } : null;
  }

  public readHistoryCount(): number {
    return this.history.length;
  }

  public readActiveTraceSummary(): TraceSummary | null {
    const summary = this.activeTraceRef.current?.summary;
    return summary ? { ...summary } : null;
  }

  public startTrace(
    traceDirectoryPath: string,
    label: string,
    ensureTraceDirectory: () => void,
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
          error: error.message,
        },
        TRACE_STREAM_WRITE_FAILED_LOG_EVENT,
      );
    });

    const summary: TraceSummary = {
      id: traceIdentifier,
      label,
      startedAt: this.readCurrentTimestampIsoString(),
      stoppedAt: null,
      eventCount: 0,
      path: tracePath,
    };

    this.activeTraceRef.current = {
      summary,
      stream,
    };

    return summary;
  }

  public markTrace(note: string): boolean {
    const marker: HistoryEntry["payload"] = {
      type: TRACE_MARKER_EVENT_TYPE,
      at: this.readCurrentTimestampIsoString(),
      note,
    };

    return this.appendTraceRecordIfActive(marker);
  }

  public stopTrace(): TraceSummary | null {
    const trace = this.detachActiveTrace();
    if (!trace) {
      return null;
    }
    trace.summary.stoppedAt = this.readCurrentTimestampIsoString();
    trace.stream.end();
    this.appendRecentTraceSummary(trace.summary);

    return trace.summary;
  }

  public closeActiveTraceIfPresent(): void {
    const trace = this.detachActiveTrace();
    if (!trace) {
      return;
    }
    trace.stream.end();
  }

  public pushHistory(
    source: HistoryEntry["source"],
    direction: HistoryEntry["direction"],
    payload: HistoryEntry["payload"],
    meta: HistoryEntry["meta"] = {},
  ): HistoryEntry {
    const historyPayload = this.summarizePayloadForHistory(payload);
    const historyMeta = { ...meta };
    const entry: HistoryEntry = {
      id: randomUUID(),
      at: this.readCurrentTimestampIsoString(),
      source,
      direction,
      payload: historyPayload,
      meta: historyMeta,
    };
    this.appendHistoryEntry(entry, payload);
    this.appendTraceRecordIfActive({ type: TRACE_HISTORY_EVENT_TYPE, ...entry });
    this.eventStreamClientRegistry.broadcast({
      type: ACTIVITY_HISTORY_APPENDED_EVENT_TYPE,
      entry,
    });
    return entry;
  }

  public pushActionEvent(
    action: string,
    stage: "attempt" | "success" | "error",
    details: HistoryEntry["meta"],
  ): void {
    logger.debug(
      {
        action,
        stage,
        ...this.summarizeActionDetails(details),
      },
      ACTION_EVENT_LOG_EVENT,
    );

    this.pushHistory(
      "app",
      "out",
      {
        type: "action",
        action,
        stage,
        ...details,
      },
      details,
    );
  }

  public pushActionFailure(
    action: string,
    errorMessage: string,
    details: HistoryEntry["meta"],
  ): string {
    logger.error(
      {
        action,
        error: errorMessage,
        ...this.summarizeActionDetails(details),
      },
      ACTION_ERROR_LOG_EVENT,
    );

    this.pushActionEvent(action, "error", { ...details, error: errorMessage });
    this.pushSystem("Action failed", { action, ...details, error: errorMessage });
    return errorMessage;
  }

  public pushSystem(message: string, details: HistoryEntry["meta"] = {}): void {
    logger.debug({ message, ...details }, SYSTEM_EVENT_LOG_EVENT);
    this.pushHistory("system", "system", { message, details });
  }

  private detachActiveTrace(): ActiveTrace | null {
    const activeTrace = this.activeTraceRef.current;
    if (!activeTrace) {
      return null;
    }

    this.activeTraceRef.current = null;
    return activeTrace;
  }

  private appendTraceRecordIfActive(event: HistoryEntry["payload"]): boolean {
    const activeTrace = this.activeTraceRef.current;
    if (!activeTrace) {
      return false;
    }

    activeTrace.summary.eventCount += 1;
    activeTrace.stream.write(this.serializeTraceRecord(event));
    return true;
  }

  private serializeTraceRecord(event: HistoryEntry["payload"]): string {
    return `${JSON.stringify(event)}${TRACE_RECORD_LINE_ENDING}`;
  }

  private appendHistoryEntry(entry: HistoryEntry, originalPayload: HistoryEntry["payload"]): void {
    this.history.push(entry);
    this.historyById.set(entry.id, originalPayload);

    if (this.history.length > this.historyLimit) {
      const removedEntry = this.history.shift();
      if (removedEntry) {
        this.historyById.delete(removedEntry.id);
      }
    }
  }

  private appendRecentTraceSummary(summary: TraceSummary): void {
    this.recentTraces.unshift(summary);
    if (this.recentTraces.length > this.recentTraceLimit) {
      this.recentTraces.splice(this.recentTraceLimit);
    }
  }

  private readCurrentTimestampIsoString(): string {
    return new Date().toISOString();
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

    // Keep preview size bounded so activity history remains responsive under very large payloads.
    const previewMaximumBytes = Math.min(
      HISTORY_PAYLOAD_PREVIEW_MAXIMUM_BYTES,
      this.historyPayloadSummaryMaximumBytes,
    );
    const preview = serializedPayload.slice(0, previewMaximumBytes);
    return {
      type: HISTORY_PAYLOAD_SUMMARY_TYPE,
      truncated: true,
      originalSizeBytes: serializedPayloadBytes,
      preview,
    };
  }
}
