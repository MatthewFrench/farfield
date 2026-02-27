import { randomUUID } from "node:crypto";
import type { HistoryEntry, TraceSummary } from "../../Network/DebugContracts.js";
import type { EventStreamClientRegistry } from "../../Network/EventStreamClientRegistry.js";
import { logger } from "../../Shared/Logging/Logger.js";
import {
  summarizeActionDetails,
  summarizePayloadForHistory,
} from "./ActivityHistoryPayloadProjection.js";
import { ActivityHistoryStoreOwner } from "./ActivityHistoryStoreOwner.js";
import { ActivityTraceLifecycleOwner } from "./ActivityTraceLifecycleOwner.js";

const DEFAULT_HISTORY_PAYLOAD_SUMMARY_MAXIMUM_BYTES = 131_072;
const RECENT_TRACE_LIMIT = 20;
const TRACE_HISTORY_EVENT_TYPE = "history";
const ACTION_ERROR_LOG_EVENT = "action-error";
const ACTIVITY_HISTORY_APPENDED_EVENT_TYPE = "activity-history-appended";

/**
 * Owns activity-history snapshots and delegates storage/trace/payload-projection
 * behavior to dedicated owner modules.
 */
export class ActivityHistoryService {
  private readonly historyPayloadSummaryMaximumBytes: number;
  private readonly eventStreamClientRegistry: EventStreamClientRegistry;
  private readonly historyStoreOwner: ActivityHistoryStoreOwner;
  private readonly traceLifecycleOwner: ActivityTraceLifecycleOwner;

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

    this.historyPayloadSummaryMaximumBytes = historyPayloadSummaryMaximumBytes;
    this.eventStreamClientRegistry = eventStreamClientRegistry;
    this.historyStoreOwner = new ActivityHistoryStoreOwner(historyLimit);
    this.traceLifecycleOwner = new ActivityTraceLifecycleOwner(RECENT_TRACE_LIMIT);
  }

  public readHistoryEntries(): HistoryEntry[] {
    return this.historyStoreOwner.readHistoryEntries();
  }

  public readHistoryById(): Map<string, HistoryEntry["payload"]> {
    return this.historyStoreOwner.readHistoryById();
  }

  public readRecentTraces(): TraceSummary[] {
    return this.traceLifecycleOwner.readRecentTraces();
  }

  public readTraceById(traceId: string): TraceSummary | null {
    return this.traceLifecycleOwner.readTraceById(traceId);
  }

  public readHistoryCount(): number {
    return this.historyStoreOwner.readHistoryCount();
  }

  public readActiveTraceSummary(): TraceSummary | null {
    return this.traceLifecycleOwner.readActiveTraceSummary();
  }

  public startTrace(
    traceDirectoryPath: string,
    label: string,
    ensureTraceDirectory: () => void,
  ): TraceSummary | null {
    return this.traceLifecycleOwner.startTrace(
      traceDirectoryPath,
      label,
      ensureTraceDirectory,
      () => this.readCurrentTimestampIsoString(),
    );
  }

  public markTrace(note: string): boolean {
    return this.traceLifecycleOwner.markTrace(note, () => this.readCurrentTimestampIsoString());
  }

  public stopTrace(): TraceSummary | null {
    return this.traceLifecycleOwner.stopTrace(() => this.readCurrentTimestampIsoString());
  }

  public closeActiveTraceIfPresent(): void {
    this.traceLifecycleOwner.closeActiveTraceIfPresent();
  }

  public pushHistory(
    source: HistoryEntry["source"],
    direction: HistoryEntry["direction"],
    payload: HistoryEntry["payload"],
    meta: HistoryEntry["meta"] = {},
  ): HistoryEntry {
    const historyPayload = summarizePayloadForHistory(
      payload,
      this.historyPayloadSummaryMaximumBytes,
    );
    const historyMeta = { ...meta };
    const entry: HistoryEntry = {
      id: randomUUID(),
      at: this.readCurrentTimestampIsoString(),
      source,
      direction,
      payload: historyPayload,
      meta: historyMeta,
    };
    this.historyStoreOwner.appendHistoryEntry(entry, payload);
    this.traceLifecycleOwner.appendTraceRecordIfActive({
      type: TRACE_HISTORY_EVENT_TYPE,
      ...entry,
    });
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
    // Commented out to reduce huge amounts of noise from high-frequency action lifecycle events.
    // logger.debug(
    //   {
    //     action,
    //     stage,
    //     ...summarizeActionDetails(details),
    //   },
    //   "action-event",
    // );

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
        ...summarizeActionDetails(details),
      },
      ACTION_ERROR_LOG_EVENT,
    );

    this.pushActionEvent(action, "error", { ...details, error: errorMessage });
    this.pushSystem("Action failed", {
      action,
      ...details,
      error: errorMessage,
    });
    return errorMessage;
  }

  public pushSystem(message: string, details: HistoryEntry["meta"] = {}): void {
    // Commented out to reduce huge amounts of noise from high-frequency system events.
    // logger.debug({ message, ...details }, "system-event");
    this.pushHistory("system", "system", { message, details });
  }

  private readCurrentTimestampIsoString(): string {
    return new Date().toISOString();
  }
}
