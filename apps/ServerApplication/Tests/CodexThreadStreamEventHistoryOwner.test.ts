import type { IpcFrame } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  CodexThreadStreamEventHistoryOwner,
  STREAM_EVENT_LIMIT_ERROR_MESSAGE,
} from "../Source/Agents/Adapters/CodexThreadStreamEventHistoryOwner.js";

function createRequestFrame(requestId: string): IpcFrame {
  return {
    type: "request",
    requestId,
    method: "thread-read",
    params: {
      conversationId: "thread-1",
    },
  };
}

describe("CodexThreadStreamEventHistoryOwner", () => {
  it("rejects non-positive stream event limits", () => {
    expect(() => new CodexThreadStreamEventHistoryOwner(0)).toThrow(
      STREAM_EVENT_LIMIT_ERROR_MESSAGE,
    );
  });

  it("retains bounded history while keeping monotonic event sequences", () => {
    const owner = new CodexThreadStreamEventHistoryOwner(2);

    expect(owner.appendStreamEvent("thread-1", createRequestFrame("request-1"))).toBe(0);
    expect(owner.appendStreamEvent("thread-1", createRequestFrame("request-2"))).toBe(1);
    expect(owner.appendStreamEvent("thread-1", createRequestFrame("request-3"))).toBe(2);

    const streamSlice = owner.readStreamEvents("thread-1", "client-a", {
      limit: 20,
      sinceSequence: null,
    });

    expect(streamSlice.ownerClientId).toBe("client-a");
    expect(streamSlice.firstAvailableSequence).toBe(1);
    expect(streamSlice.nextSequence).toBe(3);
    expect(streamSlice.resetRequired).toBe(false);
    expect(streamSlice.events).toHaveLength(2);
  });

  it("marks reset-required cursor reads when retained history has moved past the cursor", () => {
    const owner = new CodexThreadStreamEventHistoryOwner(3);

    owner.appendStreamEvent("thread-1", createRequestFrame("request-1"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-2"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-3"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-4"));

    const staleCursorSlice = owner.readStreamEvents("thread-1", "client-a", {
      limit: 2,
      sinceSequence: -1,
    });

    expect(staleCursorSlice.firstAvailableSequence).toBe(1);
    expect(staleCursorSlice.nextSequence).toBe(4);
    expect(staleCursorSlice.resetRequired).toBe(true);
    expect(staleCursorSlice.events).toHaveLength(2);

    const incrementalSlice = owner.readStreamEvents("thread-1", "client-a", {
      limit: 10,
      sinceSequence: 2,
    });
    expect(incrementalSlice.resetRequired).toBe(false);
    expect(incrementalSlice.events).toHaveLength(1);
  });

  it("marks reset-required cursor reads when the cursor is ahead of retained history", () => {
    const owner = new CodexThreadStreamEventHistoryOwner(3);

    owner.appendStreamEvent("thread-1", createRequestFrame("request-1"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-2"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-3"));

    const aheadCursorSlice = owner.readStreamEvents("thread-1", "client-a", {
      limit: 2,
      sinceSequence: 3,
    });

    expect(aheadCursorSlice.firstAvailableSequence).toBe(0);
    expect(aheadCursorSlice.nextSequence).toBe(3);
    expect(aheadCursorSlice.resetRequired).toBe(true);
    expect(aheadCursorSlice.events).toHaveLength(2);
  });

  it("tracks sequences independently per thread", () => {
    const owner = new CodexThreadStreamEventHistoryOwner(4);

    expect(owner.appendStreamEvent("thread-a", createRequestFrame("request-a-1"))).toBe(0);
    expect(owner.appendStreamEvent("thread-b", createRequestFrame("request-b-1"))).toBe(0);
    expect(owner.appendStreamEvent("thread-a", createRequestFrame("request-a-2"))).toBe(1);

    const threadASlice = owner.readStreamEvents("thread-a", null, {
      limit: 10,
      sinceSequence: null,
    });
    const threadBSlice = owner.readStreamEvents("thread-b", null, {
      limit: 10,
      sinceSequence: null,
    });

    expect(threadASlice.nextSequence).toBe(2);
    expect(threadASlice.events).toHaveLength(2);
    expect(threadBSlice.nextSequence).toBe(1);
    expect(threadBSlice.events).toHaveLength(1);
  });

  it("caps incremental reads to the requested limit", () => {
    const owner = new CodexThreadStreamEventHistoryOwner(10);

    owner.appendStreamEvent("thread-1", createRequestFrame("request-1"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-2"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-3"));
    owner.appendStreamEvent("thread-1", createRequestFrame("request-4"));

    const streamSlice = owner.readStreamEvents("thread-1", "client-a", {
      limit: 2,
      sinceSequence: 0,
    });

    expect(streamSlice.resetRequired).toBe(false);
    expect(streamSlice.events).toEqual([
      createRequestFrame("request-2"),
      createRequestFrame("request-3"),
    ]);
  });
});
