import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  CreateDebugClientErrorBodySchema,
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema,
  CreatePushSubscriptionResponseSchema,
  DebugErrorCreateResponseSchema,
  DebugErrorDetailResponseSchema,
  DebugErrorListResponseSchema,
  PushLocalCaStatusResponseSchema,
  PushReceiptCreateResponseSchema,
  PushReceiptLatestResponseSchema,
  PushStatusResponseSchema,
  VapidPublicKeyResponseSchema
} from "@farfield/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const ApiErrorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1)
  })
  .strict();

const HealthEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    state: z
      .object({
        appReady: z.boolean(),
        ipcConnected: z.boolean(),
        ipcInitialized: z.boolean(),
        pushSubscriptionCount: z.number().int().nonnegative()
      })
      .passthrough()
  })
  .strict();

const EventsSessionEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    authRequired: z.boolean(),
    bootstrapped: z.boolean(),
    expiresAt: z.string().datetime().nullable()
  })
  .strict();

const PushStatusEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushStatusResponseSchema)
  .strict();

const VapidPublicKeyEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(VapidPublicKeyResponseSchema)
  .strict();

const CreatePushSubscriptionEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(CreatePushSubscriptionResponseSchema)
  .strict();

const PushTestEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    dryRun: z.boolean(),
    notificationId: z.string().nullable(),
    ready: z.boolean(),
    reason: z.string().min(1),
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative()
  })
  .strict();

const PushReceiptCreateEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushReceiptCreateResponseSchema)
  .strict();

const PushReceiptLatestEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushReceiptLatestResponseSchema)
  .strict();

const PushLocalCaStatusEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushLocalCaStatusResponseSchema)
  .strict();

const DebugErrorCreateEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorCreateResponseSchema)
  .strict();

const DebugErrorListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorListResponseSchema)
  .strict();

const DebugErrorDetailEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorDetailResponseSchema)
  .strict();

const AddressSchema = z
  .object({
    address: z.string(),
    family: z.union([z.literal("IPv4"), z.literal("IPv6")]),
    port: z.number().int().positive()
  })
  .strict();

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const parsedAddress = AddressSchema.safeParse(server.address());
      if (!parsedAddress.success) {
        server.close(() => reject(new Error("Could not resolve temporary port")));
        return;
      }

      const port = parsedAddress.data.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServerReady(baseUrl: string, token: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
        headers: {
          "X-Farfield-Token": token
        }
      });
      if (response.status === 200) {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error(`Timed out waiting for server readiness at ${baseUrl}`);
}

