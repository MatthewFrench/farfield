import { describe, expect, it } from "vitest";
import type { IpcFrame } from "@farfield/protocol";
import type { CodexIpcFrameEvent } from "../Source/Agents/Adapters/CodexAgentAdapter.js";
import { shouldScheduleThreadStreamStateChanged } from "../Source/Agents/AgentRuntimeOwner.js";

describe("AgentRuntimeOwner", () => {
  it("schedules completion checks only for inbound thread-stream updates", () => {
    const inboundStreamFrame: IpcFrame = {
      type: "broadcast",
      method: "thread-stream-state-changed",
      params: {},
      sourceClientId: "client_a",
      version: 1
    };
    const inboundStreamEvent: CodexIpcFrameEvent = {
      direction: "in",
      frame: inboundStreamFrame,
      method: "thread-stream-state-changed",
      threadId: "thread_1"
    };

    expect(shouldScheduleThreadStreamStateChanged(inboundStreamEvent)).toBe(true);
  });

  it("does not schedule completion checks for outbound replay preview frames", () => {
    const outboundPreviewFrame: IpcFrame = {
      type: "request",
      requestId: "request_preview",
      method: "thread-stream-state-changed",
      params: {},
      targetClientId: "client_a",
      version: 1
    };
    const outboundPreviewEvent: CodexIpcFrameEvent = {
      direction: "out",
      frame: outboundPreviewFrame,
      method: "thread-stream-state-changed",
      threadId: "thread_1"
    };

    expect(shouldScheduleThreadStreamStateChanged(outboundPreviewEvent)).toBe(false);
  });

  it("does not schedule completion checks for non-stream frame methods", () => {
    const nonStreamFrame: IpcFrame = {
      type: "broadcast",
      method: "thread-updated",
      params: {},
      sourceClientId: "client_a",
      version: 1
    };
    const nonStreamEvent: CodexIpcFrameEvent = {
      direction: "in",
      frame: nonStreamFrame,
      method: "thread-updated",
      threadId: "thread_1"
    };

    expect(shouldScheduleThreadStreamStateChanged(nonStreamEvent)).toBe(false);
  });

  it("does not schedule completion checks when thread identifier is absent", () => {
    const inboundStreamFrame: IpcFrame = {
      type: "broadcast",
      method: "thread-stream-state-changed",
      params: {},
      sourceClientId: "client_a",
      version: 1
    };
    const inboundStreamEventWithoutThreadIdentifier: CodexIpcFrameEvent = {
      direction: "in",
      frame: inboundStreamFrame,
      method: "thread-stream-state-changed",
      threadId: null
    };

    expect(shouldScheduleThreadStreamStateChanged(inboundStreamEventWithoutThreadIdentifier)).toBe(false);
  });
});
