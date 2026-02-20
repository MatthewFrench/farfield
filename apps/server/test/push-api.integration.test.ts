import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CreatePushSubscriptionResponseSchema,
  DebugErrorCreateResponseSchema,
  DebugErrorDetailResponseSchema,
  DebugErrorListResponseSchema,
  DeletePushSubscriptionResponseSchema,
  IpcFrameSchema,
  PushLocalCaStatusResponseSchema,
  PushReceiptCreateResponseSchema,
  PushReceiptLatestResponseSchema,
  PushSendLatestResponseSchema,
  PushStatusResponseSchema,
  ThreadConversationStateSchema
} from "@farfield/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const API_ERROR_SCHEMA = z
  .object({
    ok: z.literal(false),
    error: z.string()
  })
  .strict();

const HEALTH_SCHEMA = z
  .object({
    ok: z.literal(true),
    state: z
      .object({
        ipcInitialized: z.boolean(),
        pushSubscriptionCount: z.number().int().nonnegative(),
        invalidThreadStreamEventsLast5m: z.number().int().nonnegative(),
        suppressedClientErrorReportsLast5m: z.number().int().nonnegative(),
        invalidPushPayloadsLast5m: z.number().int().nonnegative(),
        eventsAuthRejectsLast5m: z.number().int().nonnegative(),
        pushReceiptAuthRejectsLast5m: z.number().int().nonnegative(),
        eventsSessionBootstrapsLast5m: z.number().int().nonnegative(),
        eventsSessionRejectsLast5m: z.number().int().nonnegative(),
        activeEventsSessions: z.number().int().nonnegative()
      })
      .passthrough()
  })
  .strict();

const SHELL_HEALTHZ_SCHEMA = z
  .object({
    ok: z.literal(true),
    service: z.literal("farfield-web-shell"),
    buildId: z.string().min(1),
    gitCommit: z.string().nullable(),
    serviceWorkerVersion: z.string().nullable(),
    timestamp: z.string().datetime()
  })
  .strict();

const EVENTS_SESSION_BOOTSTRAP_SCHEMA = z
  .object({
    ok: z.literal(true),
    authRequired: z.boolean(),
    bootstrapped: z.boolean(),
    expiresAt: z.string().datetime().nullable()
  })
  .strict();

const PUSH_STATUS_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushStatusResponseSchema)
  .strict();

const CREATE_SUBSCRIPTION_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(CreatePushSubscriptionResponseSchema)
  .strict();

const DELETE_SUBSCRIPTION_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(DeletePushSubscriptionResponseSchema)
  .strict();

const PUSH_TEST_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true),
    dryRun: z.boolean(),
    notificationId: z.string().nullable(),
    ready: z.boolean(),
    reason: z.string(),
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative()
  })
  .strict();

const PUSH_RECEIPT_CREATE_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushReceiptCreateResponseSchema)
  .strict();

const PUSH_RECEIPT_LATEST_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushReceiptLatestResponseSchema)
  .strict();

const PUSH_SEND_LATEST_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushSendLatestResponseSchema)
  .strict();

const PUSH_LOCAL_CA_STATUS_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(PushLocalCaStatusResponseSchema)
  .strict();

const DEBUG_ERROR_CREATE_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorCreateResponseSchema)
  .strict();

const DEBUG_ERROR_LIST_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorListResponseSchema)
  .strict();

const DEBUG_ERROR_DETAIL_ENVELOPE_SCHEMA = z
  .object({
    ok: z.literal(true)
  })
  .merge(DebugErrorDetailResponseSchema)
  .strict();

const LIVE_STATE_SCHEMA = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable(),
    conversationState: z.union([ThreadConversationStateSchema, z.null()])
  })
  .strict();

const TEST_API_TOKEN = "integration-test-token";
const TEST_VAPID_PUBLIC_KEY =
  "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U";
const TEST_VAPID_PRIVATE_KEY = "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds";

let serverProcess: ChildProcessWithoutNullStreams | null = null;
let baseUrl = "";
let stateDirectory = "";
let receiptsPath = "";
let sendsPath = "";
let ipcSocketPath = "";
let fakeIpcServer: net.Server | null = null;
let fakeIpcConnection: net.Socket | null = null;
let fakeIpcBuffer = Buffer.alloc(0);
const capturedOutput: string[] = [];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reservePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to reserve TCP port"));
        return;
      }
      const port = address.port;
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

