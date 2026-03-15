import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSendRequestOptions,
  DebugReplayFrameParseError,
  DebugReplayFrameParseErrorMessagePrefix,
  DebugReplayFrameParseErrorTypeByName,
  DebugReplayFrameTypeByName,
  type ParsedReplayFrame,
  readFileNameFromPath,
} from "../Source/Network/Routes/DebugRouteContracts.js";

const ReplayMethod = "thread/send-message";

function createParsedReplayFrame(
  targetClientId: string | undefined,
  version: number | undefined,
): ParsedReplayFrame {
  return {
    type: DebugReplayFrameTypeByName.request,
    method: ReplayMethod,
    params: undefined,
    ...(targetClientId !== undefined ? { targetClientId } : {}),
    ...(version !== undefined ? { version } : {}),
  };
}

describe("DebugRouteContracts", () => {
  it("reads deterministic file names from nested paths", () => {
    const absoluteSessionLogPath = `${path.sep}tmp${path.sep}debug${path.sep}session-42.ndjson`;
    const absoluteSessionLogPathWithTrailingSeparator = `${absoluteSessionLogPath}${path.sep}`;
    const relativeSessionLogPath = ["logs", "session-99.ndjson"].join(path.sep);

    expect(readFileNameFromPath(absoluteSessionLogPath)).toBe("session-42.ndjson");
    expect(readFileNameFromPath(absoluteSessionLogPathWithTrailingSeparator)).toBe(
      "session-42.ndjson",
    );
    expect(readFileNameFromPath(relativeSessionLogPath)).toBe("session-99.ndjson");
  });

  it("builds empty send-request options when replay frame omits optional fields", () => {
    expect(buildSendRequestOptions(createParsedReplayFrame(undefined, undefined))).toEqual({});
  });

  it("maps provided replay frame optional fields into send-request options", () => {
    expect(buildSendRequestOptions(createParsedReplayFrame("client_1", 3))).toEqual({
      targetClientId: "client_1",
      version: 3,
    });
  });

  it("preserves explicit replay target client identifier values without truthy filtering", () => {
    expect(buildSendRequestOptions(createParsedReplayFrame("", 0))).toEqual({
      targetClientId: "",
      version: 0,
    });
  });

  it("formats replay parse errors with deterministic prefix when no issue metadata exists", () => {
    const parseError = new DebugReplayFrameParseError({
      errorType: DebugReplayFrameParseErrorTypeByName.invalidReplayFramePayload,
      issues: [],
    });

    expect(parseError.message).toBe(DebugReplayFrameParseErrorMessagePrefix);
  });

  it("formats replay parse errors from the first issue path and message", () => {
    const parseError = new DebugReplayFrameParseError({
      errorType: DebugReplayFrameParseErrorTypeByName.invalidReplayFramePayload,
      issues: [
        {
          path: "frame.method",
          issueCode: "too_small",
          message: "String must contain at least 1 character(s)",
        },
        {
          path: "frame.version",
          issueCode: "too_small",
          message: "Number must be greater than or equal to 0",
        },
      ],
    });

    expect(parseError.message).toBe(
      `${DebugReplayFrameParseErrorMessagePrefix} at frame.method: String must contain at least 1 character(s)`,
    );
  });

  it("captures replay parse error details as a stable snapshot of constructor input", () => {
    const mutableIssues = [
      {
        path: "frame.method",
        issueCode: "too_small",
        message: "String must contain at least 1 character(s)",
      },
    ];

    const parseError = new DebugReplayFrameParseError({
      errorType: DebugReplayFrameParseErrorTypeByName.invalidReplayFramePayload,
      issues: mutableIssues,
    });

    mutableIssues[0] = {
      path: "frame.version",
      issueCode: "invalid_type",
      message: "Expected number, received string",
    };

    expect(parseError.details.issues).toEqual([
      {
        path: "frame.method",
        issueCode: "too_small",
        message: "String must contain at least 1 character(s)",
      },
    ]);
  });
});
