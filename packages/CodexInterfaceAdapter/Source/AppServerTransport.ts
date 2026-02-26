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
const APP_SERVER_PROCESS_NAME = APP_SERVER_COMMAND;
const APP_SERVER_CLIENT_NAME = "farfield";
const APP_SERVER_CLIENT_VERSION = "0.2.0";
const APP_SERVER_INITIALIZE_METHOD = "initialize";
const APP_SERVER_JSON_RPC_VERSION = "2.0";
const DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS = 30_000;
const APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR = "\n";
const APP_SERVER_CODEX_USER_AGENT_ENVIRONMENT_KEY = "CODEX_USER_AGENT";
const APP_SERVER_CODEX_CLIENT_IDENTIFIER_ENVIRONMENT_KEY = "CODEX_CLIENT_ID";

const ProcessEnvironmentSchema = z.record(z.string(), z.string().optional());
const InitializeResultSchema = z.object({}).passthrough();
const SpawnEnvironmentVariableSchema = z.string().min(1).optional();
// This allowlist intentionally covers cross-platform process execution context only.
// Any key not listed here is blocked from child-process startup.
const AppServerSpawnEnvironmentShape = {
  HOME: SpawnEnvironmentVariableSchema,
  PATH: SpawnEnvironmentVariableSchema,
  SHELL: SpawnEnvironmentVariableSchema,
  USER: SpawnEnvironmentVariableSchema,
  USERNAME: SpawnEnvironmentVariableSchema,
  TMPDIR: SpawnEnvironmentVariableSchema,
  TMP: SpawnEnvironmentVariableSchema,
  TEMP: SpawnEnvironmentVariableSchema,
  LANG: SpawnEnvironmentVariableSchema,
  LC_ALL: SpawnEnvironmentVariableSchema,
  TERM: SpawnEnvironmentVariableSchema,
  TZ: SpawnEnvironmentVariableSchema,
  SSL_CERT_FILE: SpawnEnvironmentVariableSchema,
  SSL_CERT_DIR: SpawnEnvironmentVariableSchema,
  NODE_EXTRA_CA_CERTS: SpawnEnvironmentVariableSchema,
  HTTP_PROXY: SpawnEnvironmentVariableSchema,
  HTTPS_PROXY: SpawnEnvironmentVariableSchema,
  NO_PROXY: SpawnEnvironmentVariableSchema,
  ALL_PROXY: SpawnEnvironmentVariableSchema,
  CODEX_HOME: SpawnEnvironmentVariableSchema,
  XDG_CONFIG_HOME: SpawnEnvironmentVariableSchema,
  XDG_CACHE_HOME: SpawnEnvironmentVariableSchema,
  APPDATA: SpawnEnvironmentVariableSchema,
  LOCALAPPDATA: SpawnEnvironmentVariableSchema,
  USERPROFILE: SpawnEnvironmentVariableSchema,
  SystemRoot: SpawnEnvironmentVariableSchema,
  ComSpec: SpawnEnvironmentVariableSchema
} as const;
const AppServerSpawnInheritedEnvironmentSchema = z.object(AppServerSpawnEnvironmentShape).strip();
const AppServerSpawnOverrideEnvironmentSchema = z.object(AppServerSpawnEnvironmentShape).strict();
const BuildAppServerSpawnEnvironmentInputSchema = z
  .object({
    baseEnvironment: ProcessEnvironmentSchema,
    overrideEnvironment: ProcessEnvironmentSchema.optional(),
    userAgent: z.string().min(1),
    clientId: z.string().min(1)
  })
  .strict();

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
  const parsedInput = BuildAppServerSpawnEnvironmentInputSchema.parse(input);
  const inheritedEnvironment = AppServerSpawnInheritedEnvironmentSchema.parse(parsedInput.baseEnvironment);
  const overrideEnvironment = AppServerSpawnOverrideEnvironmentSchema.parse(parsedInput.overrideEnvironment ?? {});

  return {
    ...inheritedEnvironment,
    ...overrideEnvironment,
    [APP_SERVER_CODEX_USER_AGENT_ENVIRONMENT_KEY]: parsedInput.userAgent,
    [APP_SERVER_CODEX_CLIENT_IDENTIFIER_ENVIRONMENT_KEY]: parsedInput.clientId
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

/**
 * Owns request/response transport state for a single spawned `app-server` process.
 * `pending` and `initializeInFlight` enforce deterministic single-settle request behavior under concurrent calls.
 */
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
        `${APP_SERVER_PROCESS_NAME} environment configuration invalid: ${toErrorMessage(error)}`
      );
    }

    const child = spawn(this.executablePath, [APP_SERVER_COMMAND], {
      cwd: this.cwd,
      env: spawnEnvironment,
      stdio: ["pipe", "pipe", "pipe"]
    });

    child.on("exit", (code, signal) => {
      const reason = `${APP_SERVER_PROCESS_NAME} exited (code=${String(code)}, signal=${String(signal)})`;
      this.rejectAll(new AppServerTransportError(reason));
      this.resetProcessState();
    });

    child.on("error", (error) => {
      this.rejectAll(new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} process error: ${error.message}`));
      this.resetProcessState();
    });

    const lineReader = readline.createInterface({ input: child.stdout });
    lineReader.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        return;
      }

      let raw: JsonValue;
      try {
        raw = JsonValueSchema.parse(JSON.parse(trimmed));
      } catch {
        this.rejectAll(new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} returned invalid JSON`));
        return;
      }

      let message;
      try {
        message = parseJsonRpcIncomingMessage(raw);
      } catch (error) {
        this.rejectAll(
          new AppServerTransportError(
            `${APP_SERVER_PROCESS_NAME} response schema mismatch: ${toErrorMessage(error)}`
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
            `${APP_SERVER_PROCESS_NAME} response missing result for request id ${String(message.value.id)}`
          )
        );
        return;
      }

      pending.resolve(message.value.result);
    });

    const stderrReader = readline.createInterface({ input: child.stderr });
    stderrReader.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
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
      throw new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} failed to start`);
    }

    const id = ++this.requestId;
    const timeout = timeoutMs ?? this.requestTimeoutMs;
    const requestPayload = JsonRpcRequestSchema.parse({
      jsonrpc: APP_SERVER_JSON_RPC_VERSION,
      id,
      method,
      params: JsonValueSchema.parse(params)
    });
    const encoded = JSON.stringify(requestPayload) + APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR;

    return new Promise((resolve, reject) => {
      // Timeout completion and write callbacks can race during shutdown. `pending` ownership ensures one settle path.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} request timed out: ${method}`));
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
        pending.reject(new AppServerTransportError(`failed to write ${APP_SERVER_PROCESS_NAME} request: ${error.message}`));
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

    // Concurrent request callers share one initialize handshake so request ordering and error propagation stay deterministic.
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

    // The initialize RPC must not recursively trigger initialize orchestration.
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
    // Reject before SIGTERM so close callers and in-flight callers observe deterministic closure semantics.
    this.rejectAll(new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} transport closed`));

    processHandle.kill("SIGTERM");
  }
}