function encodeIpcFrame(frame: z.input<typeof IpcFrameSchema>): Buffer {
  const parsed = IpcFrameSchema.parse(frame);
  const encoded = Buffer.from(JSON.stringify(parsed), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(encoded.length, 0);
  return Buffer.concat([header, encoded]);
}

function sendFakeIpcFrame(frame: z.input<typeof IpcFrameSchema>): void {
  if (!fakeIpcConnection) {
    throw new Error("Fake IPC connection is not available");
  }
  fakeIpcConnection.write(encodeIpcFrame(frame));
}

function handleFakeIpcData(chunk: Buffer): void {
  fakeIpcBuffer = Buffer.concat([fakeIpcBuffer, chunk]);

  while (fakeIpcBuffer.length >= 4) {
    const frameSize = fakeIpcBuffer.readUInt32LE(0);
    if (fakeIpcBuffer.length < frameSize + 4) {
      return;
    }

    const payload = fakeIpcBuffer.slice(4, frameSize + 4).toString("utf8");
    fakeIpcBuffer = fakeIpcBuffer.slice(frameSize + 4);
    const frame = IpcFrameSchema.parse(JSON.parse(payload));

    if (frame.type !== "request") {
      continue;
    }

    if (frame.method === "initialize") {
      sendFakeIpcFrame({
        type: "response",
        requestId: frame.requestId,
        method: "initialize",
        handledByClientId: "fake-ipc-server",
        resultType: "success",
        result: {
          clientId: "fake-ipc-client"
        }
      });
      continue;
    }

    sendFakeIpcFrame({
      type: "response",
      requestId: frame.requestId,
      method: frame.method,
      handledByClientId: "fake-ipc-server",
      resultType: "error",
      error: "no-handler-for-request"
    });
  }
}

async function startFakeIpcServer(socketPath: string): Promise<void> {
  if (fs.existsSync(socketPath)) {
    fs.rmSync(socketPath, { force: true });
  }

  fakeIpcServer = net.createServer((socket) => {
    fakeIpcConnection = socket;
    fakeIpcBuffer = Buffer.alloc(0);

    socket.on("data", handleFakeIpcData);
    socket.on("close", () => {
      if (fakeIpcConnection === socket) {
        fakeIpcConnection = null;
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    if (!fakeIpcServer) {
      reject(new Error("Fake IPC server was not created"));
      return;
    }
    fakeIpcServer.once("error", reject);
    fakeIpcServer.listen(socketPath, () => resolve());
  });
}

async function stopFakeIpcServer(): Promise<void> {
  fakeIpcConnection?.destroy();
  fakeIpcConnection = null;
  fakeIpcBuffer = Buffer.alloc(0);

  if (fakeIpcServer) {
    await new Promise<void>((resolve, reject) => {
      if (!fakeIpcServer) {
        resolve();
        return;
      }
      fakeIpcServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    fakeIpcServer = null;
  }

  if (ipcSocketPath && fs.existsSync(ipcSocketPath)) {
    fs.rmSync(ipcSocketPath, { force: true });
  }
}

function authHeaders(includeJsonContentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Farfield-Token": TEST_API_TOKEN
  };
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function authHeadersWithOrigin(origin: string, includeJsonContentType = false): Record<string, string> {
  const headers = authHeaders(includeJsonContentType);
  headers["Origin"] = origin;
  return headers;
}

function parseCookieHeaderFromSetCookie(setCookieHeader: string): string {
  const cookieValue = setCookieHeader.split(";")[0]?.trim() ?? "";
  if (!cookieValue.includes("=")) {
    throw new Error("Set-Cookie header did not contain a cookie pair");
  }
  return cookieValue;
}

async function waitForServerReady(process: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`Server exited before ready.\n${capturedOutput.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: authHeaders(false)
      });
      if (response.status === 200) {
        return;
      }
    } catch {
      // Server has not started listening yet.
    }
    await delay(125);
  }

  throw new Error(`Timed out waiting for server readiness.\n${capturedOutput.join("")}`);
}

async function waitForIpcInitialized(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`Server exited before IPC initialized.\n${capturedOutput.join("")}`);
    }
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    if (response.status === 200) {
      const parsed = HEALTH_SCHEMA.parse(await response.json());
      if (parsed.state.ipcInitialized === true) {
        return;
      }
    }
    await delay(125);
  }

  throw new Error(`Timed out waiting for IPC initialization.\n${capturedOutput.join("")}`);
}

async function stopServerProcess(process: ChildProcessWithoutNullStreams): Promise<void> {
  if (process.exitCode !== null) {
    return;
  }

  const done = new Promise<void>((resolve, reject) => {
    process.once("exit", () => resolve());
    process.once("error", reject);
  });
  process.kill("SIGTERM");

  await Promise.race([
    done,
    (async () => {
      await delay(5_000);
      if (process.exitCode === null) {
        process.kill("SIGKILL");
      }
    })()
  ]);
}

describe("push API auth and subscription routes", () => {
  beforeAll(async () => {
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${String(port)}`;
    stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-push-api-integration-"));
    const statePath = path.join(stateDirectory, "push-state.json");
    receiptsPath = path.join(stateDirectory, "push-receipts.json");
    sendsPath = path.join(stateDirectory, "push-sends.json");
    ipcSocketPath = path.join(stateDirectory, "codex-ipc.sock");
    await startFakeIpcServer(ipcSocketPath);
    const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

    const child = spawn(globalThis.process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: serverRoot,
      env: {
        ...globalThis.process.env,
        HOST: "0.0.0.0",
        PORT: String(port),
        API_TOKEN: TEST_API_TOKEN,
        PUSH_ENABLED: "true",
        PUSH_VAPID_PUBLIC_KEY: TEST_VAPID_PUBLIC_KEY,
        PUSH_VAPID_PRIVATE_KEY: TEST_VAPID_PRIVATE_KEY,
        PUSH_VAPID_SUBJECT: "mailto:integration@example.com",
        PUSH_STATE_PATH: statePath,
        PUSH_RECEIPTS_PATH: receiptsPath,
        PUSH_SENDS_PATH: sendsPath,
        EVENTS_AUTH_SESSION_TTL_MS: "750",
        EVENTS_AUTH_SESSION_MAX: "256",
        CODEX_IPC_SOCKET: ipcSocketPath
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    serverProcess = child;

    child.stdout.on("data", (chunk) => {
      capturedOutput.push(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      capturedOutput.push(chunk.toString());
    });

    await waitForServerReady(child, 20_000);
  }, 30_000);

  afterAll(async () => {
    if (serverProcess) {
      await stopServerProcess(serverProcess);
      serverProcess = null;
    }
    await stopFakeIpcServer();
    if (stateDirectory && fs.existsSync(stateDirectory)) {
      fs.rmSync(stateDirectory, { recursive: true, force: true });
    }
  });

  it("requires auth token for non-loopback /api routes", async () => {
    const unauthenticatedHealth = await fetch(`${baseUrl}/api/health`);
    expect(unauthenticatedHealth.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthenticatedHealth.json());

    const unauthenticatedPushStatus = await fetch(`${baseUrl}/api/push/status`);
    expect(unauthenticatedPushStatus.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthenticatedPushStatus.json());

    const unauthenticatedPushReceiptLatest = await fetch(`${baseUrl}/api/push/receipts/latest`);
    expect(unauthenticatedPushReceiptLatest.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthenticatedPushReceiptLatest.json());

    const unauthenticatedPushSendLatest = await fetch(`${baseUrl}/api/push/sends/latest`);
    expect(unauthenticatedPushSendLatest.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthenticatedPushSendLatest.json());

    const unauthenticatedLocalCaStatus = await fetch(`${baseUrl}/api/push/local-ca`);
    expect(unauthenticatedLocalCaStatus.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthenticatedLocalCaStatus.json());

    const unauthenticatedDebugClientErrors = await fetch(`${baseUrl}/api/debug/client-errors`);
    expect(unauthenticatedDebugClientErrors.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthenticatedDebugClientErrors.json());

    const authenticatedHealth = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(authenticatedHealth.status).toBe(200);
    HEALTH_SCHEMA.parse(await authenticatedHealth.json());
  });

  it("serves /healthz without requiring API auth", async () => {
    const shellHealth = await fetch(`${baseUrl}/healthz`);
    expect(shellHealth.status).toBe(200);
    SHELL_HEALTHZ_SCHEMA.parse(await shellHealth.json());
  });

  it("requires auth token for /events when API auth is configured", async () => {
    const healthBeforeResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthBeforeResponse.status).toBe(200);
    const healthBefore = HEALTH_SCHEMA.parse(await healthBeforeResponse.json());

    const unauthenticatedEvents = await fetch(`${baseUrl}/events`);
    expect(unauthenticatedEvents.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthenticatedEvents.json());

    const authenticatedEvents = await fetch(`${baseUrl}/events`, {
      headers: authHeaders(false)
    });
    expect(authenticatedEvents.status).toBe(200);
    expect(authenticatedEvents.headers.get("content-type")).toContain("text/event-stream");
    await authenticatedEvents.body?.cancel();

    const healthAfterResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthAfterResponse.status).toBe(200);
    const healthAfter = HEALTH_SCHEMA.parse(await healthAfterResponse.json());
    expect(healthAfter.state.eventsAuthRejectsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.eventsAuthRejectsLast5m + 1
    );
  });

  it("supports events auth session bootstrap for SSE", async () => {
    const healthBeforeResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthBeforeResponse.status).toBe(200);
    const healthBefore = HEALTH_SCHEMA.parse(await healthBeforeResponse.json());

    const bootstrap = await fetch(`${baseUrl}/api/events/session`, {
      method: "POST",
      headers: authHeaders(false)
    });
    expect(bootstrap.status).toBe(200);
    const parsedBootstrap = EVENTS_SESSION_BOOTSTRAP_SCHEMA.parse(await bootstrap.json());
    expect(parsedBootstrap.authRequired).toBe(true);
    expect(parsedBootstrap.bootstrapped).toBe(true);
    expect(parsedBootstrap.expiresAt).not.toBeNull();

    const setCookieHeader = bootstrap.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();
    const cookieHeader = parseCookieHeaderFromSetCookie(setCookieHeader ?? "");

    const eventsWithCookie = await fetch(`${baseUrl}/events`, {
      headers: {
        Cookie: cookieHeader
      }
    });
    expect(eventsWithCookie.status).toBe(200);
    expect(eventsWithCookie.headers.get("content-type")).toContain("text/event-stream");
    await eventsWithCookie.body?.cancel();

    const eventsWithInvalidCookie = await fetch(`${baseUrl}/events`, {
      headers: {
        Cookie: "farfield_events_session=invalid"
      }
    });
    expect(eventsWithInvalidCookie.status).toBe(401);
    API_ERROR_SCHEMA.parse(await eventsWithInvalidCookie.json());

    const eventsWithCookieAndCrossOrigin = await fetch(`${baseUrl}/events`, {
      headers: {
        Cookie: cookieHeader,
        Origin: "https://evil.example"
      }
    });
    expect(eventsWithCookieAndCrossOrigin.status).toBe(403);
    API_ERROR_SCHEMA.parse(await eventsWithCookieAndCrossOrigin.json());

    const healthAfterResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthAfterResponse.status).toBe(200);
    const healthAfter = HEALTH_SCHEMA.parse(await healthAfterResponse.json());
    expect(healthAfter.state.eventsSessionBootstrapsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.eventsSessionBootstrapsLast5m + 1
    );
    expect(healthAfter.state.eventsSessionRejectsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.eventsSessionRejectsLast5m + 1
    );
    expect(healthAfter.state.activeEventsSessions).toBeGreaterThanOrEqual(1);
  });

  it("expires events auth sessions and requires re-bootstrap", async () => {
    const bootstrap = await fetch(`${baseUrl}/api/events/session`, {
      method: "POST",
      headers: authHeaders(false)
    });
    expect(bootstrap.status).toBe(200);
    EVENTS_SESSION_BOOTSTRAP_SCHEMA.parse(await bootstrap.json());

    const firstSetCookieHeader = bootstrap.headers.get("set-cookie");
    expect(firstSetCookieHeader).toBeTruthy();
    const firstCookieHeader = parseCookieHeaderFromSetCookie(firstSetCookieHeader ?? "");

    const eventsBeforeExpiry = await fetch(`${baseUrl}/events`, {
      headers: {
        Cookie: firstCookieHeader
      }
    });
    expect(eventsBeforeExpiry.status).toBe(200);
    await eventsBeforeExpiry.body?.cancel();

    await delay(900);

    const eventsAfterExpiry = await fetch(`${baseUrl}/events`, {
      headers: {
        Cookie: firstCookieHeader
      }
    });
    expect(eventsAfterExpiry.status).toBe(401);
    API_ERROR_SCHEMA.parse(await eventsAfterExpiry.json());

    const secondBootstrap = await fetch(`${baseUrl}/api/events/session`, {
      method: "POST",
      headers: authHeaders(false)
    });
    expect(secondBootstrap.status).toBe(200);
    EVENTS_SESSION_BOOTSTRAP_SCHEMA.parse(await secondBootstrap.json());

    const secondSetCookieHeader = secondBootstrap.headers.get("set-cookie");
    expect(secondSetCookieHeader).toBeTruthy();
    const secondCookieHeader = parseCookieHeaderFromSetCookie(secondSetCookieHeader ?? "");
    expect(secondCookieHeader).not.toBe(firstCookieHeader);

    const eventsAfterRebootstrap = await fetch(`${baseUrl}/events`, {
      headers: {
        Cookie: secondCookieHeader
      }
    });
    expect(eventsAfterRebootstrap.status).toBe(200);
    await eventsAfterRebootstrap.body?.cancel();
  });

  it("rejects browser cross-origin requests even with a valid token", async () => {
    const healthBeforeResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthBeforeResponse.status).toBe(200);
    const healthBefore = HEALTH_SCHEMA.parse(await healthBeforeResponse.json());

    const crossOriginApiHealth = await fetch(`${baseUrl}/api/health`, {
      headers: authHeadersWithOrigin("https://evil.example")
    });
    expect(crossOriginApiHealth.status).toBe(403);
    API_ERROR_SCHEMA.parse(await crossOriginApiHealth.json());

    const crossOriginEvents = await fetch(`${baseUrl}/events`, {
      headers: authHeadersWithOrigin("https://evil.example")
    });
    expect(crossOriginEvents.status).toBe(403);
    API_ERROR_SCHEMA.parse(await crossOriginEvents.json());

    const sameOriginEvents = await fetch(`${baseUrl}/events`, {
      headers: authHeadersWithOrigin(baseUrl)
    });
    expect(sameOriginEvents.status).toBe(200);
    expect(sameOriginEvents.headers.get("content-type")).toContain("text/event-stream");
    await sameOriginEvents.body?.cancel();

    const crossOriginReceipt = await fetch(`${baseUrl}/api/push/receipts`, {
      method: "POST",
      headers: authHeadersWithOrigin("https://evil.example", true),
      body: JSON.stringify({
        notificationId: "notif_cross_origin_reject",
        event: "shown",
        url: "/threads/thread_preflight",
        createdAt: "2026-02-19T00:00:00.000Z"
      })
    });
    expect(crossOriginReceipt.status).toBe(403);
    API_ERROR_SCHEMA.parse(await crossOriginReceipt.json());

    const healthAfterResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthAfterResponse.status).toBe(200);
    const healthAfter = HEALTH_SCHEMA.parse(await healthAfterResponse.json());
    expect(healthAfter.state.eventsAuthRejectsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.eventsAuthRejectsLast5m + 1
    );
    expect(healthAfter.state.pushReceiptAuthRejectsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.pushReceiptAuthRejectsLast5m + 1
    );
  });

  it("supports push subscription create/delete with auth", async () => {
    const dryRunBeforeCreate = await fetch(`${baseUrl}/api/push/test`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        threadId: "thread_preflight",
        turnId: "turn_preflight",
        dryRun: true
      })
    });
    expect(dryRunBeforeCreate.status).toBe(200);
    const parsedDryRunBeforeCreate = PUSH_TEST_ENVELOPE_SCHEMA.parse(await dryRunBeforeCreate.json());
    expect(parsedDryRunBeforeCreate.dryRun).toBe(true);
    expect(parsedDryRunBeforeCreate.notificationId).toBeNull();
    expect(parsedDryRunBeforeCreate.ready).toBe(false);
    expect(parsedDryRunBeforeCreate.attempted).toBe(0);

    const createResponse = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        subscription: {
          endpoint: "https://push.example.test/subscriptions/sub_123",
          keys: {
            p256dh: "BElidedKeyMaterial_123",
            auth: "CAuthValue_456"
          }
        },
        settings: {
          privateMode: false
        }
      })
    });
    expect(createResponse.status).toBe(200);
    CREATE_SUBSCRIPTION_ENVELOPE_SCHEMA.parse(await createResponse.json());

    const statusAfterCreate = await fetch(`${baseUrl}/api/push/status`, {
      headers: authHeaders(false)
    });
    expect(statusAfterCreate.status).toBe(200);
    const parsedStatusAfterCreate = PUSH_STATUS_ENVELOPE_SCHEMA.parse(await statusAfterCreate.json());
    expect(parsedStatusAfterCreate.enabled).toBe(true);
    expect(parsedStatusAfterCreate.subscriptionCount).toBe(1);

    const localCaStatusResponse = await fetch(`${baseUrl}/api/push/local-ca`, {
      headers: authHeaders(false)
    });
    expect(localCaStatusResponse.status).toBe(200);
    PUSH_LOCAL_CA_STATUS_ENVELOPE_SCHEMA.parse(await localCaStatusResponse.json());

    const dryRunAfterCreate = await fetch(`${baseUrl}/api/push/test`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        threadId: "thread_preflight",
        turnId: "turn_preflight",
        dryRun: true
      })
    });
    expect(dryRunAfterCreate.status).toBe(200);
    const parsedDryRunAfterCreate = PUSH_TEST_ENVELOPE_SCHEMA.parse(await dryRunAfterCreate.json());
    expect(parsedDryRunAfterCreate.dryRun).toBe(true);
    expect(parsedDryRunAfterCreate.notificationId).toBeNull();
    expect(parsedDryRunAfterCreate.ready).toBe(true);
    expect(parsedDryRunAfterCreate.attempted).toBe(1);

    const pushSendResponse = await fetch(`${baseUrl}/api/push/test`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        threadId: "thread_preflight",
        turnId: "turn_timeline"
      })
    });
    expect(pushSendResponse.status).toBe(200);
    const parsedPushSend = PUSH_TEST_ENVELOPE_SCHEMA.parse(await pushSendResponse.json());
    expect(parsedPushSend.dryRun).toBe(false);
    expect(parsedPushSend.notificationId).not.toBeNull();
    expect(parsedPushSend.attempted).toBeGreaterThanOrEqual(1);

    const latestSendResponse = await fetch(`${baseUrl}/api/push/sends/latest`, {
      headers: authHeaders(false)
    });
    expect(latestSendResponse.status).toBe(200);
    const parsedLatestSend = PUSH_SEND_LATEST_ENVELOPE_SCHEMA.parse(await latestSendResponse.json());
    expect(parsedLatestSend.latest?.notificationId.startsWith("notif_")).toBe(true);
    expect(parsedLatestSend.latest?.notificationId).toBe(parsedPushSend.notificationId);
    expect(parsedLatestSend.latest?.threadId).toBe("thread_preflight");
    expect(parsedLatestSend.latest?.turnId).toBe("turn_timeline");
    expect(parsedLatestSend.latest?.attempted).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(sendsPath)).toBe(true);
    const sendFileContent = fs.readFileSync(sendsPath, "utf8");
    expect(sendFileContent).toContain("\"latest\"");
    expect(sendFileContent).toContain(String(parsedPushSend.notificationId));

    const createReceiptResponse = await fetch(`${baseUrl}/api/push/receipts`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        notificationId: "notif_test_1",
        event: "shown",
        url: "/threads/thread_preflight",
        threadId: "thread_preflight",
        turnId: "turn_preflight",
        createdAt: "2026-02-18T00:00:00.000Z"
      })
    });
    expect(createReceiptResponse.status).toBe(200);
    PUSH_RECEIPT_CREATE_ENVELOPE_SCHEMA.parse(await createReceiptResponse.json());

    const latestReceiptResponse = await fetch(`${baseUrl}/api/push/receipts/latest`, {
      headers: authHeaders(false)
    });
    expect(latestReceiptResponse.status).toBe(200);
    const parsedLatestReceipt = PUSH_RECEIPT_LATEST_ENVELOPE_SCHEMA.parse(
      await latestReceiptResponse.json()
    );
    expect(parsedLatestReceipt.count).toBe(1);
    expect(parsedLatestReceipt.latest?.notificationId).toBe("notif_test_1");
    expect(parsedLatestReceipt.latest?.event).toBe("shown");
    expect(parsedLatestReceipt.latest?.threadId).toBe("thread_preflight");
    expect(fs.existsSync(receiptsPath)).toBe(true);
    const receiptFileContent = fs.readFileSync(receiptsPath, "utf8");
    expect(receiptFileContent).toContain("\"receipts\"");
    expect(receiptFileContent).toContain("\"event\": \"shown\"");

    const deleteResponse = await fetch(`${baseUrl}/api/push/subscriptions`, {
      method: "DELETE",
      headers: authHeaders(true),
      body: JSON.stringify({
        endpoint: "https://push.example.test/subscriptions/sub_123"
      })
    });
    expect(deleteResponse.status).toBe(200);
    const parsedDeleteResponse = DELETE_SUBSCRIPTION_ENVELOPE_SCHEMA.parse(await deleteResponse.json());
    expect(parsedDeleteResponse.deleted).toBe(true);

    const statusAfterDelete = await fetch(`${baseUrl}/api/push/status`, {
      headers: authHeaders(false)
    });
    expect(statusAfterDelete.status).toBe(200);
    const parsedStatusAfterDelete = PUSH_STATUS_ENVELOPE_SCHEMA.parse(await statusAfterDelete.json());
    expect(parsedStatusAfterDelete.subscriptionCount).toBe(0);
  });

  it("tracks push receipt auth rejects and invalid payload counters", async () => {
    const healthBeforeResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthBeforeResponse.status).toBe(200);
    const healthBefore = HEALTH_SCHEMA.parse(await healthBeforeResponse.json());

    const unauthorizedReceiptResponse = await fetch(`${baseUrl}/api/push/receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        notificationId: "notif_unauthorized_receipt",
        event: "shown",
        url: "/threads/thread_preflight",
        createdAt: "2026-02-18T00:00:00.000Z"
      })
    });
    expect(unauthorizedReceiptResponse.status).toBe(401);
    API_ERROR_SCHEMA.parse(await unauthorizedReceiptResponse.json());

    const invalidPayloadReceiptResponse = await fetch(`${baseUrl}/api/push/receipts`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        notificationId: "notif_invalid_payload",
        event: "error",
        url: "/threads/thread_preflight",
        threadId: "thread_preflight",
        turnId: "turn_preflight",
        message: "Push payload validation failed: malformed payload shape",
        createdAt: "2026-02-18T00:00:00.000Z"
      })
    });
    expect(invalidPayloadReceiptResponse.status).toBe(200);
    PUSH_RECEIPT_CREATE_ENVELOPE_SCHEMA.parse(await invalidPayloadReceiptResponse.json());

    const healthAfterResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthAfterResponse.status).toBe(200);
    const healthAfter = HEALTH_SCHEMA.parse(await healthAfterResponse.json());
    expect(healthAfter.state.pushReceiptAuthRejectsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.pushReceiptAuthRejectsLast5m + 1
    );
    expect(healthAfter.state.invalidPushPayloadsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.invalidPushPayloadsLast5m + 1
    );
  });

  it("records and serves debug client errors with auth", async () => {
    const healthBeforeResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthBeforeResponse.status).toBe(200);
    const healthBefore = HEALTH_SCHEMA.parse(await healthBeforeResponse.json());

    const clientErrorPayload = {
      source: "web-app",
      operation: "push:auto-heal",
      message: "The string did not match the expected pattern.",
      requestId: "req_test_1",
      threadId: "thread_test_1",
      url: "/threads/thread_test_1",
      details: {
        tab: "chat"
      }
    };

    const createResponse = await fetch(`${baseUrl}/api/debug/client-errors`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(clientErrorPayload)
    });
    expect(createResponse.status).toBe(200);
    const parsedCreate = DEBUG_ERROR_CREATE_ENVELOPE_SCHEMA.parse(await createResponse.json());
    expect(parsedCreate.errorId.startsWith("error_")).toBe(true);
    expect(parsedCreate.sessionId.startsWith("session_")).toBe(true);

    const duplicateCreateResponse = await fetch(`${baseUrl}/api/debug/client-errors`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(clientErrorPayload)
    });
    expect(duplicateCreateResponse.status).toBe(200);
    const parsedDuplicateCreate = DEBUG_ERROR_CREATE_ENVELOPE_SCHEMA.parse(
      await duplicateCreateResponse.json()
    );
    expect(parsedDuplicateCreate.errorId).toBe(parsedCreate.errorId);
    expect(parsedDuplicateCreate.sessionId).toBe(parsedCreate.sessionId);

    const listResponse = await fetch(`${baseUrl}/api/debug/client-errors?limit=20`, {
      headers: authHeaders(false)
    });
    expect(listResponse.status).toBe(200);
    const parsedList = DEBUG_ERROR_LIST_ENVELOPE_SCHEMA.parse(await listResponse.json());
    expect(parsedList.data.length).toBeGreaterThan(0);

    const matched = parsedList.data.find((entry) => entry.errorId === parsedCreate.errorId);
    expect(matched?.operation).toBe("push:auto-heal");
    expect(matched?.origin).toBe("client");
    expect(matched?.requestId).toBe("req_test_1");

    const detailResponse = await fetch(
      `${baseUrl}/api/debug/client-errors/${encodeURIComponent(parsedCreate.errorId)}`,
      {
        headers: authHeaders(false)
      }
    );
    expect(detailResponse.status).toBe(200);
    const parsedDetail = DEBUG_ERROR_DETAIL_ENVELOPE_SCHEMA.parse(await detailResponse.json());
    expect(parsedDetail.error.errorId).toBe(parsedCreate.errorId);
    expect(parsedDetail.error.threadId).toBe("thread_test_1");
    expect(parsedDetail.sessionId).toBe(parsedCreate.sessionId);
    expect(parsedDetail.sessionLogPath).toContain(".runtime/logs/errors");
    expect(fs.existsSync(parsedDetail.sessionLogPath)).toBe(true);

    const sessionLogDownload = await fetch(`${baseUrl}/api/debug/client-errors/session-log`, {
      headers: authHeaders(false)
    });
    expect(sessionLogDownload.status).toBe(200);
    const downloadedLog = await sessionLogDownload.text();
    expect(downloadedLog).toContain(parsedCreate.errorId);
    expect(downloadedLog).toContain("\"origin\":\"client\"");

    const healthAfterResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthAfterResponse.status).toBe(200);
    const healthAfter = HEALTH_SCHEMA.parse(await healthAfterResponse.json());
    expect(healthAfter.state.suppressedClientErrorReportsLast5m).toBeGreaterThanOrEqual(
      healthBefore.state.suppressedClientErrorReportsLast5m + 1
    );
  });

  it("reduces json-pointer single-patch thread stream broadcasts without invalid warnings", async () => {
    await waitForIpcInitialized(20_000);

    const outputStart = capturedOutput.length;
    const healthBeforeResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthBeforeResponse.status).toBe(200);
    const healthBefore = HEALTH_SCHEMA.parse(await healthBeforeResponse.json());

    const threadId = "thread_stream_json_pointer";

    sendFakeIpcFrame({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "fake-ipc-client",
      version: 4,
      params: {
        conversationId: threadId,
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: threadId,
            turns: [],
            requests: []
          }
        }
      }
    });

    sendFakeIpcFrame({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "fake-ipc-client",
      version: 4,
      params: {
        conversationId: threadId,
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "patches",
          patches: {
            op: "add",
            path: "/turns/-",
            value: {
              params: {
                threadId,
                input: [{ type: "text", text: "hello" }],
                attachments: []
              },
              status: "completed",
              items: []
            }
          }
        }
      }
    });

    await delay(300);

    const liveStateResponse = await fetch(`${baseUrl}/api/threads/${encodeURIComponent(threadId)}/live-state`, {
      headers: authHeaders(false)
    });
    expect(liveStateResponse.status).toBe(200);
    const parsedLiveState = LIVE_STATE_SCHEMA.parse(await liveStateResponse.json());
    expect(parsedLiveState.threadId).toBe(threadId);
    expect(parsedLiveState.conversationState?.turns.length).toBe(1);
    expect(parsedLiveState.conversationState?.turns[0]?.status).toBe("completed");

    const healthAfterResponse = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(healthAfterResponse.status).toBe(200);
    const healthAfter = HEALTH_SCHEMA.parse(await healthAfterResponse.json());
    expect(healthAfter.state.invalidThreadStreamEventsLast5m).toBe(
      healthBefore.state.invalidThreadStreamEventsLast5m
    );

    const outputAfter = capturedOutput.slice(outputStart).join("");
    expect(outputAfter).not.toContain("invalid-thread-stream-event");
  });

  it("allows non-loopback /api routes when API_TOKEN is unset", async () => {
    const port = await reservePort();
    const localBaseUrl = `http://127.0.0.1:${String(port)}`;
    const localStateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-push-api-no-auth-"));
    const localStatePath = path.join(localStateDirectory, "push-state.json");
    const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const localOutput: string[] = [];

    const child = spawn(globalThis.process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: serverRoot,
      env: {
        ...globalThis.process.env,
        HOST: "0.0.0.0",
        PORT: String(port),
        PUSH_ENABLED: "false",
        PUSH_STATE_PATH: localStatePath,
        API_TOKEN: "",
        PUSH_API_TOKEN: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      localOutput.push(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      localOutput.push(chunk.toString());
    });

    try {
      const deadline = Date.now() + 20_000;
      let ready = false;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(`Server exited before ready.\n${localOutput.join("")}`);
        }
        try {
          const response = await fetch(`${localBaseUrl}/api/health`);
          if (response.status === 200) {
            ready = true;
            break;
          }
        } catch {
          // Server has not started listening yet.
        }
        await delay(125);
      }
      if (!ready) {
        throw new Error(`Timed out waiting for server readiness.\n${localOutput.join("")}`);
      }

      const health = await fetch(`${localBaseUrl}/api/health`);
      expect(health.status).toBe(200);
      HEALTH_SCHEMA.parse(await health.json());

      const pushStatus = await fetch(`${localBaseUrl}/api/push/status`);
      expect(pushStatus.status).toBe(200);
      const parsedPushStatus = PUSH_STATUS_ENVELOPE_SCHEMA.parse(await pushStatus.json());
      expect(parsedPushStatus.enabled).toBe(false);
    } finally {
      await stopServerProcess(child);
      if (fs.existsSync(localStateDirectory)) {
        fs.rmSync(localStateDirectory, { recursive: true, force: true });
      }
    }
  }, 30_000);
});
