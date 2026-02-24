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
  pushTestBodySchema: typeof FarfieldPushTestBodySchema;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  buildPushTestPayload: (
    input: z.infer<typeof FarfieldPushTestBodySchema>,
    privateMode: boolean
  ) => PushNotificationPayload;
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
    const subscription = await pushStore.upsertSubscription(body.subscription, {
      privateMode: body.settings?.privateMode ?? pushPrivateModeDefault
    });
    jsonResponse(res, 200, {
      ok: true,
      subscriptionId: subscription.id
    });
    return true;
  }

  if (req.method === "DELETE" && pathname === "/api/push/subscriptions") {
    const body = parseBody(DeletePushSubscriptionBodySchema, await readJsonBody(req));
    const deleted = await pushStore.removeSubscriptionByEndpoint(body.endpoint);
    jsonResponse(res, 200, {
      ok: true,
      deleted
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/push/test") {
    const body = parseBody(pushTestBodySchema, await readJsonBody(req));
    const subscriptions = pushStore.listSubscriptions();
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

    const privateMode = subscriptions.every((subscription) => subscription.settings.privateMode);
    const payload = buildPushTestPayload(body, privateMode);
    const sendResult = await pushService.sendToSubscriptions(subscriptions, payload);

    await Promise.all(
      sendResult.prunedEndpoints.map(async (endpoint) => pushStore.removeSubscriptionByEndpoint(endpoint))
    );

    pushSendStore.setLatest({
      notificationId: payload.notificationId,
      threadId: payload.threadId,
      turnId: payload.turnId,
      sentAt: payload.createdAt,
      attempted: sendResult.attempted,
      delivered: sendResult.delivered,
      failures: sendResult.failures.length
    });

    jsonResponse(res, 200, {
      ok: true,
      dryRun: false,
      notificationId: payload.notificationId,
      ready: true,
      reason: "Push notification attempted",
      attempted: sendResult.attempted,
      delivered: sendResult.delivered,
      failures: sendResult.failures.length
    });
    return true;
  }

  return false;
}
