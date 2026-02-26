import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { JsonValueSchema, type JsonValue } from "@farfield/protocol";
import {
  AppServerRpcError,
  AppServerTransportError
} from "./Errors.js";
import { JsonRpcRequestSchema, parseJsonRpcIncomingMessage } from "./JsonRpc.js";

export interface AppServerTransport {
  request(method: string, params: object, timeoutMs?: number): Promise<JsonValue>;
  close(): Promise<void>;
}

interface PendingRequest {
  timer: NodeJS.Timeout;
  resolve: (value: JsonValue) => void;
  reject: (error: Error) => void;
}

const APP_SERVER_COMMAND = "app-server";
const APP_SERVER_CLIENT_NAME = "farfield";
const APP_SERVER_CLIENT_VERSION = "0.2.0";
const APP_SERVER_INITIALIZE_METHOD = "initialize";
const APP_SERVER_JSON_RPC_VERSION = "2.0";
const DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS = 30_000;

const ProcessEnvironmentSchema = z.record(z.string(), z.string().optional());
const InitializeResultSchema = z.object({}).passthrough();
const AppServerSpawnEnvironmentShape = {
  HOME: z.string().min(1).optional(),
  PATH: z.string().min(1).optional(),
  SHELL: z.string().min(1).optional(),
  USER: z.string().min(1).optional(),
  USERNAME: z.string().min(1).optional(),
  TMPDIR: z.string().min(1).optional(),
  TMP: z.string().min(1).optional(),
  TEMP: z.string().min(1).optional(),
  LANG: z.string().min(1).optional(),
  LC_ALL: z.string().min(1).optional(),
  TERM: z.string().min(1).optional(),
  TZ: z.string().min(1).optional(),
  SSL_CERT_FILE: z.string().min(1).optional(),
  SSL_CERT_DIR: z.string().min(1).optional(),
  NODE_EXTRA_CA_CERTS: z.string().min(1).optional(),
  HTTP_PROXY: z.string().min(1).optional(),
  HTTPS_PROXY: z.string().min(1).optional(),
  NO_PROXY: z.string().min(1).optional(),
  ALL_PROXY: z.string().min(1).optional(),
  CODEX_HOME: z.string().min(1).optional(),
  XDG_CONFIG_HOME: z.string().min(1).optional(),
  XDG_CACHE_HOME: z.string().min(1).optional(),
  APPDATA: z.string().min(1).optional(),
  LOCALAPPDATA: z.string().min(1).optional(),
  USERPROFILE: z.string().min(1).optional(),
  SystemRoot: z.string().min(1).optional(),
  ComSpec: z.string().min(1).optional()
} as const;
const AppServerSpawnInheritedEnvironmentSchema = z.object(AppServerSpawnEnvironmentShape).strip();
const AppServerSpawnOverrideEnvironmentSchema = z.object(AppServerSpawnEnvironmentShape).strict();

export interface BuildAppServerSpawnEnvironmentInput {
  baseEnvironment: NodeJS.ProcessEnv;
  overrideEnvironment?: NodeJS.ProcessEnv;
  userAgent: string;
  clientId: string;
}

/**
 * Owns the exact environment contract used to spawn `codex app-server`.
 * Only allowlisted keys may cross the process boundary so configuration remains explicit and reviewable.
 */
export function buildAppServerSpawnEnvironment(input: BuildAppServerSpawnEnvironmentInput): NodeJS.ProcessEnv {
  const inheritedEnvironment = AppServerSpawnInheritedEnvironmentSchema.parse(input.baseEnvironment);
  const overrideEnvironment = AppServerSpawnOverrideEnvironmentSchema.parse(input.overrideEnvironment ?? {});

  return {
    ...inheritedEnvironment,
    ...overrideEnvironment,
    CODEX_USER_AGENT: input.userAgent,
    CODEX_CLIENT_ID: input.clientId
  };
}

export interface ChildProcessAppServerTransportOptions {
  executablePath: string;
  userAgent: string;
  baseEnvironment: NodeJS.ProcessEnv;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  requestTimeoutMs?: number;
  onStderr?: (line: string) => void;
}

const ChildProcessAppServerTransportOptionsSchema = z
  .object({
    executablePath: z.string().min(1),
    userAgent: z.string().min(1),
    baseEnvironment: ProcessEnvironmentSchema,
    cwd: z.string().min(1).optional(),
    env: ProcessEnvironmentSchema.optional(),
    requestTimeoutMs: z.number().int().positive().optional(),
    onStderr: z.function().args(z.string()).returns(z.void()).optional()
  })
  .strict();

function toErrorMessage<ValueType>(value: ValueType): string {
  if (value instanceof Error) {
    return value.message;
  }

  return String(value);
}

export function isChildProcessAppServerTransportOptions(
  value: AppServerTransport | ChildProcessAppServerTransportOptions
): value is ChildProcessAppServerTransportOptions {
  return ChildProcessAppServerTransportOptionsSchema.safeParse(value).success;
}

export class ChildProcessAppServerTransport implements AppServerTransport {
  private readonly executablePath: string;
  private readonly userAgent: string;
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private readonly cwd: string | undefined;
  private readonly env: NodeJS.ProcessEnv | undefined;
  private readonly requestTimeoutMs: number;
  private readonly onStderr: ((line: string) => void) | undefined;
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<number, PendingRequest>();
  private requestId = 0;
  private initialized = false;
  private initializeInFlight: Promise<void> | null = null;

