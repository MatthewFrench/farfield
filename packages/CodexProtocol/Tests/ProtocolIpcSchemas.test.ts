import { describe, expect, it } from "vitest";
import {
  IpcFrameType,
  IpcResponseResultType,
  ProtocolValidationError,
  parseIpcFrame,
  parseThreadStreamStateChangedBroadcast,
  parseUserInputResponsePayload,
  ThreadStreamStateChangedEventType
} from "../Source/Index.js";

describe("codex-protocol ipc schemas", () => {
  it("parses generic ipc request frames", () => {
    const parsed = parseIpcFrame({
      type: IpcFrameType.request,
      requestId: "request-5",
      method: "thread-follower-start-turn",
      params: {
        conversationId: "thread-123"
      },
      version: 1,
      targetClientId: "client-1"
    });

    expect(parsed.type).toBe(IpcFrameType.request);
  });

  it("parses client discovery request frames", () => {
    const parsed = parseIpcFrame({
      type: IpcFrameType.clientDiscoveryRequest,
      requestId: "discovery-1",
      request: {
        type: IpcFrameType.request,
        requestId: "inner-1",
        sourceClientId: "desktop-client",
        version: 0,
        method: "ide-context",
        params: {
          workspaceRoot: "/tmp/workspace"
        }
      }
    });

    expect(parsed.type).toBe(IpcFrameType.clientDiscoveryRequest);
  });

  it("parses response frames with owned result literals", () => {
    const parsed = parseIpcFrame({
      type: IpcFrameType.response,
      requestId: "request-7",
      resultType: IpcResponseResultType.success,
      result: {
        accepted: true
      }
    });

    expect(parsed.type).toBe(IpcFrameType.response);
  });

  it("rejects success response frames that include an error payload", () => {
    const error = captureIpcFrameParseError(() =>
      parseIpcFrame({
        type: IpcFrameType.response,
        requestId: "request-7a",
        resultType: IpcResponseResultType.success,
        result: {
          accepted: true
        },
        error: {
          reason: "must-not-be-present"
        }
      })
    );

    expect(error.metadata.context).toBe("IpcFrame");
    expect(error.metadata.issuePaths).toEqual(["<root>"]);
  });

  it("rejects error response frames that omit the error payload", () => {
    const error = captureIpcFrameParseError(() =>
      parseIpcFrame({
        type: IpcFrameType.response,
        requestId: "request-7b",
        resultType: IpcResponseResultType.error
      })
    );

    expect(error.metadata.context).toBe("IpcFrame");
    expect(error.metadata.issuePaths).toEqual(["<root>"]);
  });

  it("rejects ipc frames with unsupported discriminant values", () => {
    expect(() =>
      parseIpcFrame({
        type: "unsupported-frame",
        requestId: "request-6",
        method: "thread/read"
      })
    ).toThrowError(/IpcFrame did not match expected schema/);
  });

  it("rejects response frames with unsupported resultType literals", () => {
    const error = captureIpcFrameParseError(() =>
      parseIpcFrame({
        type: IpcFrameType.response,
        requestId: "request-8",
        resultType: "partial",
        result: {}
      })
    );

    expect(error.metadata.context).toBe("IpcFrame");
    expect(error.metadata.issuePaths).toEqual(["<root>"]);
  });

  it("rejects thread stream state changed broadcasts missing source client ownership", () => {
    expect(() =>
      parseThreadStreamStateChangedBroadcast({
        type: IpcFrameType.broadcast,
        method: ThreadStreamStateChangedEventType,
        version: 4,
        params: {
          conversationId: "thread-123",
          type: ThreadStreamStateChangedEventType,
          version: 4,
          change: {
            type: "patches",
            patches: []
          }
        }
      })
    ).toThrowError(/sourceClientId/);
  });

  it("rejects thread stream broadcasts with non-thread-stream method literals", () => {
    expect(() =>
      parseThreadStreamStateChangedBroadcast({
        type: IpcFrameType.broadcast,
        method: "tool-notification",
        sourceClientId: "client-123",
        version: 4,
        params: {
          conversationId: "thread-123",
          type: ThreadStreamStateChangedEventType,
          version: 4,
          change: {
            type: "patches",
            patches: []
          }
        }
      })
    ).toThrowError(/method/);
  });

  it("rejects malformed user input answer payload", () => {
    expect(() =>
      parseUserInputResponsePayload({
        answers: {
          q: {
            answers: [1]
          }
        }
      })
    ).toThrowError(/Expected string, received number/);
  });
});

function captureIpcFrameParseError(
  parseFrame: () => void
): ProtocolValidationError {
  try {
    parseFrame();
  } catch (error) {
    if (error instanceof ProtocolValidationError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected parseIpcFrame to throw ProtocolValidationError");
}
