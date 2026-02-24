import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema,
  type CreatePushReceiptBody,
  DeletePushSubscriptionBodySchema,
  FarfieldPushTestBodySchema,
  type JsonValue,
  type PushNotificationPayload
} from "@farfield/protocol";
import { z } from "zod";
import { parseBody } from "../RequestSchemas/HttpSchemas.js";
import type { PushReceiptStore } from "../../Modules/PushNotifications/PushReceiptStore.js";
import type { PushSendStore } from "../../Modules/PushNotifications/PushSendStore.js";
import type { PushService } from "../../Modules/PushNotifications/PushService.js";
import type { PushStore } from "../../Modules/PushNotifications/PushStore.js";
import type { PushMutationConcurrencyCoordinator } from "../PushMutationConcurrencyCoordinator.js";
import type { PushSendResult } from "../../Modules/PushNotifications/PushService.js";
import type { StoredPushSubscription } from "@farfield/protocol";

const PushReceiptEventSchema = z.enum(["shown", "clicked", "error"]);
const FileSystemErrorSchema = z
  .object({
    code: z.string().optional()
  })
  .passthrough();

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

async function streamBinaryFileDownload(
  res: ServerResponse,
  filePath: string,
  downloadFileName: string,
  contentType: string
): Promise<void> {
  const fileStats = await fs.promises.stat(filePath);
  if (!fileStats.isFile()) {
    throw new Error("Requested download path is not a file");
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": fileStats.size,
    "Content-Disposition": `attachment; filename=\"${downloadFileName}\"`,
    "Access-Control-Allow-Origin": "*"
  });

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.once("error", reject);
    stream.once("end", resolve);
    stream.pipe(res);
  });
}

export interface PushRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  segments: string[];
  pushPrivateModeDefault: boolean;
  pushLocalCaSourcePath: string;
  pushService: PushService;
  pushStore: PushStore;
  pushReceiptStore: PushReceiptStore;
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

interface PushDispatchAttempt {
  payload: PushNotificationPayload;
  sendResult: PushSendResult;
}

