import { describe, expect, it } from "vitest";
import { UserInterfaceActionRequestBuilder } from "../Source/Application/StateManagement/UserInterfaceActionRequestBuilder";

describe("UserInterfaceActionRequestBuilder", () => {
  it("builds action request metadata with deterministic identifiers", () => {
    const builder = new UserInterfaceActionRequestBuilder(() => "action_test_123");

    const built = builder.create("send-message");

    expect(built).toEqual({
      actionId: "action_test_123",
      requestOptions: {
        actionId: "action_test_123",
        actionName: "send-message"
      }
    });
  });
});
