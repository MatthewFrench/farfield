import { z } from "zod";
import webPush from "web-push";
import {
  parsePushNotificationPayload,
  type PushNotificationPayload,
  type StoredPushSubscription
} from "@farfield/protocol";

export interface PushServiceConfig {
  enabled: boolean;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

export interface PushSendFailure {
  endpoint: string;
  statusCode: number | null;
  message: string;
}

export interface PushSendResult {
  attempted: number;
  delivered: number;
  failures: PushSendFailure[];
  prunedEndpoints: string[];
}

const WebPushErrorSchema = z
  .object({
    statusCode: z.number().int().optional(),
    body: z.string().optional(),
    message: z.string().optional()
  })
  .passthrough();

function toWireSubscription(subscription: StoredPushSubscription): webPush.PushSubscription {
  return {
    endpoint: subscription.subscription.endpoint,
    keys: {
      p256dh: subscription.subscription.keys.p256dh,
      auth: subscription.subscription.keys.auth
    }
  };
}

export class PushService {
  private readonly enabled: boolean;
  private readonly vapidPublicKey: string;

  public constructor(config: PushServiceConfig) {
    this.enabled = config.enabled;
    this.vapidPublicKey = config.vapidPublicKey;

    if (this.enabled) {
      webPush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getPublicKey(): string {
    if (!this.enabled) {
      throw new Error("Push notifications are disabled");
    }
    return this.vapidPublicKey;
  }

  public async sendToSubscriptions(
    subscriptions: StoredPushSubscription[],
    payload: PushNotificationPayload
  ): Promise<PushSendResult> {
    if (!this.enabled) {
      return {
        attempted: 0,
        delivered: 0,
        failures: [],
        prunedEndpoints: []
      };
    }

    const strictPayload = parsePushNotificationPayload(payload);
    const body = JSON.stringify(strictPayload);
    const failures: PushSendFailure[] = [];
    const prunedEndpoints: string[] = [];
    let delivered = 0;

    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification(toWireSubscription(subscription), body);
        delivered += 1;
      } catch (error) {
        const parsedError = WebPushErrorSchema.safeParse(error);
        const described = parsedError.success
          ? {
              statusCode: parsedError.data.statusCode ?? null,
              message: parsedError.data.message ?? "Push send failed"
            }
          : {
              statusCode: null,
              message: "Push send failed"
            };
        failures.push({
          endpoint: subscription.subscription.endpoint,
          statusCode: described.statusCode,
          message: described.message
        });
        if (described.statusCode === 404 || described.statusCode === 410) {
          prunedEndpoints.push(subscription.subscription.endpoint);
        }
      }
    }

    return {
      attempted: subscriptions.length,
      delivered,
      failures,
      prunedEndpoints
    };
  }
}
