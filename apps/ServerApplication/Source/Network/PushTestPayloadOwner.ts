import { randomUUID } from "node:crypto";
import {
  FarfieldPushTestBodySchema,
  parsePushNotificationPayload,
  type PushNotificationPayload
} from "@farfield/protocol";
import { z } from "zod";

const DEFAULT_NOTIFICATION_TITLE = "Farfield notification";
const DEFAULT_NOTIFICATION_BODY = "A response is ready in Farfield.";
const NOTIFICATION_ID_PREFIX = "notif_";
const DEFAULT_NOTIFICATION_ICON_PATH = "/icons/icon-192.png";

interface PushTestPayloadOwnerDependencies {
  readNowIsoString?: () => string;
  createNotificationIdSuffix?: () => string;
}

type PushTestPayloadInput = z.infer<typeof FarfieldPushTestBodySchema>;

/**
 * Owns deterministic push-test payload construction from already parsed route input
 * and enforces the final push payload contract before dispatch.
 */
export class PushTestPayloadOwner {
  private readonly readNowIsoString: () => string;
  private readonly createNotificationIdSuffix: () => string;

  public constructor(dependencies?: PushTestPayloadOwnerDependencies) {
    this.readNowIsoString = dependencies?.readNowIsoString ?? (() => new Date().toISOString());
    this.createNotificationIdSuffix = dependencies?.createNotificationIdSuffix ?? (() => randomUUID());
  }

  public buildPayload(
    input: PushTestPayloadInput,
    privateMode: boolean
  ): PushNotificationPayload {
    const now = this.readNowIsoString();
    const notificationId = `${NOTIFICATION_ID_PREFIX}${this.createNotificationIdSuffix()}`;
    const url = `/threads/${encodeURIComponent(input.threadId)}`;
    const title = input.title ?? DEFAULT_NOTIFICATION_TITLE;
    const body = privateMode
      ? DEFAULT_NOTIFICATION_BODY
      : (input.body ?? DEFAULT_NOTIFICATION_BODY);

    return parsePushNotificationPayload({
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
          icon: DEFAULT_NOTIFICATION_ICON_PATH,
          badge: DEFAULT_NOTIFICATION_ICON_PATH,
          tag: `thread:${input.threadId}`
        }
      }
    });
  }
}
