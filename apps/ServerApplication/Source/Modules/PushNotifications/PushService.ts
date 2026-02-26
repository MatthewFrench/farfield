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

const MAX_PUSH_SEND_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;
const RETRY_BACKOFF_MULTIPLIER = 2;
const RETRYABLE_PUSH_SEND_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const PRUNED_PUSH_SUBSCRIPTION_STATUS_CODES = new Set([404, 410]);
const PUSH_SEND_FAILURE_MESSAGE = "Push send failed";
const PUSH_RETRY_LOOP_EXHAUSTED_ERROR_MESSAGE = "Push send retry loop exhausted";
const PUSH_NOTIFICATIONS_DISABLED_ERROR_MESSAGE = "Push notifications are disabled";
const PUSH_REQUEST_TIME_TO_LIVE_SECONDS = 300;
const PUSH_REQUEST_URGENCY: webPush.Urgency = "high";
// Keep this bounded so one send cannot starve event-loop work under large subscription sets.
const PUSH_SEND_CONCURRENCY_LIMIT = 8;

interface DescribedPushError {
  statusCode: number | null;
  message: string;
}

function describePushError<ErrorType>(error: ErrorType): DescribedPushError {
  const parsedError = WebPushErrorSchema.safeParse(error);
  if (!parsedError.success) {
    return {
      statusCode: null,
      message: PUSH_SEND_FAILURE_MESSAGE
    };
  }

  return {
    statusCode: parsedError.data.statusCode ?? null,
    message: parsedError.data.message ?? PUSH_SEND_FAILURE_MESSAGE
  };
}

function shouldRetrySendFailure(statusCode: number | null): boolean {
  if (statusCode === null) {
    return true;
  }
  return RETRYABLE_PUSH_SEND_STATUS_CODES.has(statusCode);
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function sendNotificationWithRetry(
  subscription: webPush.PushSubscription,
  payload: string,
  requestOptions: webPush.RequestOptions
): Promise<void> {
  let attempt = 0;
  while (attempt < MAX_PUSH_SEND_ATTEMPTS) {
    try {
      await webPush.sendNotification(subscription, payload, requestOptions);
      return;
    } catch (error) {
      attempt += 1;
      const described = describePushError(error);
      if (
        attempt >= MAX_PUSH_SEND_ATTEMPTS ||
        !shouldRetrySendFailure(described.statusCode)
      ) {
        throw error;
      }

      const delayMs = RETRY_BASE_DELAY_MS * RETRY_BACKOFF_MULTIPLIER ** (attempt - 1);
      await sleep(delayMs);
    }
  }

  throw new Error(PUSH_RETRY_LOOP_EXHAUSTED_ERROR_MESSAGE);
}

function toWireSubscription(subscription: StoredPushSubscription): webPush.PushSubscription {
  return {
    endpoint: subscription.subscription.endpoint,
    keys: {
      p256dh: subscription.subscription.keys.p256dh,
      auth: subscription.subscription.keys.auth
    }
  };
}

interface PushDispatchResult {
  delivered: number;
  failures: PushSendFailure[];
  prunedEndpoints: string[];
}

async function sendSubscriptionsWithConcurrencyLimit(
  subscriptions: StoredPushSubscription[],
  payload: string,
  requestOptions: webPush.RequestOptions
): Promise<PushDispatchResult> {
  const failures: PushSendFailure[] = [];
  const prunedEndpoints: string[] = [];
  let delivered = 0;
  let nextSubscriptionIndex = 0;

  const workerCount = Math.min(PUSH_SEND_CONCURRENCY_LIMIT, subscriptions.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      // Claiming the index before awaiting guarantees each worker receives a unique slot.
      const subscriptionIndex = nextSubscriptionIndex;
      nextSubscriptionIndex += 1;
      const subscription = subscriptions[subscriptionIndex];
      if (!subscription) {
        return;
      }

      try {
        await sendNotificationWithRetry(
          toWireSubscription(subscription),
          payload,
          requestOptions
        );
        delivered += 1;
      } catch (error) {
        const described = describePushError(error);
        // Aggregates are append/count-only; entry order reflects completion timing by design.
        failures.push({
          endpoint: subscription.subscription.endpoint,
          statusCode: described.statusCode,
          message: described.message
        });
        if (
          described.statusCode !== null
          && PRUNED_PUSH_SUBSCRIPTION_STATUS_CODES.has(described.statusCode)
        ) {
          prunedEndpoints.push(subscription.subscription.endpoint);
        }
      }
    }
  });

  await Promise.all(workers);
  return {
    delivered,
    failures,
    prunedEndpoints
  };
}

function buildDisabledPushSendResult(): PushSendResult {
  return {
    attempted: 0,
    delivered: 0,
    failures: [],
    prunedEndpoints: []
  };
}

/**
 * Owns web-push dispatch policy: payload validation, retry/backoff, and prune classification.
 */
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
      throw new Error(PUSH_NOTIFICATIONS_DISABLED_ERROR_MESSAGE);
    }
    return this.vapidPublicKey;
  }

  public async sendToSubscriptions(
    subscriptions: StoredPushSubscription[],
    payload: PushNotificationPayload
  ): Promise<PushSendResult> {
    if (!this.enabled) {
      return buildDisabledPushSendResult();
    }

    const strictPayload = parsePushNotificationPayload(payload);
    const body = JSON.stringify(strictPayload);
    const requestOptions: webPush.RequestOptions = {
      TTL: PUSH_REQUEST_TIME_TO_LIVE_SECONDS,
      urgency: PUSH_REQUEST_URGENCY
    };
    const sendResult = await sendSubscriptionsWithConcurrencyLimit(
      subscriptions,
      body,
      requestOptions
    );

    return {
      attempted: subscriptions.length,
      delivered: sendResult.delivered,
      failures: sendResult.failures,
      prunedEndpoints: sendResult.prunedEndpoints
    };
  }
}
