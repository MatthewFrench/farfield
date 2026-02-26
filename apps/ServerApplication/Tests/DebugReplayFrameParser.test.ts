import type { JsonValue } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { parseReplayFrame } from "../Source/Network/Routes/DebugReplayFrameParser.js";
import {
  DebugReplayFrameParseError,
  DebugReplayFrameParseErrorTypeByName,
  DebugReplayFrameTypeByName
} from "../Source/Network/Routes/DebugRouteContracts.js";

const ReplayFrameIssuePathByName = {
  root: "frame",
  type: "frame.type",
  method: "frame.method",
  targetClientId: "frame.targetClientId",
  version: "frame.version"
} as const;

describe("parseReplayFrame", () => {
  it("maps validated replay payload into the route-owned frame contract with normalized values", () => {
    const parsed = parseReplayFrame({
      type: DebugReplayFrameTypeByName.request,
      method: "  thread/send-message  ",
      params: {
        text: "hello"
      },
      targetClientId: "  client_1  ",
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

  it("keeps optional replay fields omitted when payload does not include them", () => {
    const parsed = parseReplayFrame({
      type: DebugReplayFrameTypeByName.broadcast,
      method: "thread/stream-state-changed"
    });

    expect(parsed).toEqual({
      type: DebugReplayFrameTypeByName.broadcast,
      method: "thread/stream-state-changed",
      params: undefined
    });
    expect(parsed).not.toHaveProperty("targetClientId");
    expect(parsed).not.toHaveProperty("version");
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
      path: ReplayFrameIssuePathByName.method,
      issueCode: "too_small",
      message: "String must contain at least 1 character(s)"
    });
    expect(parseError.message).toContain(ReplayFrameIssuePathByName.method);
  });

  it("sorts replay parse issues into deterministic path order", () => {
    const parseError = parseInvalidReplayFrameAndReadError({
      type: DebugReplayFrameTypeByName.request,
      method: "   ",
      targetClientId: "   ",
      version: -1
    });

    expect(parseError.details.issues).toEqual([
      {
        path: ReplayFrameIssuePathByName.method,
        issueCode: "too_small",
        message: expect.any(String)
      },
      {
        path: ReplayFrameIssuePathByName.targetClientId,
        issueCode: "too_small",
        message: expect.any(String)
      },
      {
        path: ReplayFrameIssuePathByName.version,
        issueCode: "too_small",
        message: expect.any(String)
      }
    ]);
  });

  it("localizes replay parse failures to stable frame paths", () => {
    const rootShapeParseError = parseInvalidReplayFrameAndReadError("invalid");
    expect(rootShapeParseError.details.issues).toContainEqual({
      path: ReplayFrameIssuePathByName.root,
      issueCode: "invalid_type",
      message: expect.any(String)
    });

    const frameTypeParseError = parseInvalidReplayFrameAndReadError({
      type: "response",
      method: "thread/send-message"
    });
    expect(frameTypeParseError.details.issues).toContainEqual({
      path: ReplayFrameIssuePathByName.type,
      issueCode: "invalid_union_discriminator",
      message: expect.any(String)
    });

    const missingMethodParseError = parseInvalidReplayFrameAndReadError({
      type: DebugReplayFrameTypeByName.request
    });
    expect(missingMethodParseError.details.issues).toContainEqual({
      path: ReplayFrameIssuePathByName.method,
      issueCode: "invalid_type",
      message: expect.any(String)
    });

    const targetClientIdParseError = parseInvalidReplayFrameAndReadError({
      type: DebugReplayFrameTypeByName.request,
      method: "thread/send-message",
      targetClientId: "   "
    });
    expect(targetClientIdParseError.details.issues).toContainEqual({
      path: ReplayFrameIssuePathByName.targetClientId,
      issueCode: "too_small",
      message: expect.any(String)
    });

    const versionParseError = parseInvalidReplayFrameAndReadError({
      type: DebugReplayFrameTypeByName.broadcast,
      method: "thread/send-message",
      version: 1.25
    });
    expect(versionParseError.details.issues).toContainEqual({
      path: ReplayFrameIssuePathByName.version,
      issueCode: "invalid_type",
      message: expect.any(String)
    });

    const negativeVersionParseError = parseInvalidReplayFrameAndReadError({
      type: DebugReplayFrameTypeByName.broadcast,
      method: "thread/send-message",
      version: -1
    });
    expect(negativeVersionParseError.details.issues).toContainEqual({
      path: ReplayFrameIssuePathByName.version,
      issueCode: "too_small",
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
