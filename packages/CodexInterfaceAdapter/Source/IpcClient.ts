import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import net from "node:net";
import { z } from "zod";
import {
  IpcBroadcastFrameSchema,
  IpcClientDiscoveryResponseFrameSchema,
  IpcRequestFrameSchema,
  IpcResponseFrameSchema,
  JsonValueSchema,
  type IpcFrame,
  type IpcRequestFrame,
  type IpcResponseFrame,
  type JsonValue,
  parseIpcFrame
} from "@farfield/protocol";
import { DesktopIpcError } from "./Errors.js";
import { IpcFrameBufferAccumulator } from "./IpcFrameBufferAccumulator.js";

interface PendingRequest {
  method: string;
  timer: NodeJS.Timeout;
  resolve: (value: IpcResponseFrame) => void;
  reject: (error: Error) => void;
}

export interface SendRequestOptions {
  targetClientId?: string;
  version?: number;
  timeoutMs?: number;
}

export interface DesktopIpcClientOptions {
  socketPath: string;
  requestTimeoutMs?: number;
}

export type IpcFrameListener = (frame: IpcFrame) => void;
export interface IpcConnectionState {
  connected: boolean;
  reason?: string;
}
export type IpcConnectionListener = (state: IpcConnectionState) => void;

const MAX_FRAME_SIZE_BYTES = 256 * 1024 * 1024;
const IPC_FRAME_HEADER_SIZE_BYTES = 4;
const IPC_FRAME_HEADER_LENGTH_OFFSET_BYTES = 0;
const IPC_FRAME_PAYLOAD_ENCODING = "utf8";
const DEFAULT_IPC_REQUEST_TIMEOUT_MS = 20_000;
const INITIALIZING_CLIENT_ID = "initializing-client";
const IPC_FRAME_EVENT = "frame";
const IPC_CONNECTION_STATE_EVENT = "connection-state";
const IPC_SOCKET_CONNECT_EVENT = "connect";
const IPC_SOCKET_DATA_EVENT = "data";
const IPC_SOCKET_CLOSE_EVENT = "close";
const IPC_SOCKET_ERROR_EVENT = "error";
const IPC_BROADCAST_FRAME_TYPE = "broadcast";
const IPC_REQUEST_FRAME_TYPE = "request";
const IPC_RESPONSE_FRAME_TYPE = "response";
const IPC_CLIENT_DISCOVERY_REQUEST_FRAME_TYPE = "client-discovery-request";
const IPC_CLIENT_DISCOVERY_RESPONSE_FRAME_TYPE = "client-discovery-response";
const IPC_ERROR_RESULT_TYPE = "error";
const IPC_INITIALIZE_METHOD = "initialize";
const IPC_PROTOCOL_VERSION = 1;
const FARFIELD_CLIENT_TYPE = "farfield";
const NO_HANDLER_FOR_REQUEST_ERROR = "no-handler-for-request";
const IPC_ALREADY_CONNECTED_ERROR = "IPC client is already connected";
const IPC_SOCKET_CLOSED_ERROR = "IPC socket closed";
const IPC_SOCKET_ERROR_PREFIX = "IPC socket error";
const IPC_CLIENT_DISCONNECTED_ERROR = "IPC client disconnected";
const IPC_SOCKET_NOT_CONNECTED_ERROR = "IPC socket is not connected";
const IPC_FRAME_TOO_LARGE_ERROR_PREFIX = "IPC frame exceeded limit";
const IPC_INVALID_JSON_FRAME_ERROR = "IPC frame contained invalid JSON";
const IPC_SCHEMA_VALIDATION_FAILURE_ERROR_PREFIX = "IPC frame schema validation failed";
const IPC_REQUEST_TIMEOUT_ERROR_PREFIX = "IPC request timed out";
const IPC_REQUEST_WRITE_FAILURE_ERROR_PREFIX = "IPC request write failed for";
const IPC_INITIALIZE_TIMEOUT_ERROR = "IPC initialize request timed out";
const IPC_INITIALIZE_WRITE_FAILURE_ERROR = "IPC initialize write failed";
const InitializeResultSchema = z
  .object({
    clientId: z.string().min(1)
  })
  .passthrough();

function toErrorMessage<ValueType>(value: ValueType): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }

  const parsedStructuredValue = JsonValueSchema.safeParse(value);
  if (!parsedStructuredValue.success) {
    return String(value);
  }

  if (typeof parsedStructuredValue.data === "string") {
    return parsedStructuredValue.data;
  }

  return JSON.stringify(parsedStructuredValue.data);
}

/**
 * Owns raw desktop IPC socket lifecycle and framed request/response delivery.
 * Higher-level thread/message behavior is implemented by service/coordinator owners.
 */
export class DesktopIpcClient {
  private readonly socketPath: string;
  private readonly requestTimeoutMs: number;
  private socket: net.Socket | null = null;
  private readonly frameBuffer = new IpcFrameBufferAccumulator();
  private clientId: string | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly events = new EventEmitter();

