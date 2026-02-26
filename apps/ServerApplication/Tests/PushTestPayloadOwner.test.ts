import { describe, expect, it } from "vitest";
import { ProtocolValidationError } from "@farfield/protocol";
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

  it("supports deterministic id and timestamp dependencies for test payload generation", () => {
    const owner = new PushTestPayloadOwner({
      readNowIsoString: () => "2026-02-25T00:00:00.000Z",
      createNotificationIdSuffix: () => "deterministic-id"
    });

    const payload = owner.buildPayload(
      {
        threadId: "thread_3",
        turnId: "turn_3"
      },
      false
    );

    expect(payload.notificationId).toBe("notif_deterministic-id");
    expect(payload.createdAt).toBe("2026-02-25T00:00:00.000Z");
  });

  it("encodes thread identifiers in navigation url deterministically", () => {
    const owner = new PushTestPayloadOwner({
      readNowIsoString: () => "2026-02-25T00:00:00.000Z",
      createNotificationIdSuffix: () => "deterministic-id"
    });

    const payload = owner.buildPayload(
      {
        threadId: "thread/with space?",
        turnId: "turn_4"
      },
      false
    );

    expect(payload.url).toBe("/threads/thread%2Fwith%20space%3F");
    expect(payload.web_push.notification.navigate).toBe("/threads/thread%2Fwith%20space%3F");
    expect(payload.web_push.notification.tag).toBe("thread:thread/with space?");
  });

  it("throws when dependency output violates push payload contract", () => {
    const owner = new PushTestPayloadOwner({
      readNowIsoString: () => "not-an-iso-date",
      createNotificationIdSuffix: () => "deterministic-id"
    });

    const build = (): void => {
      owner.buildPayload(
        {
          threadId: "thread_5",
          turnId: "turn_5"
        },
        false
      );
    };

    expect(build).toThrowError(ProtocolValidationError);
    expect(build).toThrowError(/PushNotificationPayload/);
    expect(build).toThrowError(/createdAt/);
  });

  it("throws when runtime input bypasses route validation rules", () => {
    const owner = new PushTestPayloadOwner({
      readNowIsoString: () => "2026-02-25T00:00:00.000Z",
      createNotificationIdSuffix: () => "deterministic-id"
    });

    const build = (): void => {
      owner.buildPayload(
        {
          threadId: "",
          turnId: "turn_6"
        },
        false
      );
    };

    expect(build).toThrowError(ProtocolValidationError);
    expect(build).toThrowError(/threadId/);
  });
});
