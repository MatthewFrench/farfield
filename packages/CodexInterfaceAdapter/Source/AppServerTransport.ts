import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import {
  type ChildProcessAppServerTransportOptions,
  isChildProcessAppServerTransportOptionsValue,
  parseChildProcessAppServerTransportOptions,
} from "./AppServerChildProcessTransportOptionsContract.js";
import { parseAppServerIncomingLine } from "./AppServerIncomingLineParser.js";
import {
  type BuildAppServerSpawnEnvironmentInput,
  buildAppServerSpawnEnvironment,
} from "./AppServerSpawnEnvironmentContract.js";
import {
  APP_SERVER_CLIENT_NAME,
  APP_SERVER_CLIENT_VERSION,
  APP_SERVER_COMMAND,
  APP_SERVER_INITIALIZE_METHOD,
  APP_SERVER_JSON_RPC_VERSION,
  APP_SERVER_PROCESS_NAME,
  APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR,
  DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS,
} from "./AppServerTransportConstants.js";
import { AppServerRpcError, AppServerTransportError } from "./Errors.js";
import { JsonRpcRequestSchema } from "./JsonRpc.js";

export type { BuildAppServerSpawnEnvironmentInput };
export { buildAppServerSpawnEnvironment };
export type { ChildProcessAppServerTransportOptions };

export interface AppServerTransport {
  request(method: string, params: object, timeoutMs?: number): Promise<JsonValue>;
  close(): Promise<void>;
}

interface PendingRequest {
  timer: NodeJS.Timeout;
  resolve: (value: JsonValue) => void;
  reject: (error: Error) => void;
}

const InitializeResultSchema = z.object({}).passthrough();

function toErrorMessage<ValueType>(value: ValueType): string {
  if (value instanceof Error) {
    return value.message;
  }

  return String(value);
}

export function isChildProcessAppServerTransportOptions(
  value: AppServerTransport | ChildProcessAppServerTransportOptions,
): value is ChildProcessAppServerTransportOptions {
  return isChildProcessAppServerTransportOptionsValue(value);
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
    const parsedOptions = parseChildProcessAppServerTransportOptions(options);
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
        clientId: clientIdentifier,
      };
      if (this.env) {
        spawnEnvironmentInput.overrideEnvironment = this.env;
      }
      spawnEnvironment = buildAppServerSpawnEnvironment(spawnEnvironmentInput);
    } catch (error) {
      throw new AppServerTransportError(
        `${APP_SERVER_PROCESS_NAME} environment configuration invalid: ${toErrorMessage(error)}`,
      );
    }

    const child = spawn(this.executablePath, [APP_SERVER_COMMAND], {
      cwd: this.cwd,
      env: spawnEnvironment,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.on("exit", (code, signal) => {
      const reason = `${APP_SERVER_PROCESS_NAME} exited (code=${String(code)}, signal=${String(signal)})`;
      this.rejectAll(new AppServerTransportError(reason));
      this.resetProcessState();
    });

    child.on("error", (error) => {
      this.rejectAll(
        new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} process error: ${error.message}`),
      );
      this.resetProcessState();
    });

    const lineReader = readline.createInterface({ input: child.stdout });
    lineReader.on("line", (line) => {
      const parseResult = parseAppServerIncomingLine(line);
      if (parseResult.kind === "ignore") {
        return;
      }

      if (parseResult.kind === "error") {
        const parseFailureMessage =
          parseResult.errorKind === "invalid-json"
            ? `${APP_SERVER_PROCESS_NAME} returned invalid JSON`
            : `${APP_SERVER_PROCESS_NAME} response schema mismatch: ${parseResult.errorMessage}`;
        this.rejectAll(new AppServerTransportError(parseFailureMessage));
        return;
      }

      const message = parseResult.message;
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
            message.value.error.data,
          ),
        );
        return;
      }

      if (message.value.result === undefined) {
        pending.reject(
          new AppServerTransportError(
            `${APP_SERVER_PROCESS_NAME} response missing result for request id ${String(message.value.id)}`,
          ),
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
    timeoutMs?: number,
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
      params: JsonValueSchema.parse(params),
    });
    const encoded = JSON.stringify(requestPayload) + APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR;

    return new Promise((resolve, reject) => {
      // Timeout completion and write callbacks can race during shutdown. `pending` ownership ensures one settle path.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} request timed out: ${method}`),
        );
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
        pending.reject(
          new AppServerTransportError(
            `failed to write ${APP_SERVER_PROCESS_NAME} request: ${error.message}`,
          ),
        );
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
            version: APP_SERVER_CLIENT_VERSION,
          },
          capabilities: {
            experimentalApi: true,
          },
        },
        this.requestTimeoutMs,
      );

      InitializeResultSchema.parse(result);

      this.initialized = true;
    })().finally(() => {
      this.initializeInFlight = null;
    });

    return this.initializeInFlight;
  }

  public async request(method: string, params: object, timeoutMs?: number): Promise<JsonValue> {
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
