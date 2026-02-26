import { describe, expect, it } from "vitest";
import { parseReplayFrame } from "../Source/Network/Routes/DebugReplayFrameParser.js";
import { DebugReplayFrameTypeByName } from "../Source/Network/Routes/DebugRouteContracts.js";

describe("parseReplayFrame", () => {
  it("maps validated request replay payload into the route-owned frame contract", () => {
    const parsed = parseReplayFrame({
      type: DebugReplayFrameTypeByName.request,
      method: "thread/send-message",
      params: {
        text: "hello"
      },
      targetClientId: "client_1",
      version: 3,
      ignoredField: "ignored"
    });

    expect(parsed).toEqual({
      type: DebugReplayFrameTypeByName.request,
      method: "thread/send-message",
      params: {
        text: "hello"
      },
      targetClientId: "client_1",
      version: 3
    });
  });

  it("rejects malformed replay frame payloads", () => {
    expect(() => parseReplayFrame({
      type: DebugReplayFrameTypeByName.request,
      method: "   "
    })).toThrowError();

    expect(() => parseReplayFrame({
      type: "response",
      method: "thread/send-message"
    })).toThrowError();

    expect(() => parseReplayFrame({
      type: DebugReplayFrameTypeByName.broadcast,
      method: "thread/send-message",
      version: 1.25
    })).toThrowError();
  });
});
