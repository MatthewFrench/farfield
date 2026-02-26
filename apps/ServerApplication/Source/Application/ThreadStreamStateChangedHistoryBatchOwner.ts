import type { CodexIpcFrameEvent } from "../Agents/Adapters/CodexAgentAdapter.js";

export const THREAD_STREAM_STATE_CHANGED_METHOD = "thread-stream-state-changed";
export const THREAD_STREAM_STATE_CHANGED_BATCH_EVENT_TYPE = "thread-stream-state-changed-batch";

export interface ThreadStreamStateChangedBatchSummary {
  count: number;
  spanMs: number;
  latestThreadId: string | null;
}

export interface ThreadStreamStateChangedHistoryBatchOwnerDependencies {
  flushIntervalMs: number;
  emitSummary: (summary: ThreadStreamStateChangedBatchSummary) => void;
}

/**
 * Owns buffered history summarization for high-frequency thread stream updates.
 * The owner batches matching IPC frame methods and emits compact summaries at a fixed interval.
 */
export class ThreadStreamStateChangedHistoryBatchOwner {
  private readonly flushIntervalMs: number;
  private readonly emitSummary: (summary: ThreadStreamStateChangedBatchSummary) => void;
  private bufferedEventCount: number;
  private bufferedFirstAtMs: number | null;
  private bufferedLatestThreadId: string | null;

  public constructor(dependencies: ThreadStreamStateChangedHistoryBatchOwnerDependencies) {
    this.flushIntervalMs = dependencies.flushIntervalMs;
    this.emitSummary = dependencies.emitSummary;
    this.bufferedEventCount = 0;
    this.bufferedFirstAtMs = null;
    this.bufferedLatestThreadId = null;
  }

  public handleFrame(event: CodexIpcFrameEvent, nowMs: number): boolean {
    if (event.method !== THREAD_STREAM_STATE_CHANGED_METHOD) {
      return false;
    }

    this.bufferedEventCount += 1;
    if (this.bufferedFirstAtMs === null) {
      this.bufferedFirstAtMs = nowMs;
    }
    this.bufferedLatestThreadId = event.threadId;

    if (nowMs - this.bufferedFirstAtMs >= this.flushIntervalMs) {
      this.flushBufferedSummary(nowMs);
    }

    return true;
  }

  public flushBufferedSummary(nowMs: number): void {
    if (this.bufferedEventCount === 0 || this.bufferedFirstAtMs === null) {
      return;
    }

    const spanMs = Math.max(0, nowMs - this.bufferedFirstAtMs);
    this.emitSummary({
      count: this.bufferedEventCount,
      spanMs,
      latestThreadId: this.bufferedLatestThreadId
    });

    this.bufferedEventCount = 0;
    this.bufferedFirstAtMs = null;
    this.bufferedLatestThreadId = null;
  }
}