describe("server route integration", () => {
  const apiToken = "integration_test_token";
  const vapidPublicKey =
    "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U";
  const vapidPrivateKey = "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds";
  const vapidSubject = "mailto:integration@example.com";
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let serverLogs = "";
  let tempDirectory = "";
  let baseUrl = "";

  beforeAll(async () => {
    const port = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${String(port)}`;
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-server-integration-"));
    const localCaPath = path.join(tempDirectory, "root.crt");
    fs.writeFileSync(localCaPath, "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n", "utf8");

    const serverEntryPath = path.resolve(process.cwd(), "src", "index.ts");
    serverProcess = spawn(
      process.execPath,
      ["--import", "tsx", serverEntryPath, "--agents=codex"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: String(port),
          API_TOKEN: apiToken,
          PUSH_ENABLED: "true",
          PUSH_VAPID_PUBLIC_KEY: vapidPublicKey,
          PUSH_VAPID_PRIVATE_KEY: vapidPrivateKey,
          PUSH_VAPID_SUBJECT: vapidSubject,
          PUSH_STATE_PATH: path.join(tempDirectory, "push-state.json"),
          PUSH_RECEIPTS_PATH: path.join(tempDirectory, "push-receipts.json"),
          PUSH_SENDS_PATH: path.join(tempDirectory, "push-sends.json"),
          PUSH_LOCAL_CA_PATH: localCaPath,
          DEBUG_CLIENT_ERROR_LOG_PATH: path.join(tempDirectory, "client-errors.ndjson")
        },
        stdio: "pipe"
      }
    );

    serverProcess.stdout.on("data", (chunk: Buffer) => {
      serverLogs += chunk.toString("utf8");
    });
    serverProcess.stderr.on("data", (chunk: Buffer) => {
      serverLogs += chunk.toString("utf8");
    });

    try {
      await waitForServerReady(baseUrl, apiToken, 10_000);
    } catch (error) {
      throw new Error(
        `Server failed to become ready: ${error instanceof Error ? error.message : String(error)}\n${serverLogs}`
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        serverProcess?.once("exit", () => resolve());
      });
      serverProcess = null;
    }

    if (tempDirectory.length > 0 && fs.existsSync(tempDirectory)) {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("enforces API auth and exposes health shape", async () => {
    const unauthorizedResponse = await fetch(`${baseUrl}/api/health`);
    expect(unauthorizedResponse.status).toBe(401);
    ApiErrorEnvelopeSchema.parse(await unauthorizedResponse.json());

    const authorizedResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(authorizedResponse.status).toBe(200);
    const health = HealthEnvelopeSchema.parse(await authorizedResponse.json());
    expect(health.state.pushSubscriptionCount).toBe(0);
  });

  it("supports events session bootstrap", async () => {
    const response = await fetch(`${baseUrl}/api/events/session`, {
      method: "POST",
      headers: {
        "X-Farfield-Token": apiToken
      }
    });

    expect(response.status).toBe(200);
    const payload = EventsSessionEnvelopeSchema.parse(await response.json());
    expect(payload.authRequired).toBe(true);
    expect(payload.bootstrapped).toBe(true);
  });

  it("supports push route contracts", async () => {
    const statusResponse = await fetch(`${baseUrl}/api/push/status`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(statusResponse.status).toBe(200);
    const status = PushStatusEnvelopeSchema.parse(await statusResponse.json());
    expect(status.subscriptionCount).toBe(0);

    const vapidResponse = await fetch(`${baseUrl}/api/push/vapid-public-key`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(vapidResponse.status).toBe(200);
    const vapid = VapidPublicKeyEnvelopeSchema.parse(await vapidResponse.json());
    expect(vapid.publicKey).toBe(vapidPublicKey);

    const subscriptionBody = CreatePushSubscriptionBodySchema.parse({
      subscription: {
        endpoint: "https://push.example.test/subscriptions/sub_1",
        keys: {
          p256dh: "BElidedKeyMaterial_123",
          auth: "CAuthValue_456"
        }
      },
      settings: {
        privateMode: true
      }
    });

    const createSubscriptionResponse = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Farfield-Token": apiToken
      },
      body: JSON.stringify(subscriptionBody)
    });
    expect(createSubscriptionResponse.status).toBe(200);
    CreatePushSubscriptionEnvelopeSchema.parse(await createSubscriptionResponse.json());

    const statusAfterSubscriptionResponse = await fetch(`${baseUrl}/api/push/status`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    const statusAfterSubscription = PushStatusEnvelopeSchema.parse(
      await statusAfterSubscriptionResponse.json()
    );
    expect(statusAfterSubscription.subscriptionCount).toBe(1);

    const pushTestResponse = await fetch(`${baseUrl}/api/push/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Farfield-Token": apiToken
      },
      body: JSON.stringify({
        threadId: "thread_integration",
        turnId: "turn_integration",
        dryRun: true
      })
    });
    expect(pushTestResponse.status).toBe(200);
    const pushTestPayload = PushTestEnvelopeSchema.parse(await pushTestResponse.json());
    expect(pushTestPayload.ready).toBe(true);
    expect(pushTestPayload.attempted).toBe(1);

    const receiptBody = CreatePushReceiptBodySchema.parse({
      notificationId: "notif_integration",
      event: "shown",
      url: "/threads/thread_integration",
      threadId: "thread_integration",
      turnId: "turn_integration",
      message: "shown",
      createdAt: new Date().toISOString()
    });

    const receiptResponse = await fetch(`${baseUrl}/api/push/receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Farfield-Token": apiToken
      },
      body: JSON.stringify(receiptBody)
    });
    expect(receiptResponse.status).toBe(200);
    PushReceiptCreateEnvelopeSchema.parse(await receiptResponse.json());

    const latestReceiptResponse = await fetch(`${baseUrl}/api/push/receipts/latest`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(latestReceiptResponse.status).toBe(200);
    const latestReceipt = PushReceiptLatestEnvelopeSchema.parse(await latestReceiptResponse.json());
    expect(latestReceipt.count).toBeGreaterThanOrEqual(1);
    expect(latestReceipt.latest?.notificationId).toBe("notif_integration");

    const localCaStatusResponse = await fetch(`${baseUrl}/api/push/local-ca`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(localCaStatusResponse.status).toBe(200);
    const localCaStatus = PushLocalCaStatusEnvelopeSchema.parse(await localCaStatusResponse.json());
    expect(localCaStatus.available).toBe(true);
    expect(localCaStatus.downloadPath).toBe("/api/push/local-ca/download");

    const localCaDownloadResponse = await fetch(`${baseUrl}/api/push/local-ca/download`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(localCaDownloadResponse.status).toBe(200);
    const localCaBody = await localCaDownloadResponse.text();
    expect(localCaBody.includes("BEGIN CERTIFICATE")).toBe(true);
  });

  it("supports debug client-error contracts", async () => {
    const createBody = CreateDebugClientErrorBodySchema.parse({
      source: "web-app",
      operation: "integration:test",
      message: "integration failure",
      details: {
        key: "value"
      }
    });

    const createResponse = await fetch(`${baseUrl}/api/debug/client-errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Farfield-Token": apiToken
      },
      body: JSON.stringify(createBody)
    });
    expect(createResponse.status).toBe(200);
    const created = DebugErrorCreateEnvelopeSchema.parse(await createResponse.json());

    const listResponse = await fetch(`${baseUrl}/api/debug/client-errors?limit=20`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(listResponse.status).toBe(200);
    const listed = DebugErrorListEnvelopeSchema.parse(await listResponse.json());
    const listedEvent = listed.data.find((event) => event.errorId === created.errorId);
    expect(Boolean(listedEvent)).toBe(true);

    const detailResponse = await fetch(
      `${baseUrl}/api/debug/client-errors/${encodeURIComponent(created.errorId)}`,
      {
        headers: {
          "X-Farfield-Token": apiToken
        }
      }
    );
    expect(detailResponse.status).toBe(200);
    const detail = DebugErrorDetailEnvelopeSchema.parse(await detailResponse.json());
    expect(detail.error.errorId).toBe(created.errorId);

    const sessionLogResponse = await fetch(`${baseUrl}/api/debug/client-errors/session-log`, {
      headers: {
        "X-Farfield-Token": apiToken
      }
    });
    expect(sessionLogResponse.status).toBe(200);
    const sessionLog = await sessionLogResponse.text();
    expect(sessionLog.includes(created.errorId)).toBe(true);
  });
});