function aggregatePushDispatchAttempts(attempts: PushDispatchAttempt[]): {
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

async function sendPushTestNotificationsByPrivacyMode(input: {
  subscriptions: StoredPushSubscription[];
  body: z.infer<typeof FarfieldPushTestBodySchema>;
  pushService: PushService;
  buildPushTestPayload: (
    input: z.infer<typeof FarfieldPushTestBodySchema>,
    privateMode: boolean
  ) => PushNotificationPayload;
}): Promise<PushDispatchAttempt[]> {
  const privateModeSubscriptions = input.subscriptions.filter(
    (subscription) => subscription.settings.privateMode
  );
  const detailedModeSubscriptions = input.subscriptions.filter(
    (subscription) => !subscription.settings.privateMode
  );

  const pushDispatchAttempts: PushDispatchAttempt[] = [];
  if (privateModeSubscriptions.length > 0) {
    const privatePayload = input.buildPushTestPayload(input.body, true);
    const privateSendResult = await input.pushService.sendToSubscriptions(
      privateModeSubscriptions,
      privatePayload
    );
    pushDispatchAttempts.push({
      payload: privatePayload,
      sendResult: privateSendResult
    });
  }

  if (detailedModeSubscriptions.length > 0) {
    const detailedPayload = input.buildPushTestPayload(input.body, false);
    const detailedSendResult = await input.pushService.sendToSubscriptions(
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

export async function handlePushRoutes(deps: PushRouteDependencies): Promise<boolean> {
  const {
    req,
    res,
    pathname,
    segments,
    pushPrivateModeDefault,
    pushLocalCaSourcePath,
    pushService,
    pushStore,
    pushReceiptStore,
    pushSendStore,
    pushMutationConcurrencyCoordinator,
    pushTestBodySchema,
    readJsonBody,
    jsonResponse,
    buildPushTestPayload
  } = deps;

  if (segments[0] !== "api" || segments[1] !== "push") {
    return false;
  }

  if (req.method === "GET" && pathname === "/api/push/status") {
    jsonResponse(res, 200, {
      ok: true,
      enabled: pushService.isEnabled(),
      permissionRequired: true,
      subscriptionCount: pushStore.getSubscriptionCount(),
      privateModeDefault: pushPrivateModeDefault
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/push/vapid-public-key") {
    if (!pushService.isEnabled()) {
      jsonResponse(res, 503, {
        ok: false,
        error: "Push notifications are disabled"
      });
      return true;
    }

    jsonResponse(res, 200, {
      ok: true,
      publicKey: pushService.getPublicKey()
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/push/receipts/latest") {
    jsonResponse(res, 200, {
      ok: true,
      latest: pushReceiptStore.getLatest(),
      count: pushReceiptStore.getCount()
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/push/receipts") {
    const body = parseBody(CreatePushReceiptBodySchema, await readJsonBody(req));
    const event = PushReceiptEventSchema.parse(body.event);
    const normalizedBody: CreatePushReceiptBody = {
      notificationId: body.notificationId,
      event,
      url: body.url,
      threadId: body.threadId ?? null,
      turnId: body.turnId ?? null,
      ...(body.message ? { message: body.message } : {}),
      createdAt: body.createdAt
    };

    pushReceiptStore.add({
      notificationId: normalizedBody.notificationId,
      event: normalizedBody.event,
      url: normalizedBody.url,
      threadId: normalizedBody.threadId ?? null,
      turnId: normalizedBody.turnId ?? null,
      message: normalizedBody.message ?? null,
      createdAt: normalizedBody.createdAt
    });

    jsonResponse(res, 200, {
      ok: true,
      recorded: true
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/push/sends/latest") {
    jsonResponse(res, 200, {
      ok: true,
      latest: pushSendStore.getLatest()
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/push/local-ca") {
    const available = fs.existsSync(pushLocalCaSourcePath);
    jsonResponse(res, 200, {
      ok: true,
      available,
      downloadPath: available ? "/api/push/local-ca/download" : null,
      sourcePath: available ? pushLocalCaSourcePath : null
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/push/local-ca/download") {
    const fileName = path.basename(pushLocalCaSourcePath);
    try {
      await streamBinaryFileDownload(
        res,
        pushLocalCaSourcePath,
        fileName,
        "application/x-pem-file"
      );
      return true;
    } catch (error) {
      const parsedFileSystemError = FileSystemErrorSchema.safeParse(error);
      if (parsedFileSystemError.success && parsedFileSystemError.data.code === "ENOENT") {
        jsonResponse(res, 404, {
          ok: false,
          error: "Local Caddy root certificate not found"
        });
        return true;
      }
      jsonResponse(res, 500, {
        ok: false,
        error: toErrorMessage(error)
      });
      return true;
    }
  }

  if (req.method === "POST" && pathname === "/api/push/subscriptions") {
    const body = parseBody(CreatePushSubscriptionBodySchema, await readJsonBody(req));
    const subscription = await pushMutationConcurrencyCoordinator.runExclusive(async () => {
      return pushStore.upsertSubscription(body.subscription, {
        privateMode: body.settings?.privateMode ?? pushPrivateModeDefault
      });
    });
    jsonResponse(res, 200, {
      ok: true,
      subscriptionId: subscription.id
    });
    return true;
  }

  if (req.method === "DELETE" && pathname === "/api/push/subscriptions") {
    const body = parseBody(DeletePushSubscriptionBodySchema, await readJsonBody(req));
    const deleted = await pushMutationConcurrencyCoordinator.runExclusive(async () => {
      return pushStore.removeSubscriptionByEndpoint(body.endpoint);
    });
    jsonResponse(res, 200, {
      ok: true,
      deleted
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/push/test") {
    const body = parseBody(pushTestBodySchema, await readJsonBody(req));
    const subscriptions = await pushMutationConcurrencyCoordinator.runExclusive(async () => {
      return pushStore.listSubscriptions();
    });
    const dryRun = body.dryRun === true;

    if (!pushService.isEnabled()) {
      jsonResponse(res, 200, {
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
      jsonResponse(res, 200, {
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
      jsonResponse(res, 200, {
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

    const pushDispatchAttempts = await sendPushTestNotificationsByPrivacyMode({
      subscriptions,
      body,
      pushService,
      buildPushTestPayload
    });
    const aggregatedSendResult = aggregatePushDispatchAttempts(pushDispatchAttempts);
    const selectedPayload = pushDispatchAttempts[0]?.payload;
    if (!selectedPayload) {
      jsonResponse(res, 500, {
        ok: false,
        error: "Push test dispatch did not produce a payload"
      });
      return true;
    }

    await pushMutationConcurrencyCoordinator.runExclusive(async () => {
      await Promise.all(
        aggregatedSendResult.prunedEndpoints.map(async (endpoint) => pushStore.removeSubscriptionByEndpoint(endpoint))
      );

      pushSendStore.setLatest({
        notificationId: selectedPayload.notificationId,
        threadId: selectedPayload.threadId,
        turnId: selectedPayload.turnId,
        sentAt: selectedPayload.createdAt,
        attempted: aggregatedSendResult.attempted,
        delivered: aggregatedSendResult.delivered,
        failures: aggregatedSendResult.failures
      });
    });

    jsonResponse(res, 200, {
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

  return false;
}
