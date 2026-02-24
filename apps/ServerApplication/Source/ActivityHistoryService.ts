import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./Logger.js";
import type { EventStreamClientRegistry } from "./Network/EventStreamClientRegistry.js";
import type { ActiveTrace, HistoryEntry, TraceSummary } from "./Network/Routes/DebugTypes.js";

export class ActivityHistoryService {
  private readonly historyLimit: number;
  private readonly recentTraceLimit: number;
  private readonly eventStreamClientRegistry: EventStreamClientRegistry;
  private readonly history: HistoryEntry[];
  private readonly historyById: Map<string, HistoryEntry["payload"]>;
  private readonly activeTraceRef: { current: ActiveTrace | null };
  private readonly recentTraces: TraceSummary[];

  public constructor(
    historyLimit: number,
    eventStreamClientRegistry: EventStreamClientRegistry
  ) {
    if (!Number.isInteger(historyLimit) || historyLimit <= 0) {
      throw new Error("ActivityHistoryService requires positive integer historyLimit");
    }

    this.historyLimit = historyLimit;
    this.recentTraceLimit = 20;
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
    const tracePath = path.join(traceDirectoryPath, `${traceIdentifier}.ndjson`);
    const stream = fs.createWriteStream(tracePath, { flags: "a" });
    stream.on("error", (error) => {
      logger.error(
        {
          traceId: traceIdentifier,
          tracePath,
          error: error.message
        },
        "trace-stream-write-failed"
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
      type: "trace-marker",
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
    const entry: HistoryEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      source,
      direction,
      payload,
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

    this.recordTraceEvent({ type: "history", ...entry });
    this.eventStreamClientRegistry.broadcast({ type: "history", entry });
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
      "action-event"
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
      "action-error"
    );

    this.pushActionEvent(action, "error", { ...details, error: errorMessage });
    this.pushSystem("Action failed", { action, ...details, error: errorMessage });
    return errorMessage;
  }

  public pushSystem(message: string, details: HistoryEntry["meta"] = {}): void {
    logger.debug({ message, ...details }, "system-event");
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
    const keys = ["agentId", "threadId", "ownerClientId", "requestId", "textLength", "cwd", "model"];

    for (const key of keys) {
      const value = details[key];
      if (value !== undefined) {
        summary[key] = value;
      }
    }

    return summary;
  }
}
