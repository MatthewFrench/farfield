import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import {
  type JsonValue,
  JsonValueSchema,
  parseThreadConversationRequest,
  parseThreadConversationRequestResponse,
  type ThreadConversationRequestResponse,
} from "@farfield/protocol";
import { z } from "zod";
import {
  type ChildProcessAppServerTransportOptions,
  isChildProcessAppServerTransportOptionsValue,
  parseChildProcessAppServerTransportOptions,
} from "./AppServerChildProcessTransportOptionsContract.js";
import { parseAppServerIncomingLine } from "./AppServerIncomingLineParser.js";
import { isHandledAppServerServerRequestMethod } from "./AppServerServerRequestMethodConstants.js";
import {
  type BuildAppServerSpawnEnvironmentInput,
  buildAppServerSpawnEnvironment,
} from "./AppServerSpawnEnvironmentContract.js";
import {
  APP_SERVER_CLIENT_NAME,
  APP_SERVER_CLIENT_VERSION,
  APP_SERVER_COMMAND,
  APP_SERVER_INITIALIZE_METHOD,
  APP_SERVER_INITIALIZED_NOTIFICATION_METHOD,
  APP_SERVER_JSON_RPC_VERSION,
  APP_SERVER_PROCESS_NAME,
  APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR,
  DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS,
} from "./AppServerTransportConstants.js";
import { AppServerRpcError, AppServerTransportError } from "./Errors.js";
import { type JsonRpcIncomingRequest, JsonRpcRequestSchema } from "./JsonRpc.js";

export type { BuildAppServerSpawnEnvironmentInput };
export { buildAppServerSpawnEnvironment };
export type { ChildProcessAppServerTransportOptions };

export interface AppServerNotificationEvent {
  sequence: number;
  method: string;
  params: JsonValue | null;
  receivedAtMilliseconds: number;
}

export interface AppServerReadNotificationEventsInput {
  limit: number;
  sinceSequence: number | null;
}

export interface AppServerReadNotificationEventsResult {
  events: AppServerNotificationEvent[];
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

export interface AppServerPendingServerRequest {
  requestId: number;
  method: string;
  params: JsonValue | null;
  receivedAtMilliseconds: number;
}

export interface AppServerTransport {
  request(method: string, params: object, timeoutMs?: number): Promise<JsonValue>;
  respond?(requestId: number, response: ThreadConversationRequestResponse): Promise<void>;
  readNotificationEvents?(
    input: AppServerReadNotificationEventsInput,
  ): AppServerReadNotificationEventsResult;
  readPendingServerRequests?(): AppServerPendingServerRequest[];
  close(): Promise<void>;
}

interface PendingRequest {
  timer: NodeJS.Timeout;
  resolve: (value: JsonValue) => void;
  reject: (error: Error) => void;
}

const InitializeResultSchema = z.object({}).passthrough();
const AppServerReadNotificationEventsInputSchema = z
  .object({
    limit: z.number().int().positive(),
    sinceSequence: z.number().int().nonnegative().nullable(),
  })
  .strict();

const DEFAULT_APP_SERVER_NOTIFICATION_EVENT_LIMIT = 400;
const INITIAL_NOTIFICATION_SEQUENCE = 0;
const RESET_CURSOR_SEQUENCE_OFFSET = 1;
const JSON_RPC_METHOD_NOT_FOUND_ERROR_CODE = -32_601;
const JSON_RPC_INVALID_PARAMS_ERROR_CODE = -32_602;
const UNSUPPORTED_SERVER_REQUEST_ERROR_MESSAGE_PREFIX =
  "Farfield does not support app-server server request method";
const INVALID_SERVER_REQUEST_PARAMETERS_ERROR_MESSAGE_PREFIX =
  "App-server server request parameters did not match expected schema";

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
  private readonly notificationEventLimit: number;
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly pendingServerRequestsById = new Map<number, AppServerPendingServerRequest>();
  private readonly notificationEvents: AppServerNotificationEvent[] = [];
  private requestId = 0;
  private initialized = false;
  private initializeInFlight: Promise<void> | null = null;
  private notificationSequence = INITIAL_NOTIFICATION_SEQUENCE;

