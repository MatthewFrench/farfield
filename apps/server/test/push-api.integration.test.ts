import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CreatePushSubscriptionResponseSchema,
  DeletePushSubscriptionResponseSchema,
  PushStatusResponseSchema
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
        pushSubscriptionCount: z.number().int().nonnegative()
      })
      .passthrough()
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
    ready: z.boolean(),
    reason: z.string(),
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative()
  })
  .strict();

const TEST_API_TOKEN = "integration-test-token";
const TEST_VAPID_PUBLIC_KEY =
  "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U";
const TEST_VAPID_PRIVATE_KEY = "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds";

let serverProcess: ChildProcessWithoutNullStreams | null = null;
let baseUrl = "";
let stateDirectory = "";
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

function authHeaders(includeJsonContentType = false): HeadersInit {
  const headers: Record<string, string> = {
    "X-Farfield-Token": TEST_API_TOKEN
  };
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
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
        PUSH_STATE_PATH: statePath
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

    const authenticatedHealth = await fetch(`${baseUrl}/api/health`, {
      headers: authHeaders(false)
    });
    expect(authenticatedHealth.status).toBe(200);
    HEALTH_SCHEMA.parse(await authenticatedHealth.json());
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
    expect(parsedDryRunAfterCreate.ready).toBe(true);
    expect(parsedDryRunAfterCreate.attempted).toBe(1);

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
        PUSH_STATE_PATH: localStatePath
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
  });
});
