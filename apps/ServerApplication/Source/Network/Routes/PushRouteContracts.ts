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
