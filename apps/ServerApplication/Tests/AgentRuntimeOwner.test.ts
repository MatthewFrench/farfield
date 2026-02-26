import { describe, expect, it } from "vitest";
import type { IpcFrame } from "@farfield/protocol";
import type { CodexIpcFrameEvent } from "../Source/Agents/Adapters/CodexAgentAdapter.js";
import { shouldScheduleThreadStreamStateChanged } from "../Source/Agents/AgentRuntimeOwner.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../Source/Agents/ThreadStreamStateChangedContract.js";

const DEFAULT_THREAD_IDENTIFIER = "thread_1";
const SOURCE_CLIENT_IDENTIFIER = "client_a";
const TARGET_CLIENT_IDENTIFIER = "client_a";
const PREVIEW_REQUEST_IDENTIFIER = "request_preview";
const NON_STREAM_METHOD = "thread-updated";
const PADDED_THREAD_IDENTIFIER = ` ${DEFAULT_THREAD_IDENTIFIER} `;

function createInboundFrame(method: string): IpcFrame {
  return {
    type: "broadcast",
    method,
    params: {},
    sourceClientId: SOURCE_CLIENT_IDENTIFIER,
    version: 1
  };
}

function createOutboundFrame(method: string): IpcFrame {
  return {
    type: "request",
    requestId: PREVIEW_REQUEST_IDENTIFIER,
    method,
    params: {},
    targetClientId: TARGET_CLIENT_IDENTIFIER,
    version: 1
  };
}

function createCodexIpcFrameEvent(input: {
  direction: "in" | "out";
  frame: IpcFrame;
  method: string;
  threadId: string | null;
}): CodexIpcFrameEvent {
  return {
    direction: input.direction,
    frame: input.frame,
    method: input.method,
    threadId: input.threadId
  };
}

describe("AgentRuntimeOwner", () => {
  it("schedules completion checks only for inbound thread-stream updates", () => {
    const inboundStreamEvent = createCodexIpcFrameEvent({
      direction: "in",
      frame: createInboundFrame(THREAD_STREAM_STATE_CHANGED_METHOD),
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      threadId: DEFAULT_THREAD_IDENTIFIER
    });

    expect(shouldScheduleThreadStreamStateChanged(inboundStreamEvent)).toBe(true);
  });

  it("does not schedule completion checks for outbound replay preview frames", () => {
    const outboundPreviewEvent = createCodexIpcFrameEvent({
      direction: "out",
      frame: createOutboundFrame(THREAD_STREAM_STATE_CHANGED_METHOD),
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      threadId: DEFAULT_THREAD_IDENTIFIER
    });

    expect(shouldScheduleThreadStreamStateChanged(outboundPreviewEvent)).toBe(false);
  });

  it("does not schedule completion checks for non-stream frame methods", () => {
    const nonStreamEvent = createCodexIpcFrameEvent({
      direction: "in",
      frame: createInboundFrame(NON_STREAM_METHOD),
      method: NON_STREAM_METHOD,
      threadId: DEFAULT_THREAD_IDENTIFIER
    });

    expect(shouldScheduleThreadStreamStateChanged(nonStreamEvent)).toBe(false);
  });

  it("does not schedule completion checks when thread identifier is absent", () => {
    const inboundStreamEventWithoutThreadIdentifier = createCodexIpcFrameEvent({
      direction: "in",
      frame: createInboundFrame(THREAD_STREAM_STATE_CHANGED_METHOD),
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      threadId: null
    });

    expect(shouldScheduleThreadStreamStateChanged(inboundStreamEventWithoutThreadIdentifier)).toBe(false);
  });

  it("does not schedule completion checks when thread identifier is whitespace", () => {
    const inboundStreamEventWithWhitespaceIdentifier = createCodexIpcFrameEvent({
      direction: "in",
      frame: createInboundFrame(THREAD_STREAM_STATE_CHANGED_METHOD),
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      threadId: "   "
    });

    expect(shouldScheduleThreadStreamStateChanged(inboundStreamEventWithWhitespaceIdentifier)).toBe(false);
  });

  it("preserves non-whitespace thread identifier text for scheduled events", () => {
    const inboundEventWithPaddedIdentifier = createCodexIpcFrameEvent({
      direction: "in",
      frame: createInboundFrame(THREAD_STREAM_STATE_CHANGED_METHOD),
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      threadId: PADDED_THREAD_IDENTIFIER
    });

    if (!shouldScheduleThreadStreamStateChanged(inboundEventWithPaddedIdentifier)) {
      throw new Error("expected inbound event with padded thread identifier to schedule");
    }
    expect(inboundEventWithPaddedIdentifier.threadId).toBe(PADDED_THREAD_IDENTIFIER);
  });
});
