import type { IpcFrame } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import {
  describeCodexIpcFrame,
  extractThreadIdFromCodexIpcFrame,
  isThreadStreamStateChangedFrame,
} from "../Source/Agents/Adapters/CodexThreadStreamFrameDescriptionContracts.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../Source/Agents/ThreadStreamStateChangedContract.js";

describe("CodexThreadStreamFrameDescriptionContracts", () => {
  it("describes request frames using normalized thread identifiers", () => {
    const requestFrame: IpcFrame = {
      type: "request",
      requestId: "request-1",
      method: "thread-read",
      params: {
        conversationId: "  thread-from-conversation  ",
        threadId: "thread-from-thread-id",
      },
    };

    expect(describeCodexIpcFrame(requestFrame)).toEqual({
      method: "thread-read",
      threadId: "thread-from-conversation",
    });
  });

  it("uses stable method descriptions for response and discovery frames", () => {
    const responseFrame: IpcFrame = {
      type: "response",
      requestId: "request-1",
      resultType: "success",
    };
    const discoveryRequestFrame: IpcFrame = {
      type: "client-discovery-request",
      requestId: "request-2",
      request: {
        type: "request",
        requestId: "request-3",
        method: "thread-read",
      },
    };

    expect(describeCodexIpcFrame(responseFrame)).toEqual({
      method: "response",
      threadId: null,
    });
    expect(describeCodexIpcFrame(discoveryRequestFrame)).toEqual({
      method: "client-discovery-request",
      threadId: null,
    });
  });

  it("extracts conversation identifiers from thread-stream-state-changed broadcasts", () => {
    const streamBroadcastFrame: IpcFrame = {
      type: "broadcast",
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      sourceClientId: "client-a",
      version: 4,
      params: {
        conversationId: "thread-1",
      },
    };

    expect(isThreadStreamStateChangedFrame(streamBroadcastFrame)).toBe(true);
    expect(extractThreadIdFromCodexIpcFrame(streamBroadcastFrame)).toBe("thread-1");
  });

  it("does not classify non-stream broadcasts as thread stream state changed", () => {
    const nonStreamBroadcastFrame: IpcFrame = {
      type: "broadcast",
      method: "thread-created",
      sourceClientId: "client-a",
      version: 1,
      params: {
        conversationId: "thread-1",
      },
    };

    expect(isThreadStreamStateChangedFrame(nonStreamBroadcastFrame)).toBe(false);
    expect(extractThreadIdFromCodexIpcFrame(nonStreamBroadcastFrame)).toBeNull();
  });
});
