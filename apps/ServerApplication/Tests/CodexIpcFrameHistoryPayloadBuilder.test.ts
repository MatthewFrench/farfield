import { describe, expect, it } from "vitest";
import type { CodexIpcFrameEvent } from "../Source/Agents/Adapters/CodexAgentAdapterContracts.js";
import { buildCodexIpcFrameHistoryPayload } from "../Source/Agents/Adapters/CodexIpcFrameHistoryPayloadBuilder.js";

function buildInboundRequestEvent(): CodexIpcFrameEvent {
  return {
    direction: "in",
    method: "thread/start",
    threadId: "thread-1",
    frame: {
      type: "request",
      requestId: "request-1",
      method: "thread/start",
      params: {
        text: "x".repeat(8_192),
      },
      sourceClientId: "source-1",
      targetClientId: "target-1",
      version: 1,
    },
  };
}

function buildOutboundBroadcastEvent(): CodexIpcFrameEvent {
  return {
    direction: "out",
    method: "thread/interrupt",
    threadId: "thread-2",
    frame: {
      type: "broadcast",
      method: "thread/interrupt",
      params: {
        reason: "user",
      },
      sourceClientId: "source-2",
      targetClientId: "target-2",
      version: 1,
    },
  };
}

describe("buildCodexIpcFrameHistoryPayload", () => {
  it("summarizes inbound request frames without retaining raw params", () => {
    const payload = buildCodexIpcFrameHistoryPayload(buildInboundRequestEvent());

    expect(payload).toEqual({
      type: "codex-ipc-frame-summary",
      direction: "in",
      frameType: "request",
      method: "thread/start",
      threadId: "thread-1",
      requestId: "request-1",
      sourceClientId: "source-1",
      targetClientId: "target-1",
      version: 1,
    });
  });

  it("preserves outbound preview frames for replay flows", () => {
    const event = buildOutboundBroadcastEvent();
    const payload = buildCodexIpcFrameHistoryPayload(event);

    expect(payload).toEqual(event.frame);
  });
});
