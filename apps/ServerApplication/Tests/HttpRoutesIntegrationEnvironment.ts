import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  FarfieldApiErrorResponseSchema,
  FarfieldCreatePushSubscriptionEnvelopeSchema,
  FarfieldDebugErrorCreateEnvelopeSchema,
  FarfieldDebugErrorDetailEnvelopeSchema,
  FarfieldDebugErrorListEnvelopeSchema,
  FarfieldDebugObservabilityEnvelopeSchema,
  FarfieldEventsSessionResponseSchema,
  FarfieldHealthResponseSchema,
  FarfieldPushLocalCaStatusEnvelopeSchema,
  FarfieldPushReceiptCreateEnvelopeSchema,
  FarfieldPushReceiptLatestEnvelopeSchema,
  FarfieldPushStatusEnvelopeSchema,
  FarfieldPushTestEnvelopeSchema,
  FarfieldPushVapidPublicKeyEnvelopeSchema
} from "@farfield/protocol";
import { z } from "zod";

export const ApiErrorEnvelopeSchema = FarfieldApiErrorResponseSchema;
export const HealthEnvelopeSchema = FarfieldHealthResponseSchema;
export const EventsSessionEnvelopeSchema = FarfieldEventsSessionResponseSchema;
export const PushStatusEnvelopeSchema = FarfieldPushStatusEnvelopeSchema;
export const VapidPublicKeyEnvelopeSchema = FarfieldPushVapidPublicKeyEnvelopeSchema;
export const CreatePushSubscriptionEnvelopeSchema = FarfieldCreatePushSubscriptionEnvelopeSchema;
export const PushTestEnvelopeSchema = FarfieldPushTestEnvelopeSchema;
export const PushReceiptCreateEnvelopeSchema = FarfieldPushReceiptCreateEnvelopeSchema;
export const PushReceiptLatestEnvelopeSchema = FarfieldPushReceiptLatestEnvelopeSchema;
export const PushLocalCaStatusEnvelopeSchema = FarfieldPushLocalCaStatusEnvelopeSchema;
export const DebugErrorCreateEnvelopeSchema = FarfieldDebugErrorCreateEnvelopeSchema;
export const DebugErrorListEnvelopeSchema = FarfieldDebugErrorListEnvelopeSchema;
export const DebugErrorDetailEnvelopeSchema = FarfieldDebugErrorDetailEnvelopeSchema;
export const DebugObservabilityEnvelopeSchema = FarfieldDebugObservabilityEnvelopeSchema;

const AddressSchema = z
  .object({
    address: z.string(),
    family: z.union([z.literal("IPv4"), z.literal("IPv6")]),
    port: z.number().int().positive()
  })
  .strict();

const InheritedServerProcessEnvironmentSchema = z
  .object({
    PATH: z.string().optional(),
    HOME: z.string().optional(),
    USER: z.string().optional(),
    LOGNAME: z.string().optional(),
    SHELL: z.string().optional(),
    TMPDIR: z.string().optional(),
    TMP: z.string().optional(),
    TEMP: z.string().optional(),
    SYSTEMROOT: z.string().optional(),
    SYSTEMDRIVE: z.string().optional(),
    COMSPEC: z.string().optional(),
    PATHEXT: z.string().optional(),
    WINDIR: z.string().optional(),
    APPDATA: z.string().optional(),
    LOCALAPPDATA: z.string().optional(),
    NO_COLOR: z.string().optional(),
    FORCE_COLOR: z.string().optional(),
    CI: z.string().optional()
  })
  .strict();

function buildInheritedServerProcessEnvironment(
  sourceEnvironment: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  return InheritedServerProcessEnvironmentSchema.parse({
    PATH: sourceEnvironment["PATH"],
    HOME: sourceEnvironment["HOME"],
    USER: sourceEnvironment["USER"],
    LOGNAME: sourceEnvironment["LOGNAME"],
    SHELL: sourceEnvironment["SHELL"],
    TMPDIR: sourceEnvironment["TMPDIR"],
    TMP: sourceEnvironment["TMP"],
    TEMP: sourceEnvironment["TEMP"],
    SYSTEMROOT: sourceEnvironment["SYSTEMROOT"],
    SYSTEMDRIVE: sourceEnvironment["SYSTEMDRIVE"],
    COMSPEC: sourceEnvironment["COMSPEC"],
    PATHEXT: sourceEnvironment["PATHEXT"],
    WINDIR: sourceEnvironment["WINDIR"],
    APPDATA: sourceEnvironment["APPDATA"],
    LOCALAPPDATA: sourceEnvironment["LOCALAPPDATA"],
    NO_COLOR: sourceEnvironment["NO_COLOR"],
    FORCE_COLOR: sourceEnvironment["FORCE_COLOR"],
    CI: sourceEnvironment["CI"]
  });
}

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
      // Server is still starting.
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error(`Timed out waiting for server readiness at ${baseUrl}`);
}

