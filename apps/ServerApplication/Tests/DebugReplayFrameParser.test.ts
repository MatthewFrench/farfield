import type { JsonValue } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { parseReplayFrame } from "../Source/Network/Routes/DebugReplayFrameParser.js";
import {
  DebugReplayFrameParseError,
  DebugReplayFrameParseErrorTypeByName,
  DebugReplayFrameTypeByName
} from "../Source/Network/Routes/DebugRouteContracts.js";

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

  it("throws a typed replay parse error with deterministic issue metadata", () => {
    const parseError = parseInvalidReplayFrameAndReadError({
      type: DebugReplayFrameTypeByName.request,
      method: "   "
    });

    expect(parseError.details.errorType).toBe(
      DebugReplayFrameParseErrorTypeByName.invalidReplayFramePayload
    );
    expect(parseError.details.issues).toContainEqual({
      path: "frame.method",
      issueCode: "too_small",
      message: "String must contain at least 1 character(s)"
    });
    expect(parseError.message).toContain("frame.method");
  });

  it("localizes replay parse failures to stable frame paths", () => {
    const rootShapeParseError = parseInvalidReplayFrameAndReadError("invalid");
    expect(rootShapeParseError.details.issues).toContainEqual({
      path: "frame",
      issueCode: "invalid_type",
      message: expect.any(String)
    });

    const frameTypeParseError = parseInvalidReplayFrameAndReadError({
      type: "response",
      method: "thread/send-message"
    });
    expect(frameTypeParseError.details.issues).toContainEqual({
      path: "frame.type",
      issueCode: "invalid_union_discriminator",
      message: expect.any(String)
    });

    const versionParseError = parseInvalidReplayFrameAndReadError({
      type: DebugReplayFrameTypeByName.broadcast,
      method: "thread/send-message",
      version: 1.25
    });
    expect(versionParseError.details.issues).toContainEqual({
      path: "frame.version",
      issueCode: "invalid_type",
      message: expect.any(String)
    });
  });
});

function parseInvalidReplayFrameAndReadError(payload: JsonValue): DebugReplayFrameParseError {
  try {
    parseReplayFrame(payload);
  } catch (error) {
    if (error instanceof DebugReplayFrameParseError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected replay frame parse to throw a DebugReplayFrameParseError");
}
