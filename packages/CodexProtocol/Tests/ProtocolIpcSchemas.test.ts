import { describe, expect, it } from "vitest";
import {
  parseIpcFrame,
  parseUserInputResponsePayload
} from "../Source/Index.js";

describe("codex-protocol ipc schemas", () => {
  it("parses generic ipc request frames", () => {
    const parsed = parseIpcFrame({
      type: "request",
      requestId: "request-5",
      method: "thread-follower-start-turn",
      params: {
        conversationId: "thread-123"
      },
      version: 1,
      targetClientId: "client-1"
    });

    expect(parsed.type).toBe("request");
  });

  it("parses client discovery request frames", () => {
    const parsed = parseIpcFrame({
      type: "client-discovery-request",
      requestId: "discovery-1",
      request: {
        type: "request",
        requestId: "inner-1",
        sourceClientId: "desktop-client",
        version: 0,
        method: "ide-context",
        params: {
          workspaceRoot: "/tmp/workspace"
        }
      }
    });

    expect(parsed.type).toBe("client-discovery-request");
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