  public constructor(options: ChildProcessAppServerTransportOptions) {
    const parsedOptions = parseChildProcessAppServerTransportOptions(options);
    this.executablePath = parsedOptions.executablePath;
    this.userAgent = parsedOptions.userAgent;
    this.baseEnvironment = parsedOptions.baseEnvironment;
    this.cwd = parsedOptions.cwd;
    this.env = parsedOptions.env;
    this.requestTimeoutMs = parsedOptions.requestTimeoutMs ?? DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS;
    this.onStderr = parsedOptions.onStderr;
    this.notificationEventLimit =
      parsedOptions.notificationEventLimit ?? DEFAULT_APP_SERVER_NOTIFICATION_EVENT_LIMIT;
  }

  private resetProcessState(): void {
    this.process = null;
    this.initialized = false;
    this.initializeInFlight = null;
    this.pendingServerRequestsById.clear();
    this.notificationEvents.length = 0;
    this.notificationSequence = INITIAL_NOTIFICATION_SEQUENCE;
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
        this.appendNotificationEvent(message.value.method, message.value.params ?? null);
        return;
      }

      if (message.kind === "request") {
        void this.handleServerRequest(message.value).catch((error) => {
          this.rejectAll(
            new AppServerTransportError(
              `${APP_SERVER_PROCESS_NAME} server-request handling failed: ${toErrorMessage(error)}`,
            ),
          );
        });
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

  private appendNotificationEvent(method: string, params: JsonValue | null): void {
    const event: AppServerNotificationEvent = {
      sequence: this.notificationSequence,
      method,
      params,
      receivedAtMilliseconds: Date.now(),
    };
    this.notificationEvents.push(event);
    this.notificationSequence += 1;

    if (this.notificationEvents.length > this.notificationEventLimit) {
      this.notificationEvents.splice(
        0,
        this.notificationEvents.length - this.notificationEventLimit,
      );
    }
  }

  private rejectAll(error: Error): void {
    for (const { timer, reject } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  private async writeJsonRpcPayload(payload: JsonValue): Promise<void> {
    const processHandle = this.process;
    if (!processHandle) {
      throw new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} failed to start`);
    }

    const encoded =
      JSON.stringify(JsonValueSchema.parse(payload)) + APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR;

    await new Promise<void>((resolve, reject) => {
      processHandle.stdin.write(encoded, (error) => {
        if (!error) {
          resolve();
          return;
        }

        reject(
          new AppServerTransportError(
            `failed to write ${APP_SERVER_PROCESS_NAME} payload: ${error.message}`,
          ),
        );
      });
    });
  }

  private async sendRequest(
    method: string,
    params: object,
    timeoutMs?: number,
  ): Promise<JsonValue> {
    const id = ++this.requestId;
    const timeout = timeoutMs ?? this.requestTimeoutMs;
    const requestPayload = JsonRpcRequestSchema.parse({
      jsonrpc: APP_SERVER_JSON_RPC_VERSION,
      id,
      method,
      params: JsonValueSchema.parse(params),
    });
    const encoded = JSON.stringify(requestPayload) + APP_SERVER_STANDARD_INPUT_LINE_TERMINATOR;
    const processHandle = this.process;
    if (!processHandle) {
      throw new AppServerTransportError(`${APP_SERVER_PROCESS_NAME} failed to start`);
    }

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

  private async sendInitializedNotification(): Promise<void> {
    await this.writeJsonRpcPayload({
      jsonrpc: APP_SERVER_JSON_RPC_VERSION,
      method: APP_SERVER_INITIALIZED_NOTIFICATION_METHOD,
    });
  }

  private async sendServerRequestResponse(
    requestId: number,
    payload:
      | {
          result: JsonValue;
          error?: never;
        }
      | {
          result?: never;
          error: {
            code: number;
            message: string;
            data?: JsonValue;
          };
        },
  ): Promise<void> {
    const responsePayload: JsonValue = {
      jsonrpc: APP_SERVER_JSON_RPC_VERSION,
      id: requestId,
      ...payload,
    };
    await this.writeJsonRpcPayload(responsePayload);
  }

  private async respondWithUnsupportedServerRequest(
    requestId: number,
    method: string,
  ): Promise<void> {
    await this.sendServerRequestResponse(requestId, {
      error: {
        code: JSON_RPC_METHOD_NOT_FOUND_ERROR_CODE,
        message: `${UNSUPPORTED_SERVER_REQUEST_ERROR_MESSAGE_PREFIX}: ${method}`,
      },
    });
  }

  private async respondWithInvalidServerRequestParameters(
    requestId: number,
    method: string,
    errorMessage: string,
  ): Promise<void> {
    await this.sendServerRequestResponse(requestId, {
      error: {
        code: JSON_RPC_INVALID_PARAMS_ERROR_CODE,
        message: `${INVALID_SERVER_REQUEST_PARAMETERS_ERROR_MESSAGE_PREFIX}: ${method}`,
        data: {
          validationError: errorMessage,
        },
      },
    });
  }

  private async handleServerRequest(serverRequest: JsonRpcIncomingRequest): Promise<void> {
    if (!isHandledAppServerServerRequestMethod(serverRequest.method)) {
      await this.respondWithUnsupportedServerRequest(serverRequest.id, serverRequest.method);
      return;
    }

    try {
      const parsedServerRequest = parseThreadConversationRequest(
        JsonValueSchema.parse({
          id: serverRequest.id,
          method: serverRequest.method,
          params: JsonValueSchema.parse(serverRequest.params ?? {}),
        }),
      );

      this.pendingServerRequestsById.set(parsedServerRequest.id, {
        requestId: parsedServerRequest.id,
        method: parsedServerRequest.method,
        params: JsonValueSchema.parse(parsedServerRequest.params),
        receivedAtMilliseconds: Date.now(),
      });
    } catch (error) {
      await this.respondWithInvalidServerRequestParameters(
        serverRequest.id,
        serverRequest.method,
        toErrorMessage(error),
      );
    }
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
      await this.sendInitializedNotification();
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

  public async respond(
    requestId: number,
    response: ThreadConversationRequestResponse,
  ): Promise<void> {
    const pendingServerRequest = this.pendingServerRequestsById.get(requestId);
    if (!pendingServerRequest) {
      throw new AppServerTransportError(
        `${APP_SERVER_PROCESS_NAME} server request id ${String(requestId)} is not pending.`,
      );
    }

    const parsedResponse = parseThreadConversationRequestResponse(JsonValueSchema.parse(response));

    if (parsedResponse.method !== pendingServerRequest.method) {
      throw new AppServerTransportError(
        `${APP_SERVER_PROCESS_NAME} server request id ${String(requestId)} expects method ${pendingServerRequest.method} but received ${parsedResponse.method}.`,
      );
    }

    await this.sendServerRequestResponse(requestId, {
      result: JsonValueSchema.parse(parsedResponse.payload),
    });
    this.pendingServerRequestsById.delete(requestId);
  }

  public readNotificationEvents(
    input: AppServerReadNotificationEventsInput,
  ): AppServerReadNotificationEventsResult {
    const parsedInput = AppServerReadNotificationEventsInputSchema.parse(input);
    const nextSequence = this.notificationSequence;
    const firstEvent = this.notificationEvents[0];
    const firstAvailableSequence = firstEvent ? firstEvent.sequence : nextSequence;

    const resetRequired =
      parsedInput.sinceSequence !== null &&
      (parsedInput.sinceSequence < firstAvailableSequence - RESET_CURSOR_SEQUENCE_OFFSET ||
        parsedInput.sinceSequence >= nextSequence);

    const sinceSequence = parsedInput.sinceSequence;
    let selectedEvents: AppServerNotificationEvent[];
    if (resetRequired || sinceSequence === null) {
      selectedEvents = this.notificationEvents.slice(-parsedInput.limit);
    } else {
      selectedEvents = this.notificationEvents.filter((event) => event.sequence > sinceSequence);
    }

    return {
      events: selectedEvents,
      nextSequence,
      firstAvailableSequence,
      resetRequired,
    };
  }

  public readPendingServerRequests(): AppServerPendingServerRequest[] {
    return [...this.pendingServerRequestsById.values()].sort((left, right) => {
      if (left.receivedAtMilliseconds === right.receivedAtMilliseconds) {
        return left.requestId - right.requestId;
      }
      return left.receivedAtMilliseconds - right.receivedAtMilliseconds;
    });
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
