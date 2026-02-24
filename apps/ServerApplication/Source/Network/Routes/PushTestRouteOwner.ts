import {
  FarfieldPushTestBodySchema,
  type JsonValue,
  type PushNotificationPayload,
  type StoredPushSubscription
} from "@farfield/protocol";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { parseBody } from "../RequestSchemas/HttpSchemas.js";
import type { PushSendStore } from "../../Modules/PushNotifications/PushSendStore.js";
import type { PushService, PushSendResult } from "../../Modules/PushNotifications/PushService.js";
import type { PushStore } from "../../Modules/PushNotifications/PushStore.js";
import type { PushMutationConcurrencyCoordinator } from "../PushMutationConcurrencyCoordinator.js";

interface PushDispatchAttempt {
  payload: PushNotificationPayload;
  sendResult: PushSendResult;
}

interface PushTestRouteOwnerDependencies {
  pushService: PushService;
  pushStore: PushStore;
  pushSendStore: PushSendStore;
  pushMutationConcurrencyCoordinator: PushMutationConcurrencyCoordinator;
  pushTestBodySchema: typeof FarfieldPushTestBodySchema;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  buildPushTestPayload: (
    input: z.infer<typeof FarfieldPushTestBodySchema>,
    privateMode: boolean
  ) => PushNotificationPayload;
}

/**
 * Owns `/api/push/test` dispatch behavior, including dry-run readiness checks,
 * privacy-mode partitioned payload dispatch, and send-summary persistence.
 */
export class PushTestRouteOwner {
  private readonly dependencies: PushTestRouteOwnerDependencies;

  public constructor(dependencies: PushTestRouteOwnerDependencies) {
    this.dependencies = dependencies;
  }

  public async handle(input: {
    req: IncomingMessage;
    res: ServerResponse;
    pathname: string;
  }): Promise<boolean> {
    if (!(input.req.method === "POST" && input.pathname === "/api/push/test")) {
      return false;
    }

    const body = parseBody(this.dependencies.pushTestBodySchema, await this.dependencies.readJsonBody(input.req));
    const subscriptions = await this.dependencies.pushMutationConcurrencyCoordinator.runExclusive(async () => {
      return this.dependencies.pushStore.listSubscriptions();
    });
    const dryRun = body.dryRun === true;

    if (!this.dependencies.pushService.isEnabled()) {
      this.dependencies.jsonResponse(input.res, 200, {
        ok: true,
        dryRun,
        notificationId: null,
        ready: false,
        reason: "Push notifications are disabled",
        attempted: 0,
        delivered: 0,
        failures: 0
      });
      return true;
    }

    if (subscriptions.length === 0) {
      this.dependencies.jsonResponse(input.res, 200, {
        ok: true,
        dryRun,
        notificationId: null,
        ready: false,
        reason: "No push subscriptions registered",
        attempted: 0,
        delivered: 0,
        failures: 0
      });
      return true;
    }

    if (dryRun) {
      this.dependencies.jsonResponse(input.res, 200, {
        ok: true,
        dryRun: true,
        notificationId: null,
        ready: true,
        reason: "Push notifications are configured and subscriptions are present",
        attempted: subscriptions.length,
        delivered: 0,
        failures: 0
      });
      return true;
    }

    const pushDispatchAttempts = await this.sendPushTestNotificationsByPrivacyMode({
      subscriptions,
      body
    });
    const aggregatedSendResult = this.aggregatePushDispatchAttempts(pushDispatchAttempts);
    const selectedPayload = pushDispatchAttempts[0]?.payload;
    if (!selectedPayload) {
      this.dependencies.jsonResponse(input.res, 500, {
        ok: false,
        error: "Push test dispatch did not produce a payload"
      });
      return true;
    }

    await this.dependencies.pushMutationConcurrencyCoordinator.runExclusive(async () => {
      await Promise.all(
        aggregatedSendResult.prunedEndpoints.map(async (endpoint) => {
          return this.dependencies.pushStore.removeSubscriptionByEndpoint(endpoint);
        })
      );

      this.dependencies.pushSendStore.setLatest({
        notificationId: selectedPayload.notificationId,
        threadId: selectedPayload.threadId,
        turnId: selectedPayload.turnId,
        sentAt: selectedPayload.createdAt,
        attempted: aggregatedSendResult.attempted,
        delivered: aggregatedSendResult.delivered,
        failures: aggregatedSendResult.failures
      });
    });

    this.dependencies.jsonResponse(input.res, 200, {
      ok: true,
      dryRun: false,
      notificationId: selectedPayload.notificationId,
      ready: true,
      reason: "Push notification attempted",
      attempted: aggregatedSendResult.attempted,
      delivered: aggregatedSendResult.delivered,
      failures: aggregatedSendResult.failures
    });
    return true;
  }

  private aggregatePushDispatchAttempts(attempts: PushDispatchAttempt[]): {
    attempted: number;
    delivered: number;
    failures: number;
    prunedEndpoints: string[];
  } {
    const prunedEndpointSet = new Set<string>();
    let attempted = 0;
    let delivered = 0;
    let failures = 0;

    for (const attempt of attempts) {
      attempted += attempt.sendResult.attempted;
      delivered += attempt.sendResult.delivered;
      failures += attempt.sendResult.failures.length;
      for (const endpoint of attempt.sendResult.prunedEndpoints) {
        prunedEndpointSet.add(endpoint);
      }
    }

    return {
      attempted,
      delivered,
      failures,
      prunedEndpoints: Array.from(prunedEndpointSet)
    };
  }

  private async sendPushTestNotificationsByPrivacyMode(input: {
    subscriptions: StoredPushSubscription[];
    body: z.infer<typeof FarfieldPushTestBodySchema>;
  }): Promise<PushDispatchAttempt[]> {
    const privateModeSubscriptions = input.subscriptions.filter(
      (subscription) => subscription.settings.privateMode
    );
    const detailedModeSubscriptions = input.subscriptions.filter(
      (subscription) => !subscription.settings.privateMode
    );

    const pushDispatchAttempts: PushDispatchAttempt[] = [];
    if (privateModeSubscriptions.length > 0) {
      const privatePayload = this.dependencies.buildPushTestPayload(input.body, true);
      const privateSendResult = await this.dependencies.pushService.sendToSubscriptions(
        privateModeSubscriptions,
        privatePayload
      );
      pushDispatchAttempts.push({
        payload: privatePayload,
        sendResult: privateSendResult
      });
    }

    if (detailedModeSubscriptions.length > 0) {
      const detailedPayload = this.dependencies.buildPushTestPayload(input.body, false);
      const detailedSendResult = await this.dependencies.pushService.sendToSubscriptions(
        detailedModeSubscriptions,
        detailedPayload
      );
      pushDispatchAttempts.push({
        payload: detailedPayload,
        sendResult: detailedSendResult
      });
    }

    return pushDispatchAttempts;
  }
}
