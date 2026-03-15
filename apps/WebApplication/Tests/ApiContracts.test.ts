import { describe, expect, it } from "vitest";
import {
  AgentIdSchema,
  ApiRequestHeaderOptionsSchema,
} from "../Source/Shared/Contracts/ApiContracts";

describe("ApiContracts", () => {
  it("parses and trims request header options", () => {
    const parsed = ApiRequestHeaderOptionsSchema.parse({
      actionId: "  action_1  ",
      actionName: "  send-message  ",
    });

    expect(parsed.actionId).toBe("action_1");
    expect(parsed.actionName).toBe("send-message");
  });

  it("rejects invalid request header option tokens", () => {
    expect(() =>
      ApiRequestHeaderOptionsSchema.parse({
        actionId: "invalid action id",
      }),
    ).toThrow("Request metadata values may contain only letters");
  });

  it("rejects unknown request header option keys", () => {
    expect(() =>
      ApiRequestHeaderOptionsSchema.parse({
        actionId: "action_1",
        actionName: "send-message",
        extra: "unexpected",
      }),
    ).toThrow("Unrecognized key(s) in object");
  });

  it("rejects unsupported agent identifiers", () => {
    expect(() => AgentIdSchema.parse("unknown-agent")).toThrow("Invalid enum value");
  });
});
