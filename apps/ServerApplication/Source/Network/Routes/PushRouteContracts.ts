import type { IncomingMessage, ServerResponse } from "node:http";
import {
  FarfieldPushTestBodySchema,
  type JsonValue,
  type PushNotificationPayload
} from "@farfield/protocol";
import { z } from "zod";
import type { PushReceiptStore } from "../../Modules/PushNotifications/PushReceiptStore.js";
import type { PushSendStore } from "../../Modules/PushNotifications/PushSendStore.js";
import type { PushService } from "../../Modules/PushNotifications/PushService.js";
import type { PushStore } from "../../Modules/PushNotifications/PushStore.js";
import type { PushMutationConcurrencyCoordinator } from "../PushMutationConcurrencyCoordinator.js";

export const PushRouteMethodByName = {
  get: "GET",
  post: "POST",
  delete: "DELETE"
} as const;

export const PushRoutePathnameByName = {
  status: "/api/push/status",
  vapidPublicKey: "/api/push/vapid-public-key",
  receiptsLatest: "/api/push/receipts/latest",
  receipts: "/api/push/receipts",
  sendsLatest: "/api/push/sends/latest",
  localCa: "/api/push/local-ca",
  localCaDownload: "/api/push/local-ca/download",
  subscriptions: "/api/push/subscriptions",
  test: "/api/push/test"
} as const;

export const PushRouteSegmentByName = {
  api: "api",
  push: "push"
} as const;

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
  pushTestSendTimeoutMs: number;
  pushTestBodySchema: typeof FarfieldPushTestBodySchema;
  readJsonBody: (req: IncomingMessage) => Promise<JsonValue>;
  jsonResponse: (res: ServerResponse, statusCode: number, body: object) => void;
  buildPushTestPayload: (
    input: z.infer<typeof FarfieldPushTestBodySchema>,
    privateMode: boolean
  ) => PushNotificationPayload;
  withTimeout: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string
  ) => Promise<ValueType>;
}
