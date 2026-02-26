import { z } from "zod";
import type { CodexIpcFrameEvent } from "../Agents/Adapters/CodexAgentAdapter.js";

export const THREAD_STREAM_STATE_CHANGED_METHOD = "thread-stream-state-changed";
export const THREAD_STREAM_STATE_CHANGED_BATCH_EVENT_TYPE = "thread-stream-state-changed-batch";
export const THREAD_STREAM_STATE_CHANGED_MINIMUM_FLUSH_INTERVAL_MILLISECONDS = 1;
export const THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE =
  "flushIntervalMs must be a finite positive integer number of milliseconds.";

const ThreadStreamStateChangedFlushIntervalMillisecondsSchema = z
  .number({
    invalid_type_error: THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE,
    required_error: THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE
  })
  .finite(THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE)
  .int(THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE)
  .min(
    THREAD_STREAM_STATE_CHANGED_MINIMUM_FLUSH_INTERVAL_MILLISECONDS,
    THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE
  );

const THREAD_STREAM_STATE_CHANGED_BUFFER_INVARIANT_VIOLATION_MESSAGE =
  "Thread stream batch owner buffered state became inconsistent. bufferedEventCount and bufferedFirstAtMs must be either both empty or both populated.";

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
  private bufferedEventCount = 0;
  private bufferedFirstAtMs: number | null = null;
  private bufferedLatestThreadId: string | null = null;

  public constructor(dependencies: ThreadStreamStateChangedHistoryBatchOwnerDependencies) {
    this.flushIntervalMs = ThreadStreamStateChangedFlushIntervalMillisecondsSchema.parse(dependencies.flushIntervalMs);
    this.emitSummary = dependencies.emitSummary;
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

    if (this.shouldFlushBufferedSummary(nowMs)) {
      this.flushBufferedSummary(nowMs);
    }

    return true;
  }

  public flushBufferedSummary(nowMs: number): void {
    if (this.bufferedEventCount === 0 && this.bufferedFirstAtMs === null) {
      return;
    }

    if (this.bufferedEventCount === 0 || this.bufferedFirstAtMs === null) {
      throw new Error(THREAD_STREAM_STATE_CHANGED_BUFFER_INVARIANT_VIOLATION_MESSAGE);
    }

    const spanMs = Math.max(0, nowMs - this.bufferedFirstAtMs);
    this.emitSummary({
      count: this.bufferedEventCount,
      spanMs,
      latestThreadId: this.bufferedLatestThreadId
    });

    this.resetBufferedSummaryState();
  }

  private shouldFlushBufferedSummary(nowMs: number): boolean {
    if (this.bufferedFirstAtMs === null) {
      return false;
    }
    const elapsedSinceFirstBufferedEventMilliseconds = nowMs - this.bufferedFirstAtMs;
    return elapsedSinceFirstBufferedEventMilliseconds >= this.flushIntervalMs;
  }

  private resetBufferedSummaryState(): void {
    this.bufferedEventCount = 0;
    this.bufferedFirstAtMs = null;
    this.bufferedLatestThreadId = null;
  }
}
