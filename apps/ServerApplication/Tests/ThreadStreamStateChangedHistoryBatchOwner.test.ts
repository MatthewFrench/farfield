import type { IpcFrame } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import type { CodexIpcFrameEvent } from "../Source/Agents/Adapters/CodexAgentAdapter.js";
import {
  THREAD_STREAM_STATE_CHANGED_METHOD,
  type ThreadStreamStateChangedBatchSummary,
  ThreadStreamStateChangedHistoryBatchOwner
} from "../Source/Application/ThreadStreamStateChangedHistoryBatchOwner.js";

function createIpcFrameEvent(method: string, threadId: string | null): CodexIpcFrameEvent {
  const frame: IpcFrame = {
    type: "broadcast",
    method,
    params: {},
    sourceClientId: "client-a",
    version: 1
  };

  return {
    direction: "in",
    frame,
    method,
    threadId
  };
}

describe("ThreadStreamStateChangedHistoryBatchOwner", () => {
  it("ignores non stream-state methods", () => {
    const summaries: ThreadStreamStateChangedBatchSummary[] = [];
    const owner = new ThreadStreamStateChangedHistoryBatchOwner({
      flushIntervalMs: 1_000,
      emitSummary: (summary) => {
        summaries.push(summary);
      }
    });

    const handled = owner.handleFrame(createIpcFrameEvent("thread-read", "thread-1"), 10);
    expect(handled).toBe(false);
    owner.flushBufferedSummary(500);
    expect(summaries).toHaveLength(0);
  });

  it("emits a summary when the flush interval is reached", () => {
    const summaries: ThreadStreamStateChangedBatchSummary[] = [];
    const owner = new ThreadStreamStateChangedHistoryBatchOwner({
      flushIntervalMs: 1_000,
      emitSummary: (summary) => {
        summaries.push(summary);
      }
    });

    expect(owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-1"), 0)).toBe(true);
    expect(owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-2"), 400)).toBe(true);
    expect(summaries).toHaveLength(0);

    expect(owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-3"), 1_000)).toBe(true);
    expect(summaries).toEqual([{
      count: 3,
      spanMs: 1_000,
      latestThreadId: "thread-3"
    }]);
  });

  it("flushes pending summaries on demand and resets buffer state", () => {
    const summaries: ThreadStreamStateChangedBatchSummary[] = [];
    const owner = new ThreadStreamStateChangedHistoryBatchOwner({
      flushIntervalMs: 5_000,
      emitSummary: (summary) => {
        summaries.push(summary);
      }
    });

    expect(owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, "thread-1"), 50)).toBe(true);
    expect(owner.handleFrame(createIpcFrameEvent(THREAD_STREAM_STATE_CHANGED_METHOD, null), 80)).toBe(true);
    owner.flushBufferedSummary(100);

    expect(summaries).toEqual([{
      count: 2,
      spanMs: 50,
      latestThreadId: null
    }]);

    owner.flushBufferedSummary(120);
    expect(summaries).toHaveLength(1);
  });
});
