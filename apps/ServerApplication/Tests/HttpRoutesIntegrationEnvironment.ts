import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FarfieldApiErrorResponseSchema,
  FarfieldCreatePushSubscriptionEnvelopeSchema,
  FarfieldDebugErrorClearEnvelopeSchema,
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
  FarfieldPushVapidPublicKeyEnvelopeSchema,
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
export const DebugErrorClearEnvelopeSchema = FarfieldDebugErrorClearEnvelopeSchema;
export const DebugErrorListEnvelopeSchema = FarfieldDebugErrorListEnvelopeSchema;
export const DebugErrorDetailEnvelopeSchema = FarfieldDebugErrorDetailEnvelopeSchema;
export const DebugObservabilityEnvelopeSchema = FarfieldDebugObservabilityEnvelopeSchema;

const SERVER_HOST = "127.0.0.1";
const SERVER_STARTUP_TIMEOUT_MILLISECONDS = 10_000;
const SERVER_READINESS_POLL_INTERVAL_MILLISECONDS = 100;
const SERVER_STOP_TIMEOUT_MILLISECONDS = 5_000;
const API_ROUTE_PATH_PATTERN = /^\/api(?:\/|$)/;
const API_TOKEN_HEADER_NAME = "X-Farfield-Token";
const SET_COOKIE_HEADER_NAME = "set-cookie";
const SESSION_COOKIE_HEADER_PATTERN = /\bfarfield_session=/;

const ServerApplicationDirectoryPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const ServerBootstrapEntryPath = path.join(
  ServerApplicationDirectoryPath,
  "Source",
  "Application",
  "ServerBootstrap.ts",
);

const AddressSchema = z
  .object({
    address: z.string(),
    family: z.union([z.literal("IPv4"), z.literal("IPv6")]),
    port: z.number().int().positive(),
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
    CI: z.string().optional(),
  })
  .strict();

const ApiRoutePathSchema = z
  .string()
  .regex(API_ROUTE_PATH_PATTERN, "Expected API route path beginning with /api");

const SetCookieHeaderSchema = z
  .string({
    invalid_type_error: "Expected response set-cookie header to be present",
    required_error: "Expected response set-cookie header to be present",
  })
  .min(1)
  .regex(
    SESSION_COOKIE_HEADER_PATTERN,
    "Expected response set-cookie header to include farfield_session cookie",
  );

function buildInheritedServerProcessEnvironment(
  sourceEnvironment: NodeJS.ProcessEnv,
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
    CI: sourceEnvironment["CI"],
  });
}

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, SERVER_HOST, () => {
      try {
        const parsedAddress = AddressSchema.parse(server.address());
        const port = parsedAddress.port;
        server.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve(port);
        });
      } catch (error) {
        server.close(() => {
          reject(error);
        });
      }
    });
  });
}

function hasServerProcessExited(serverProcess: ChildProcessWithoutNullStreams): boolean {
  return serverProcess.exitCode !== null || serverProcess.signalCode !== null;
}

async function waitForServerReady(
  baseUrl: string,
  token: string,
  timeoutMs: number,
  serverProcess: ChildProcessWithoutNullStreams,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (hasServerProcessExited(serverProcess)) {
      throw new Error(
        `Server process exited before readiness check completed (exitCode=${String(serverProcess.exitCode)}, signal=${String(serverProcess.signalCode)})`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
        headers: {
          [API_TOKEN_HEADER_NAME]: token,
        },
      });
      if (response.status === 200) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, SERVER_READINESS_POLL_INTERVAL_MILLISECONDS);
    });
  }

  throw new Error(`Timed out waiting for server readiness at ${baseUrl}`);
}

async function waitForServerProcessExit(
  serverProcess: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<void> {
  if (hasServerProcessExited(serverProcess)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let timeoutHandle: NodeJS.Timeout | null = null;
    const handleExit = (): void => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve();
    };

    timeoutHandle = setTimeout(() => {
      serverProcess.off("exit", handleExit);
      reject(
        new Error(
          `Timed out waiting for server process to exit (exitCode=${String(serverProcess.exitCode)}, signal=${String(serverProcess.signalCode)})`,
        ),
      );
    }, timeoutMs);

    serverProcess.once("exit", handleExit);
    if (hasServerProcessExited(serverProcess)) {
      serverProcess.off("exit", handleExit);
      handleExit();
    }
  });
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

  public buildApiRouteUrl(pathname: string): string {
    const parsedPathname = ApiRoutePathSchema.parse(pathname);
    return `${this.readBaseUrl()}${parsedPathname}`;
  }

  public readSessionCookieFromResponse(response: Response): string {
    return SetCookieHeaderSchema.parse(response.headers.get(SET_COOKIE_HEADER_NAME));
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
      [API_TOKEN_HEADER_NAME]: this.apiToken,
    };
  }

  public async start(): Promise<void> {
    if (this.serverProcess !== null) {
      throw new Error(
        "Integration environment start() called while server process is already running",
      );
    }

    this.serverLogs = "";

    const port = await getAvailablePort();
    this.baseUrl = `http://${SERVER_HOST}:${String(port)}`;
    this.tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-server-integration-"));
    const localCaPath = path.join(this.tempDirectory, "root.crt");
    fs.writeFileSync(
      localCaPath,
      "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n",
      "utf8",
    );

    this.serverProcess = spawn(
      process.execPath,
      ["--import", "tsx", ServerBootstrapEntryPath, "--agents=codex"],
      {
        cwd: ServerApplicationDirectoryPath,
        env: {
          ...buildInheritedServerProcessEnvironment(process.env),
          HOST: SERVER_HOST,
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
          DEBUG_CLIENT_ERROR_LOG_PATH: path.join(this.tempDirectory, "client-errors.ndjson"),
        },
        stdio: "pipe",
      },
    );

    this.serverProcess.stdout.on("data", (chunk: Buffer) => {
      this.serverLogs += chunk.toString("utf8");
    });
    this.serverProcess.stderr.on("data", (chunk: Buffer) => {
      this.serverLogs += chunk.toString("utf8");
    });

    try {
      await waitForServerReady(
        this.baseUrl,
        this.apiToken,
        SERVER_STARTUP_TIMEOUT_MILLISECONDS,
        this.serverProcess,
      );
    } catch (error) {
      const startupErrorMessage = error instanceof Error ? error.message : String(error);
      try {
        await this.stop();
      } catch {
        // Preserve startup failure details even if shutdown fails.
      }
      throw new Error(`Server failed to become ready: ${startupErrorMessage}\n${this.serverLogs}`);
    }
  }

  public async stop(): Promise<void> {
    const activeServerProcess = this.serverProcess;
    this.serverProcess = null;

    if (activeServerProcess) {
      if (!hasServerProcessExited(activeServerProcess)) {
        activeServerProcess.kill("SIGTERM");
        await waitForServerProcessExit(activeServerProcess, SERVER_STOP_TIMEOUT_MILLISECONDS);
      }
    }

    if (this.tempDirectory.length > 0 && fs.existsSync(this.tempDirectory)) {
      fs.rmSync(this.tempDirectory, { recursive: true, force: true });
    }
    this.tempDirectory = "";
    this.baseUrl = "";
  }
}
