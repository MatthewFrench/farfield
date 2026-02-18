import { describe, expect, it } from "vitest";
import {
  CreatePushSubscriptionBodySchema,
  DeletePushSubscriptionBodySchema,
  parseBody,
  PushTestBodySchema,
  ReplayBodySchema,
  SendMessageBodySchema,
  SetModeBodySchema,
  SubmitUserInputBodySchema
} from "../src/http-schemas.js";

describe("server request schemas", () => {
  it("accepts valid send message body", () => {
    const parsed = parseBody(SendMessageBodySchema, {
      text: "hello",
      isSteering: false
    });

    expect(parsed.text).toBe("hello");
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseBody(SendMessageBodySchema, {
        text: "hello",
        extra: true
      })
    ).toThrowError(/Unrecognized key/);
  });

  it("validates set mode body", () => {
    const parsed = parseBody(SetModeBodySchema, {
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
      parseBody(SubmitUserInputBodySchema, {
        requestId: "bad",
        response: {}
      })
    ).toThrowError(/Expected number/);
  });

  it("validates replay body", () => {
    const parsed = parseBody(ReplayBodySchema, {
      entryId: "abc",
      waitForResponse: true
    });

    expect(parsed.waitForResponse).toBe(true);
  });

  it("validates push subscription body", () => {
    const parsed = parseBody(CreatePushSubscriptionBodySchema, {
      subscription: {
        endpoint: "https://example.push.service/subscription-id",
        keys: {
          p256dh: "BElidedKeyMaterial_123",
          auth: "CAuthValue_456"
        }
      },
      settings: {
        privateMode: true
      }
    });

    expect(parsed.subscription.keys.auth).toBe("CAuthValue_456");
  });

  it("validates push unsubscription body", () => {
    const parsed = parseBody(DeletePushSubscriptionBodySchema, {
      endpoint: "https://example.push.service/subscription-id"
    });

    expect(parsed.endpoint).toContain("example.push.service");
  });

  it("validates push test body with dry-run option", () => {
    const parsed = parseBody(PushTestBodySchema, {
      threadId: "thread_1",
      turnId: "turn_1",
      dryRun: true
    });

    expect(parsed.dryRun).toBe(true);
  });
});
