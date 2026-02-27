import type { IpcFrame } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import type { CodexIpcFrameEvent } from "../Source/Agents/Adapters/CodexAgentAdapter.js";
import {
  THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE,
  THREAD_STREAM_STATE_CHANGED_METHOD,
  type ThreadStreamStateChangedBatchSummary,
  ThreadStreamStateChangedHistoryBatchOwner,
} from "../Source/Application/ThreadStreamStateChangedHistoryBatchOwner.js";

function createIpcFrameEvent(method: string, threadId: string | null): CodexIpcFrameEvent {
  const frame: IpcFrame = {
    type: "broadcast",
    method,
    params: {},
    sourceClientId: "client-a",
    version: 1,
  };

  return {
    direction: "in",
    frame,
    method,
    threadId,
  };
}

describe("ThreadStreamStateChangedHistoryBatchOwner", () => {
  it("rejects non-integer and non-positive flush intervals", () => {
    const invalidFlushIntervals = [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY];
    for (const flushIntervalMs of invalidFlushIntervals) {
      expect(
        () =>
          new ThreadStreamStateChangedHistoryBatchOwner({
            flushIntervalMs,
            emitSummary: () => {
              throw new Error("emitSummary must not run during constructor validation.");
            },
          }),
      ).toThrowError(THREAD_STREAM_STATE_CHANGED_INVALID_FLUSH_INTERVAL_MESSAGE);
    }
  });

  it("ignores non stream-state methods", () => {
    const summaries: ThreadStreamStateChangedBatchSummary[] = [];
    const owner = new ThreadStreamStateChangedHistoryBatchOwner({
      flushIntervalMs: 1_000,
      emitSummary: (summary) => {
        summaries.push(summary);
      },
    });

    const handled = owner.handleFrame(createIpcFrameEvent("thread-read", "thread-1"), 10);
    expect(handled).toBe(false);
    owner.flushBufferedSummary(500);
    expect(summaries).toHaveLength(0);
  });

  it("flushes only when elapsed time reaches the flush interval boundary", () => {
    const summaries: ThreadStreamStateChangedBatchSummary[] = [];
    const owner = new ThreadStreamStateChangedHistoryBatchOwner({
      flushIntervalMs: 1_000,
      emitSummary: (summary) => {
        summaries.push(summary);
      },
    });

    expect(
      owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-1"), 0),
    ).toBe(true);
    expect(
      owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-2"), 999),
    ).toBe(true);
    expect(summaries).toHaveLength(0);

    expect(
      owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-3"), 1_000),
    ).toBe(true);
    expect(summaries).toEqual([
      {
        count: 3,
        spanMs: 1_000,
        latestThreadId: "thread-3",
      },
    ]);
  });

  it("flushes pending summaries on demand and resets buffer state", () => {
    const summaries: ThreadStreamStateChangedBatchSummary[] = [];
    const owner = new ThreadStreamStateChangedHistoryBatchOwner({
      flushIntervalMs: 5_000,
      emitSummary: (summary) => {
        summaries.push(summary);
      },
    });

    expect(
      owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-1"), 50),
    ).toBe(true);
    expect(
      owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, null), 80),
    ).toBe(true);
    owner.flushBufferedSummary(100);

    expect(summaries).toEqual([
      {
        count: 2,
        spanMs: 50,
        latestThreadId: null,
      },
    ]);

    owner.flushBufferedSummary(120);
    expect(summaries).toHaveLength(1);
  });

  it("treats flush as a no-op when no events are buffered", () => {
    const summaries: ThreadStreamStateChangedBatchSummary[] = [];
    const owner = new ThreadStreamStateChangedHistoryBatchOwner({
      flushIntervalMs: 1_000,
      emitSummary: (summary) => {
        summaries.push(summary);
      },
    });

    owner.flushBufferedSummary(25);
    owner.flushBufferedSummary(50);
    expect(summaries).toHaveLength(0);

    expect(
      owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-1"), 80),
    ).toBe(true);
    owner.flushBufferedSummary(100);

    expect(summaries).toEqual([
      {
        count: 1,
        spanMs: 20,
        latestThreadId: "thread-1",
      },
    ]);
  });
});
