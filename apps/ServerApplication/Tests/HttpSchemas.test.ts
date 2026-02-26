import { describe, expect, it } from "vitest";
import {
  parseBody,
  parseReplayBody,
  parseSendMessageBody,
  parseSetModeBody,
  parseStartThreadBody,
  parseTraceMarkBody,
  parseTraceStartBody,
  parseSubmitUserInputBody,
  StartThreadBodySchema
} from "../Source/Network/RequestSchemas/HttpSchemas.js";

describe("server request schemas", () => {
  it("accepts valid send message body", () => {
    const parsed = parseSendMessageBody({
      text: "hello",
      isSteering: false
    });

    expect(parsed.text).toBe("hello");
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseSendMessageBody({
        text: "hello",
        extra: true
      })
    ).toThrowError(/Unrecognized key/);
  });

  it("validates set mode body", () => {
    const parsed = parseSetModeBody({
      collaborationMode: {
        mode: "plan",
        settings: {
          model: "gpt-5.3-codex",
          reasoning_effort: "high",
          developer_instructions: "x"
        }
      }
    });

    expect(parsed.collaborationMode.mode).toBe("plan");
  });

  it("rejects invalid request id type", () => {
    expect(() =>
      parseSubmitUserInputBody({
        requestId: "bad",
        response: {}
      })
    ).toThrowError(/Expected number/);
  });

  it("validates replay body", () => {
    const parsed = parseReplayBody({
      entryId: "abc",
      waitForResponse: true
    });

    expect(parsed.waitForResponse).toBe(true);
  });

  it("validates start thread body with agentId", () => {
    const parsed = parseStartThreadBody({
      agentId: "opencode",
      cwd: "/tmp/workspace"
    });

    expect(parsed.agentId).toBe("opencode");
  });

  it("rejects deprecated agentKind field", () => {
    expect(() =>
      parseStartThreadBody({
        agentKind: "opencode"
      })
    ).toThrowError(/Unrecognized key/);
  });

  it("keeps generic schema parsing available for externally owned body schemas", () => {
    const parsed = parseBody(StartThreadBodySchema, {
      cwd: "/tmp/workspace"
    });

    expect(parsed.cwd).toBe("/tmp/workspace");
  });

  it("enforces trace label maximum length", () => {
    expect(() =>
      parseTraceStartBody({
        label: "x".repeat(121)
      })
    ).toThrowError(/at most 120 character/);
  });

  it("enforces trace mark note maximum length", () => {
    expect(() =>
      parseTraceMarkBody({
        note: "x".repeat(501)
      })
    ).toThrowError(/at most 500 character/);
  });
});
