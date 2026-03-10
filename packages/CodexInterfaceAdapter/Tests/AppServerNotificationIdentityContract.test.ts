import { describe, expect, it } from "vitest";
import { parseAppServerNotificationIdentity } from "../Source/AppServerNotificationIdentityContract.js";

describe("parseAppServerNotificationIdentity", () => {
  it("reads thread and turn identifiers from conversation envelope variants", () => {
    expect(
      parseAppServerNotificationIdentity({
        conversation_id: "thread-1",
        turn_id: "turn-1",
      }),
    ).toEqual({
      threadId: "thread-1",
      turnId: "turn-1",
    });
  });

  it("returns null identifiers for non-envelope payloads", () => {
    expect(parseAppServerNotificationIdentity("not-an-envelope")).toEqual({
      threadId: null,
      turnId: null,
    });
  });
});
