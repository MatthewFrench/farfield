import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ActiveTrace, HistoryEntry, TraceSummary } from "../../Network/DebugContracts.js";
import { logger } from "../../Shared/Logging/Logger.js";

const TRACE_FILE_EXTENSION = ".ndjson";
const TRACE_STREAM_OPEN_FLAGS = "a";
const TRACE_MARKER_EVENT_TYPE = "trace-marker";
const TRACE_STREAM_WRITE_FAILED_LOG_EVENT = "trace-stream-write-failed";
const TRACE_RECORD_LINE_ENDING = "\n";

/**
 * Owns debug trace stream lifecycle, active-trace state, and bounded recent-trace retention.
 */
export class ActivityTraceLifecycleOwner {
  private readonly activeTraceRef: { current: ActiveTrace | null } = { current: null };
  private readonly recentTraces: TraceSummary[] = [];

  public constructor(private readonly recentTraceLimit: number) {}

  public readRecentTraces(): TraceSummary[] {
    return this.recentTraces.map((traceSummary) => ({ ...traceSummary }));
  }

  public readTraceById(traceId: string): TraceSummary | null {
    const traceSummary = this.recentTraces.find((summary) => summary.id === traceId);
    return traceSummary ? { ...traceSummary } : null;
  }

  public readActiveTraceSummary(): TraceSummary | null {
    const summary = this.activeTraceRef.current?.summary;
    return summary ? { ...summary } : null;
  }

  public startTrace(
    traceDirectoryPath: string,
    label: string,
    ensureTraceDirectory: () => void,
    readCurrentTimestampIsoString: () => string,
  ): TraceSummary | null {
    if (this.activeTraceRef.current) {
      return null;
    }

    ensureTraceDirectory();
    const traceIdentifier = `${Date.now()}-${randomUUID()}`;
    const tracePath = path.join(traceDirectoryPath, `${traceIdentifier}${TRACE_FILE_EXTENSION}`);
    const stream = fs.createWriteStream(tracePath, {
      flags: TRACE_STREAM_OPEN_FLAGS,
    });
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
      startedAt: readCurrentTimestampIsoString(),
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

  public markTrace(note: string, readCurrentTimestampIsoString: () => string): boolean {
    const marker: HistoryEntry["payload"] = {
      type: TRACE_MARKER_EVENT_TYPE,
      at: readCurrentTimestampIsoString(),
      note,
    };

    return this.appendTraceRecordIfActive(marker);
  }

  public stopTrace(readCurrentTimestampIsoString: () => string): TraceSummary | null {
    const trace = this.detachActiveTrace();
    if (!trace) {
      return null;
    }
    trace.summary.stoppedAt = readCurrentTimestampIsoString();
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

  public appendTraceRecordIfActive(event: HistoryEntry["payload"]): boolean {
    const activeTrace = this.activeTraceRef.current;
    if (!activeTrace) {
      return false;
    }

    activeTrace.summary.eventCount += 1;
    activeTrace.stream.write(this.serializeTraceRecord(event));
    return true;
  }

  private detachActiveTrace(): ActiveTrace | null {
    const activeTrace = this.activeTraceRef.current;
    if (!activeTrace) {
      return null;
    }

    this.activeTraceRef.current = null;
    return activeTrace;
  }

  private serializeTraceRecord(event: HistoryEntry["payload"]): string {
    return `${JSON.stringify(event)}${TRACE_RECORD_LINE_ENDING}`;
  }

  private appendRecentTraceSummary(summary: TraceSummary): void {
    this.recentTraces.unshift(summary);
    if (this.recentTraces.length > this.recentTraceLimit) {
      this.recentTraces.splice(this.recentTraceLimit);
    }
  }
}
