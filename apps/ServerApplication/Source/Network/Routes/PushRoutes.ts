import fs from "node:fs";
import path from "node:path";
import type { ServerResponse } from "node:http";
import {
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema,
  type CreatePushReceiptBody,
  DeletePushSubscriptionBodySchema
} from "@farfield/protocol";
import { z } from "zod";
import { parseBody } from "../RequestSchemas/HttpSchemas.js";
import {
  PushRouteMethodByName,
  PushRoutePathnameByName,
  PushRouteSegmentByName,
  type PushRouteDependencies
} from "./PushRouteContracts.js";
import { PushTestRouteOwner } from "./PushTestRouteOwner.js";

/**
 * Owns `/api/push/*` route orchestration, including request contract dispatch,
 * receipt normalization, and local CA download behavior.
 */
const PushRouteStatusCodeByName = {
  ok: 200,
  notFound: 404,
  serverError: 500,
  serviceUnavailable: 503
} as const;

const PushRouteErrorByName = {
  notificationsDisabled: "Push notifications are disabled",
  localCaNotFound: "Local Caddy root certificate not found"
} as const;

const PushRouteContentTypeByName = {
  pemFile: "application/x-pem-file"
} as const;

const PushRouteFileSystemErrorCodeByName = {
  missingPath: "ENOENT"
} as const;

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

function isPushRoutePrefix(segments: string[]): boolean {
  return segments[0] === PushRouteSegmentByName.api && segments[1] === PushRouteSegmentByName.push;
}

function isPushRouteRequest(
  method: string | undefined,
  pathname: string,
  expectedMethod: string,
  expectedPathname: string
): boolean {
  return method === expectedMethod && pathname === expectedPathname;
}

function normalizePushReceiptBody(body: CreatePushReceiptBody): CreatePushReceiptBody {
  return {
    notificationId: body.notificationId,
    event: body.event,
    url: body.url,
    threadId: body.threadId ?? null,
    turnId: body.turnId ?? null,
    ...(body.message ? { message: body.message } : {}),
    createdAt: body.createdAt
  };
}

function isMissingPathError<ErrorType>(error: ErrorType): boolean {
  const parsedFileSystemError = FileSystemErrorSchema.safeParse(error);
  return (
    parsedFileSystemError.success
    && parsedFileSystemError.data.code === PushRouteFileSystemErrorCodeByName.missingPath
  );
}

export type { PushRouteDependencies } from "./PushRouteContracts.js";

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
    pushTestSendTimeoutMs,
    pushTestBodySchema,
    readJsonBody,
    jsonResponse,
    buildPushTestPayload,
    withTimeout
  } = deps;
  const pushTestRouteOwner = new PushTestRouteOwner({
    pushService,
    pushStore,
    pushSendStore,
    pushMutationConcurrencyCoordinator,
    pushTestBodySchema,
    readJsonBody,
    jsonResponse,
    buildPushTestPayload,
    pushTestSendTimeoutMs,
    withTimeout
  });

  if (!isPushRoutePrefix(segments)) {
    return false;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.get,
      PushRoutePathnameByName.status
    )
  ) {
    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      enabled: pushService.isEnabled(),
      permissionRequired: true,
      subscriptionCount: pushStore.getSubscriptionCount(),
      privateModeDefault: pushPrivateModeDefault
    });
    return true;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.get,
      PushRoutePathnameByName.vapidPublicKey
    )
  ) {
    if (!pushService.isEnabled()) {
      jsonResponse(res, PushRouteStatusCodeByName.serviceUnavailable, {
        ok: false,
        error: PushRouteErrorByName.notificationsDisabled
      });
      return true;
    }

    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      publicKey: pushService.getPublicKey()
    });
    return true;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.get,
      PushRoutePathnameByName.receiptsLatest
    )
  ) {
    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      latest: pushReceiptStore.getLatest(),
      count: pushReceiptStore.getCount()
    });
    return true;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.post,
      PushRoutePathnameByName.receipts
    )
  ) {
    const body = parseBody(CreatePushReceiptBodySchema, await readJsonBody(req));
    const normalizedBody = normalizePushReceiptBody(body);

    pushReceiptStore.add({
      notificationId: normalizedBody.notificationId,
      event: normalizedBody.event,
      url: normalizedBody.url,
      threadId: normalizedBody.threadId ?? null,
      turnId: normalizedBody.turnId ?? null,
      message: normalizedBody.message ?? null,
      createdAt: normalizedBody.createdAt
    });

    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      recorded: true
    });
    return true;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.get,
      PushRoutePathnameByName.sendsLatest
    )
  ) {
    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      latest: pushSendStore.getLatest()
    });
    return true;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.get,
      PushRoutePathnameByName.localCa
    )
  ) {
    const available = fs.existsSync(pushLocalCaSourcePath);
    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      available,
      downloadPath: available ? PushRoutePathnameByName.localCaDownload : null
    });
    return true;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.get,
      PushRoutePathnameByName.localCaDownload
    )
  ) {
    const fileName = path.basename(pushLocalCaSourcePath);
    try {
      await streamBinaryFileDownload(
        res,
        pushLocalCaSourcePath,
        fileName,
        PushRouteContentTypeByName.pemFile
      );
      return true;
    } catch (error) {
      if (isMissingPathError(error)) {
        jsonResponse(res, PushRouteStatusCodeByName.notFound, {
          ok: false,
          error: PushRouteErrorByName.localCaNotFound
        });
        return true;
      }
      jsonResponse(res, PushRouteStatusCodeByName.serverError, {
        ok: false,
        error: toErrorMessage(error)
      });
      return true;
    }
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.post,
      PushRoutePathnameByName.subscriptions
    )
  ) {
    const body = parseBody(CreatePushSubscriptionBodySchema, await readJsonBody(req));
    const subscription = await pushMutationConcurrencyCoordinator.runExclusive(async () => {
      return pushStore.upsertSubscription(body.subscription, {
        privateMode: body.settings?.privateMode ?? pushPrivateModeDefault
      });
    });
    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      subscriptionId: subscription.id
    });
    return true;
  }

  if (
    isPushRouteRequest(
      req.method,
      pathname,
      PushRouteMethodByName.delete,
      PushRoutePathnameByName.subscriptions
    )
  ) {
    const body = parseBody(DeletePushSubscriptionBodySchema, await readJsonBody(req));
    const deleted = await pushMutationConcurrencyCoordinator.runExclusive(async () => {
      return pushStore.removeSubscriptionByEndpoint(body.endpoint);
    });
    jsonResponse(res, PushRouteStatusCodeByName.ok, {
      ok: true,
      deleted
    });
    return true;
  }

  if (await pushTestRouteOwner.handle({ req, res, pathname })) {
    return true;
  }

  return false;
}