/**
 * Owns lifecycle and typed access helpers for route integration tests.
 * Each test suite starts a dedicated isolated server process with temporary state paths.
 */
export class HttpRoutesIntegrationEnvironment {
  private readonly apiToken = "integration_test_token";
  private readonly vapidPublicKey =
    "BPItc9n5cEBFiYtrIgv4iMahikEkQeXwdD4Q9MTDmTrU4Ty-pj1_XqHdL0pF-RQVUKS_k7_C5P_rXX6crzWkL2U";
  private readonly vapidPrivateKey = "tfyAO9n9LMLXTy7ZaZwfDafDifFhnKz0MLC8nOxDmds";
  private readonly vapidSubject = "mailto:integration@example.com";

  private serverProcess: ChildProcessWithoutNullStreams | null = null;
  private serverLogs = "";
  private tempDirectory = "";
  private baseUrl = "";

  public readApiToken(): string {
    return this.apiToken;
  }

  public readVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  public readBaseUrl(): string {
    if (this.baseUrl.length === 0) {
      throw new Error("Integration environment base URL is not available before start()");
    }
    return this.baseUrl;
  }

  public readAuthHeaders(): Record<string, string> {
    return {
      "X-Farfield-Token": this.apiToken
    };
  }

  public async start(): Promise<void> {
    const port = await getAvailablePort();
    this.baseUrl = `http://127.0.0.1:${String(port)}`;
    this.tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-server-integration-"));
    const localCaPath = path.join(this.tempDirectory, "root.crt");
    fs.writeFileSync(localCaPath, "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n", "utf8");

    const serverEntryPath = path.resolve(
      process.cwd(),
      "Source",
      "Application",
      "ServerBootstrap.ts"
    );
    this.serverProcess = spawn(
      process.execPath,
      ["--import", "tsx", serverEntryPath, "--agents=codex"],
      {
        cwd: process.cwd(),
        env: {
          ...buildInheritedServerProcessEnvironment(process.env),
          HOST: "127.0.0.1",
          PORT: String(port),
          API_TOKEN: this.apiToken,
          PUSH_ENABLED: "true",
          PUSH_VAPID_PUBLIC_KEY: this.vapidPublicKey,
          PUSH_VAPID_PRIVATE_KEY: this.vapidPrivateKey,
          PUSH_VAPID_SUBJECT: this.vapidSubject,
          PUSH_STATE_PATH: path.join(this.tempDirectory, "push-state.json"),
          PUSH_RECEIPTS_PATH: path.join(this.tempDirectory, "push-receipts.json"),
          PUSH_SENDS_PATH: path.join(this.tempDirectory, "push-sends.json"),
          PUSH_LOCAL_CA_PATH: localCaPath,
          DEBUG_CLIENT_ERROR_LOG_PATH: path.join(this.tempDirectory, "client-errors.ndjson")
        },
        stdio: "pipe"
      }
    );

    this.serverProcess.stdout.on("data", (chunk: Buffer) => {
      this.serverLogs += chunk.toString("utf8");
    });
    this.serverProcess.stderr.on("data", (chunk: Buffer) => {
      this.serverLogs += chunk.toString("utf8");
    });

    try {
      await waitForServerReady(this.baseUrl, this.apiToken, 10_000);
    } catch (error) {
      throw new Error(
        `Server failed to become ready: ${error instanceof Error ? error.message : String(error)}\n${this.serverLogs}`
      );
    }
  }

  public async stop(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        this.serverProcess?.once("exit", () => resolve());
      });
      this.serverProcess = null;
    }

    if (this.tempDirectory.length > 0 && fs.existsSync(this.tempDirectory)) {
      fs.rmSync(this.tempDirectory, { recursive: true, force: true });
    }
  }
}