  public constructor(options: DesktopIpcClientOptions) {
    this.socketPath = options.socketPath;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_IPC_REQUEST_TIMEOUT_MS;
  }

  public onFrame(listener: IpcFrameListener): () => void {
    this.events.on(IPC_FRAME_EVENT, listener);
    return () => this.events.off(IPC_FRAME_EVENT, listener);
  }

  public onConnectionState(listener: IpcConnectionListener): () => void {
    this.events.on(IPC_CONNECTION_STATE_EVENT, listener);
    return () => this.events.off(IPC_CONNECTION_STATE_EVENT, listener);
  }

  public isConnected(): boolean {
    return this.socket !== null;
  }

  public async connect(): Promise<void> {
    if (this.socket) {
      throw new DesktopIpcError(IPC_ALREADY_CONNECTED_ERROR);
    }

    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);

      socket.once(IPC_SOCKET_CONNECT_EVENT, () => resolve(socket));
      socket.once(IPC_SOCKET_ERROR_EVENT, (error) => reject(new DesktopIpcError(error.message)));
    });

    this.socket.on(IPC_SOCKET_DATA_EVENT, (chunk) => this.handleData(chunk));
    this.socket.on(IPC_SOCKET_CLOSE_EVENT, () => {
      this.rejectAll(new DesktopIpcError(IPC_SOCKET_CLOSED_ERROR));
      this.socket = null;
      this.frameBuffer.clear();
      this.clientId = null;
      this.emitConnectionState({
        connected: false,
        reason: IPC_SOCKET_CLOSED_ERROR
      });
    });
    this.socket.on(IPC_SOCKET_ERROR_EVENT, (error) => {
      const socketError = `${IPC_SOCKET_ERROR_PREFIX}: ${error.message}`;
      this.rejectAll(new DesktopIpcError(socketError));
      this.emitConnectionState({
        connected: false,
        reason: socketError
      });
    });

    this.emitConnectionState({ connected: true });
  }

  public async disconnect(): Promise<void> {
    const socket = this.socket;
    if (!socket) {
      return;
    }

    this.socket = null;
    this.clientId = null;
    this.rejectAll(new DesktopIpcError(IPC_CLIENT_DISCONNECTED_ERROR));

    await new Promise<void>((resolve) => {
      socket.once(IPC_SOCKET_CLOSE_EVENT, () => resolve());
      socket.end();
    });
  }

  private rejectAll(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  private ensureSocket(): net.Socket {
    if (!this.socket) {
      throw new DesktopIpcError(IPC_SOCKET_NOT_CONNECTED_ERROR);
    }
    return this.socket;
  }

  private emitFrame(frame: IpcFrame): void {
    this.events.emit(IPC_FRAME_EVENT, frame);
  }

  private emitConnectionState(state: IpcConnectionState): void {
    this.events.emit(IPC_CONNECTION_STATE_EVENT, state);
  }

  private sourceClientId(): string {
    return this.clientId ?? INITIALIZING_CLIENT_ID;
  }

  private createPendingRequestPromise(
    requestId: string,
    method: string,
    timeoutMs: number,
    timeoutErrorMessage: string
  ): Promise<IpcResponseFrame> {
    return new Promise<IpcResponseFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new DesktopIpcError(timeoutErrorMessage));
      }, timeoutMs);

      this.pending.set(requestId, {
        method,
        timer,
        resolve,
        reject
      });
    });
  }

  private writeRequestFrameOrReject(
    requestId: string,
    frame: IpcFrame,
    writeFailureMessagePrefix: string
  ): void {
    try {
      this.writeFrame(frame);
    } catch (error) {
      this.rejectPendingRequestById(
        requestId,
        new DesktopIpcError(`${writeFailureMessagePrefix}: ${toErrorMessage(error)}`)
      );
    }
  }

  private writeFrame(frame: IpcFrame): void {
    const socket = this.ensureSocket();
    const encoded = Buffer.from(JSON.stringify(frame), IPC_FRAME_PAYLOAD_ENCODING);
    const header = Buffer.alloc(IPC_FRAME_HEADER_SIZE_BYTES);
    header.writeUInt32LE(encoded.length, IPC_FRAME_HEADER_LENGTH_OFFSET_BYTES);
    socket.write(Buffer.concat([header, encoded]));
  }

  private rejectPendingRequestById(requestId: string, error: Error): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(requestId);
    pending.reject(error);
  }

  private respondClientDiscovery(requestId: string): void {
    const response = IpcClientDiscoveryResponseFrameSchema.parse({
      type: IPC_CLIENT_DISCOVERY_RESPONSE_FRAME_TYPE,
      requestId,
      response: {
        canHandle: false
      }
    });

    this.writeFrame(response);
  }

  private respondNoHandler(requestId: string): void {
    const response = IpcResponseFrameSchema.parse({
      type: IPC_RESPONSE_FRAME_TYPE,
      requestId,
      resultType: IPC_ERROR_RESULT_TYPE,
      error: NO_HANDLER_FOR_REQUEST_ERROR
    });

    this.writeFrame(response);
  }

  private handleData(chunk: Buffer): void {
    this.frameBuffer.appendChunk(chunk);

    while (true) {
      const readResult = this.frameBuffer.readNextPayload(MAX_FRAME_SIZE_BYTES);
      if (readResult.type === "none") {
        break;
      }

      if (readResult.type === "frame-too-large") {
        this.rejectAll(
          new DesktopIpcError(
            `${IPC_FRAME_TOO_LARGE_ERROR_PREFIX} (${String(readResult.size)} > ${String(
              MAX_FRAME_SIZE_BYTES
            )})`
          )
        );
        this.socket?.destroy();
        return;
      }

      const payloadBuffer = readResult.payload;

      let raw: JsonValue;
      try {
        raw = JsonValueSchema.parse(JSON.parse(payloadBuffer.toString(IPC_FRAME_PAYLOAD_ENCODING)));
      } catch {
        this.rejectAll(new DesktopIpcError(IPC_INVALID_JSON_FRAME_ERROR));
        return;
      }

      let frame: IpcFrame;
      try {
        frame = parseIpcFrame(raw);
      } catch (error) {
        this.rejectAll(
          new DesktopIpcError(
            `${IPC_SCHEMA_VALIDATION_FAILURE_ERROR_PREFIX}: ${toErrorMessage(error)}`
          )
        );
        this.socket?.destroy();
        return;
      }
      this.emitFrame(frame);

      if (frame.type === IPC_CLIENT_DISCOVERY_REQUEST_FRAME_TYPE) {
        this.respondClientDiscovery(frame.requestId);
        continue;
      }

      if (frame.type === IPC_REQUEST_FRAME_TYPE) {
        this.respondNoHandler(frame.requestId);
        continue;
      }

      if (frame.type !== IPC_RESPONSE_FRAME_TYPE) {
        continue;
      }

      const pending = this.pending.get(frame.requestId);
      if (!pending) {
        continue;
      }

      this.pending.delete(frame.requestId);
      clearTimeout(pending.timer);

      if (frame.resultType === IPC_ERROR_RESULT_TYPE) {
        pending.reject(
          new DesktopIpcError(
            `IPC ${pending.method} failed: ${toErrorMessage(frame.error)}`
          )
        );
        continue;
      }

      if (frame.method === IPC_INITIALIZE_METHOD) {
        // Some hosts append extra initialize fields. We only adopt a validated client identifier.
        const parsedInitializeResult = InitializeResultSchema.safeParse(frame.result);
        if (parsedInitializeResult.success) {
          this.clientId = parsedInitializeResult.data.clientId;
        }
      }

      pending.resolve(IpcResponseFrameSchema.parse(frame));
    }
  }

  public sendBroadcast(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {}
  ): void {
    const frame = IpcBroadcastFrameSchema.parse({
      type: IPC_BROADCAST_FRAME_TYPE,
      method,
      params,
      sourceClientId: this.sourceClientId(),
      targetClientId: options.targetClientId,
      version: options.version
    });

    this.writeFrame(frame);
  }

  public async sendRequestAndWait(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {}
  ): Promise<IpcResponseFrame> {
    const requestId = randomUUID();

    const frame = IpcRequestFrameSchema.parse({
      type: IPC_REQUEST_FRAME_TYPE,
      requestId,
      method,
      params,
      sourceClientId: this.sourceClientId(),
      targetClientId: options.targetClientId,
      version: options.version
    });

    const timeout = options.timeoutMs ?? this.requestTimeoutMs;
    const responsePromise = this.createPendingRequestPromise(
      requestId,
      method,
      timeout,
      `${IPC_REQUEST_TIMEOUT_ERROR_PREFIX}: ${method}`
    );

    this.writeRequestFrameOrReject(
      requestId,
      frame,
      `${IPC_REQUEST_WRITE_FAILURE_ERROR_PREFIX} ${method}`
    );
    return responsePromise;
  }

  public async initialize(_userAgent: string): Promise<IpcResponseFrame> {
    const requestId = randomUUID();
    const frame = IpcRequestFrameSchema.parse({
      type: IPC_REQUEST_FRAME_TYPE,
      requestId,
      sourceClientId: INITIALIZING_CLIENT_ID,
      version: IPC_PROTOCOL_VERSION,
      method: IPC_INITIALIZE_METHOD,
      params: {
        clientType: FARFIELD_CLIENT_TYPE
      }
    });

    const responsePromise = this.createPendingRequestPromise(
      requestId,
      IPC_INITIALIZE_METHOD,
      this.requestTimeoutMs,
      IPC_INITIALIZE_TIMEOUT_ERROR
    );

    this.writeRequestFrameOrReject(requestId, frame, IPC_INITIALIZE_WRITE_FAILURE_ERROR);
    return responsePromise;
  }
}
