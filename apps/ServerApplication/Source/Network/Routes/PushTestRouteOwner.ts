import {
  FarfieldApiErrorResponseSchema,
  FarfieldPushTestBodySchema,
  FarfieldPushTestEnvelopeSchema,
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
import {
  PushRouteMethodByName,
  PushRoutePathnameByName
} from "./PushRouteContracts.js";

type PushTestRequestBody = z.infer<typeof FarfieldPushTestBodySchema>;
type PushTestResponseBody = z.infer<typeof FarfieldPushTestEnvelopeSchema>;
type PushTestErrorResponseBody = z.infer<typeof FarfieldApiErrorResponseSchema>;
type PushTestDispatchModeLabel = "private" | "detailed";

const PushTestReasonByName = {
  disabled: "Push notifications are disabled",
  noSubscriptions: "No push subscriptions registered",
  readyForDryRun: "Push notifications are configured and subscriptions are present",
  attempted: "Push notification attempted"
} as const;

const PushTestDispatchModeByName: Record<PushTestDispatchModeLabel, PushTestDispatchModeLabel> = {
  private: "private",
  detailed: "detailed"
};

const PushTestDispatchMissingPayloadErrorMessage = "Push test dispatch did not produce a payload";
const PushTestSendTimeoutLabelPrefix = "push-test-send";
const EmptyPushSendSummary = {
  attempted: 0,
  delivered: 0,
  failures: 0
} as const;

interface PushDispatchAttempt {
  payload: PushNotificationPayload;
  sendResult: PushSendResult;
}

interface PushTestResponsePayload {
  dryRun: boolean;
  notificationId: string | null;
  ready: boolean;
  reason: string;
  attempted: number;
  delivered: number;
  failures: number;
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
    input: PushTestRequestBody,
    privateMode: boolean
  ) => PushNotificationPayload;
  pushTestSendTimeoutMs: number;
  withTimeout: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string
  ) => Promise<ValueType>;
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
    if (
      !(
        input.req.method === PushRouteMethodByName.post &&
        input.pathname === PushRoutePathnameByName.test
      )
    ) {
      return false;
    }

    const body = parseBody(this.dependencies.pushTestBodySchema, await this.dependencies.readJsonBody(input.req));
    const subscriptions = await this.dependencies.pushMutationConcurrencyCoordinator.runExclusive(async () => {
      return this.dependencies.pushStore.listSubscriptions();
    });
    const dryRun = body.dryRun === true;

    if (!this.dependencies.pushService.isEnabled()) {
      this.writePushTestResponse(input.res, {
        dryRun,
        notificationId: null,
        ready: false,
        reason: PushTestReasonByName.disabled,
        ...EmptyPushSendSummary
      });
      return true;
    }

    if (subscriptions.length === 0) {
      this.writePushTestResponse(input.res, {
        dryRun,
        notificationId: null,
        ready: false,
        reason: PushTestReasonByName.noSubscriptions,
        ...EmptyPushSendSummary
      });
      return true;
    }

    if (dryRun) {
      this.writePushTestResponse(input.res, {
        dryRun: true,
        notificationId: null,
        ready: true,
        reason: PushTestReasonByName.readyForDryRun,
        attempted: subscriptions.length,
        delivered: EmptyPushSendSummary.delivered,
        failures: EmptyPushSendSummary.failures
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
      const responseBody: PushTestErrorResponseBody = {
        ok: false,
        error: PushTestDispatchMissingPayloadErrorMessage
      };
      this.dependencies.jsonResponse(input.res, 500, responseBody);
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

    this.writePushTestResponse(input.res, {
      dryRun: false,
      notificationId: selectedPayload.notificationId,
      ready: true,
      reason: PushTestReasonByName.attempted,
      attempted: aggregatedSendResult.attempted,
      delivered: aggregatedSendResult.delivered,
      failures: aggregatedSendResult.failures
    });
    return true;
  }

  private writePushTestResponse(
    response: ServerResponse,
    payload: PushTestResponsePayload
  ): void {
    const responseBody: PushTestResponseBody = {
      ok: true,
      ...payload
    };
    this.dependencies.jsonResponse(response, 200, responseBody);
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
    body: PushTestRequestBody;
  }): Promise<PushDispatchAttempt[]> {
    const privateModeSubscriptions = input.subscriptions.filter(
      (subscription) => subscription.settings.privateMode
    );
    const detailedModeSubscriptions = input.subscriptions.filter(
      (subscription) => !subscription.settings.privateMode
    );

    const dispatchPromises: Promise<PushDispatchAttempt>[] = [];
    let sharedNotificationIdentifier: string | null = null;
    let sharedNotificationTimestamp: string | null = null;

    const alignPayloadWithSharedNotification = (
      payload: PushNotificationPayload
    ): PushNotificationPayload => {
      // Keep one notification identity across both privacy partitions so send summary state
      // and route response metadata reference a single test notification.
      if (sharedNotificationIdentifier === null || sharedNotificationTimestamp === null) {
        sharedNotificationIdentifier = payload.notificationId;
        sharedNotificationTimestamp = payload.createdAt;
        return payload;
      }

      return {
        ...payload,
        notificationId: sharedNotificationIdentifier,
        createdAt: sharedNotificationTimestamp
      };
    };

    if (privateModeSubscriptions.length > 0) {
      const privatePayload = alignPayloadWithSharedNotification(
        this.dependencies.buildPushTestPayload(input.body, true)
      );
      dispatchPromises.push(this.sendPushTestNotificationGroup({
        subscriptions: privateModeSubscriptions,
        payload: privatePayload,
        modeLabel: PushTestDispatchModeByName.private
      }));
    }

    if (detailedModeSubscriptions.length > 0) {
      const detailedPayload = alignPayloadWithSharedNotification(
        this.dependencies.buildPushTestPayload(input.body, false)
      );
      dispatchPromises.push(this.sendPushTestNotificationGroup({
        subscriptions: detailedModeSubscriptions,
        payload: detailedPayload,
        modeLabel: PushTestDispatchModeByName.detailed
      }));
    }

    return Promise.all(dispatchPromises);
  }

  private async sendPushTestNotificationGroup(input: {
    subscriptions: StoredPushSubscription[];
    payload: PushNotificationPayload;
    modeLabel: PushTestDispatchModeLabel;
  }): Promise<PushDispatchAttempt> {
    const sendResult = await this.dependencies.withTimeout(
      this.dependencies.pushService.sendToSubscriptions(input.subscriptions, input.payload),
      this.dependencies.pushTestSendTimeoutMs,
      `${PushTestSendTimeoutLabelPrefix}:${input.modeLabel}`
    );
    return {
      payload: input.payload,
      sendResult
    };
  }
}
