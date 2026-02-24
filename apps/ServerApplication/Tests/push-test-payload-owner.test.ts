import { describe, expect, it } from "vitest";
import { PushTestPayloadOwner } from "../Source/Network/PushTestPayloadOwner.js";

describe("PushTestPayloadOwner", () => {
  it("builds private payload values with defaults", () => {
    const owner = new PushTestPayloadOwner();
    const payload = owner.buildPayload(
      {
        threadId: "thread_1",
        turnId: "turn_1"
      },
      true
    );

    expect(payload.notificationId.startsWith("notif_")).toBe(true);
    expect(payload.title).toBe("Farfield notification");
    expect(payload.body).toBe("A response is ready in Farfield.");
    expect(payload.url).toBe("/threads/thread_1");
    expect(payload.threadId).toBe("thread_1");
    expect(payload.turnId).toBe("turn_1");
    expect(payload.web_push.notification.tag).toBe("thread:thread_1");
  });

  it("uses provided title and body when private mode is disabled", () => {
    const owner = new PushTestPayloadOwner();
    const payload = owner.buildPayload(
      {
        threadId: "thread_2",
        turnId: "turn_2",
        title: "Custom title",
        body: "Custom body"
      },
      false
    );

    expect(payload.title).toBe("Custom title");
    expect(payload.body).toBe("Custom body");
    expect(payload.url).toBe("/threads/thread_2");
    expect(payload.web_push.notification.navigate).toBe("/threads/thread_2");
  });
});