  public constructor(options: ChildProcessAppServerTransportOptions) {
    const parsedOptions = ChildProcessAppServerTransportOptionsSchema.parse(options);
    this.executablePath = parsedOptions.executablePath;
    this.userAgent = parsedOptions.userAgent;
    this.baseEnvironment = parsedOptions.baseEnvironment;
    this.cwd = parsedOptions.cwd;
    this.env = parsedOptions.env;
    this.requestTimeoutMs = parsedOptions.requestTimeoutMs ?? DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS;
    this.onStderr = parsedOptions.onStderr;
  }

  private resetProcessState(): void {
    this.process = null;
    this.initialized = false;
    this.initializeInFlight = null;
  }

  private ensureStarted(): void {
    if (this.process) {
      return;
    }

    const clientIdentifier = `farfield-${randomUUID()}`;
    let spawnEnvironment: NodeJS.ProcessEnv;
    try {
      const spawnEnvironmentInput: BuildAppServerSpawnEnvironmentInput = {
        baseEnvironment: this.baseEnvironment,
        userAgent: this.userAgent,
        clientId: clientIdentifier
      };
      if (this.env) {
        spawnEnvironmentInput.overrideEnvironment = this.env;
      }
      spawnEnvironment = buildAppServerSpawnEnvironment(spawnEnvironmentInput);
    } catch (error) {
      throw new AppServerTransportError(
        `app-server environment configuration invalid: ${toErrorMessage(error)}`
      );
    }

    const child = spawn(this.executablePath, [APP_SERVER_COMMAND], {
      cwd: this.cwd,
      env: spawnEnvironment,
      stdio: ["pipe", "pipe", "pipe"]
    });

    child.on("exit", (code, signal) => {
      const reason = `app-server exited (code=${String(code)}, signal=${String(signal)})`;
      this.rejectAll(new AppServerTransportError(reason));
      this.resetProcessState();
    });

    child.on("error", (error) => {
      this.rejectAll(new AppServerTransportError(`app-server process error: ${error.message}`));
      this.resetProcessState();
    });

    const lineReader = readline.createInterface({ input: child.stdout });
    lineReader.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      let raw: JsonValue;
      try {
        raw = JsonValueSchema.parse(JSON.parse(trimmed));
      } catch {
        this.rejectAll(new AppServerTransportError("app-server returned invalid JSON"));
        return;
      }

      let message;
      try {
        message = parseJsonRpcIncomingMessage(raw);
      } catch (error) {
        this.rejectAll(
          new AppServerTransportError(
            `app-server response schema mismatch: ${toErrorMessage(error)}`
          )
        );
        return;
      }

      if (message.kind === "notification") {
        return;
      }

      const pending = this.pending.get(message.value.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.value.id);
      clearTimeout(pending.timer);

      if (message.value.error) {
        pending.reject(
          new AppServerRpcError(
            message.value.error.code,
            message.value.error.message,
            message.value.error.data
          )
        );
        return;
      }

      if (message.value.result === undefined) {
        pending.reject(
          new AppServerTransportError(
            `app-server response missing result for request id ${String(message.value.id)}`
          )
        );
        return;
      }

      pending.resolve(message.value.result);
    });

    const stderrReader = readline.createInterface({ input: child.stderr });
    stderrReader.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      try {
        this.onStderr?.(trimmed);
      } catch {
        // Never fail protocol requests because of stderr log handling.
      }
    });

    this.process = child;
  }

  private rejectAll(error: Error): void {
    for (const { timer, reject } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  private async sendRequest(
    method: string,
    params: object,
    timeoutMs?: number
  ): Promise<JsonValue> {
    const processHandle = this.process;
    if (!processHandle) {
      throw new AppServerTransportError("app-server failed to start");
    }

    const id = ++this.requestId;
    const timeout = timeoutMs ?? this.requestTimeoutMs;
    const requestPayload = JsonRpcRequestSchema.parse({
      jsonrpc: APP_SERVER_JSON_RPC_VERSION,
      id,
      method,
      params: JsonValueSchema.parse(params)
    });
    const encoded = JSON.stringify(requestPayload) + "\n";

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppServerTransportError(`app-server request timed out: ${method}`));
      }, timeout);

      this.pending.set(id, { timer, resolve, reject });

      processHandle.stdin.write(encoded, (error) => {
        if (!error) {
          return;
        }

        const pending = this.pending.get(id);
        if (!pending) {
          return;
        }

        clearTimeout(pending.timer);
        this.pending.delete(id);
        pending.reject(new AppServerTransportError(`failed to write app-server request: ${error.message}`));
      });
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializeInFlight) {
      return this.initializeInFlight;
    }

    this.initializeInFlight = (async () => {
      const result = await this.sendRequest(
        APP_SERVER_INITIALIZE_METHOD,
        {
          clientInfo: {
            name: APP_SERVER_CLIENT_NAME,
            version: APP_SERVER_CLIENT_VERSION
          },
          capabilities: {
            experimentalApi: true
          }
        },
        this.requestTimeoutMs
      );

      InitializeResultSchema.parse(result);

      this.initialized = true;
    })().finally(() => {
      this.initializeInFlight = null;
    });

    return this.initializeInFlight;
  }

  public async request(
    method: string,
    params: object,
    timeoutMs?: number
  ): Promise<JsonValue> {
    this.ensureStarted();

    if (method !== APP_SERVER_INITIALIZE_METHOD) {
      await this.ensureInitialized();
    }

    const result = await this.sendRequest(method, params, timeoutMs);
    if (method === APP_SERVER_INITIALIZE_METHOD) {
      this.initialized = true;
    }
    return result;
  }

  public async close(): Promise<void> {
    const processHandle = this.process;
    if (!processHandle) {
      return;
    }

    this.resetProcessState();
    this.rejectAll(new AppServerTransportError("app-server transport closed"));

    processHandle.kill("SIGTERM");
  }
}
