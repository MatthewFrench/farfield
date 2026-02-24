import { randomUUID } from "node:crypto";
import {
  FarfieldPushTestBodySchema,
  type PushNotificationPayload
} from "@farfield/protocol";
import { z } from "zod";

export class PushTestPayloadOwner {
  public buildPayload(
    input: z.infer<typeof FarfieldPushTestBodySchema>,
    privateMode: boolean
  ): PushNotificationPayload {
    const now = new Date().toISOString();
    const notificationId = `notif_${randomUUID()}`;
    const url = `/threads/${encodeURIComponent(input.threadId)}`;
    const title = input.title ?? "Farfield notification";
    const body = privateMode
      ? "A response is ready in Farfield."
      : (input.body ?? "A response is ready in Farfield.");

    return {
      notificationId,
      title,
      body,
      threadId: input.threadId,
      turnId: input.turnId,
      url,
      createdAt: now,
      web_push: {
        notification: {
          title,
          body,
          navigate: url,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: `thread:${input.threadId}`
        }
      }
    };
  }
}
