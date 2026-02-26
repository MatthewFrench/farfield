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

const IPC_FRAME_BOUNDARY = {
  maxFrameSizeBytes: 256 * 1024 * 1024,
  headerSizeBytes: 4,
  headerLengthOffsetBytes: 0,
  payloadEncoding: "utf8"
} as const;
const IPC_DEFAULTS = {
  requestTimeoutMilliseconds: 20_000,
  protocolVersion: 1
} as const;
const IPC_CLIENT = {
  initializingClientId: "initializing-client",
  clientType: "farfield"
} as const;
const IPC_EVENTS = {
  frame: "frame",
  connectionState: "connection-state",
  socketConnect: "connect",
  socketData: "data",
  socketClose: "close",
  socketError: "error"
} as const;
const IPC_FRAME_TYPES = {
  broadcast: "broadcast",
  request: "request",
  response: "response",
  clientDiscoveryRequest: "client-discovery-request",
  clientDiscoveryResponse: "client-discovery-response"
} as const;
const IPC_RESULT_TYPES = {
  error: "error"
} as const;
const IPC_METHODS = {
  initialize: "initialize"
} as const;
const IPC_PROTOCOL_ERRORS = {
  noHandlerForRequest: "no-handler-for-request"
} as const;
const IPC_ERROR_MESSAGES = {
  alreadyConnected: "IPC client is already connected",
  socketClosed: "IPC socket closed",
  socketErrorPrefix: "IPC socket error",
  clientDisconnected: "IPC client disconnected",
  socketNotConnected: "IPC socket is not connected",
  frameTooLargePrefix: "IPC frame exceeded limit",
  invalidJsonFrame: "IPC frame contained invalid JSON",
  schemaValidationFailurePrefix: "IPC frame schema validation failed",
  requestTimeoutPrefix: "IPC request timed out",
  requestWriteFailurePrefix: "IPC request write failed for",
  initializeTimeout: "IPC initialize request timed out",
  initializeWriteFailure: "IPC initialize write failed"
} as const;
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
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? IPC_DEFAULTS.requestTimeoutMilliseconds;
  }

  public onFrame(listener: IpcFrameListener): () => void {
    this.events.on(IPC_EVENTS.frame, listener);
    return () => this.events.off(IPC_EVENTS.frame, listener);
  }

  public onConnectionState(listener: IpcConnectionListener): () => void {
    this.events.on(IPC_EVENTS.connectionState, listener);
    return () => this.events.off(IPC_EVENTS.connectionState, listener);
  }

  public isConnected(): boolean {
    return this.socket !== null;
  }

  public async connect(): Promise<void> {
    if (this.socket) {
      throw new DesktopIpcError(IPC_ERROR_MESSAGES.alreadyConnected);
    }

    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);

      socket.once(IPC_EVENTS.socketConnect, () => resolve(socket));
      socket.once(IPC_EVENTS.socketError, (error) => reject(new DesktopIpcError(error.message)));
    });

    this.attachSocketLifecycleHandlers(this.socket);

    this.emitConnectionState({ connected: true });
  }

  public async disconnect(): Promise<void> {
    const socket = this.socket;
    if (!socket) {
      return;
    }

    this.socket = null;
    this.clientId = null;
    this.rejectAll(new DesktopIpcError(IPC_ERROR_MESSAGES.clientDisconnected));

    await new Promise<void>((resolve) => {
      socket.once(IPC_EVENTS.socketClose, () => resolve());
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
      throw new DesktopIpcError(IPC_ERROR_MESSAGES.socketNotConnected);
    }
    return this.socket;
  }

  private emitFrame(frame: IpcFrame): void {
    this.events.emit(IPC_EVENTS.frame, frame);
  }

  private emitConnectionState(state: IpcConnectionState): void {
    this.events.emit(IPC_EVENTS.connectionState, state);
  }

  private sourceClientId(): string {
    return this.clientId ?? IPC_CLIENT.initializingClientId;
  }

  private attachSocketLifecycleHandlers(socket: net.Socket): void {
    socket.on(IPC_EVENTS.socketData, (chunk) => this.handleData(chunk));
    socket.on(IPC_EVENTS.socketClose, () => {
      this.handleSocketClose();
    });
    socket.on(IPC_EVENTS.socketError, (error) => {
      this.handleSocketError(error.message);
    });
  }

  private handleSocketClose(): void {
    this.rejectAll(new DesktopIpcError(IPC_ERROR_MESSAGES.socketClosed));
    this.socket = null;
    this.frameBuffer.clear();
    this.clientId = null;
    this.emitConnectionState({
      connected: false,
      reason: IPC_ERROR_MESSAGES.socketClosed
    });
  }

  private handleSocketError(errorMessage: string): void {
    const socketErrorMessage = `${IPC_ERROR_MESSAGES.socketErrorPrefix}: ${errorMessage}`;
    this.rejectAll(new DesktopIpcError(socketErrorMessage));
    this.emitConnectionState({
      connected: false,
      reason: socketErrorMessage
    });
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
    const encoded = Buffer.from(JSON.stringify(frame), IPC_FRAME_BOUNDARY.payloadEncoding);
    const header = Buffer.alloc(IPC_FRAME_BOUNDARY.headerSizeBytes);
    header.writeUInt32LE(encoded.length, IPC_FRAME_BOUNDARY.headerLengthOffsetBytes);
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
      type: IPC_FRAME_TYPES.clientDiscoveryResponse,
      requestId,
      response: {
        canHandle: false
      }
    });

    this.writeFrame(response);
  }

  private respondNoHandler(requestId: string): void {
    const response = IpcResponseFrameSchema.parse({
      type: IPC_FRAME_TYPES.response,
      requestId,
      resultType: IPC_RESULT_TYPES.error,
      error: IPC_PROTOCOL_ERRORS.noHandlerForRequest
    });

    this.writeFrame(response);
  }

  private parseInboundPayload(payloadBuffer: Buffer): JsonValue {
    const payloadText = payloadBuffer.toString(IPC_FRAME_BOUNDARY.payloadEncoding);
    return JsonValueSchema.parse(JSON.parse(payloadText));
  }

  private parseInboundFrame(rawPayload: JsonValue): IpcFrame {
    return parseIpcFrame(rawPayload);
  }

  private handleInboundFrame(frame: IpcFrame): void {
    this.emitFrame(frame);

    if (frame.type === IPC_FRAME_TYPES.clientDiscoveryRequest) {
      this.respondClientDiscovery(frame.requestId);
      return;
    }

    if (frame.type === IPC_FRAME_TYPES.request) {
      this.respondNoHandler(frame.requestId);
      return;
    }

    if (frame.type !== IPC_FRAME_TYPES.response) {
      return;
    }

    this.handleInboundResponseFrame(frame);
  }

  private handleInboundResponseFrame(frame: IpcResponseFrame): void {
    const pending = this.pending.get(frame.requestId);
    if (!pending) {
      return;
    }

    this.pending.delete(frame.requestId);
    clearTimeout(pending.timer);

    if (frame.resultType === IPC_RESULT_TYPES.error) {
      pending.reject(
        new DesktopIpcError(`IPC ${pending.method} failed: ${toErrorMessage(frame.error)}`)
      );
      return;
    }

    this.captureInitializeClientIdentifier(frame);
    pending.resolve(IpcResponseFrameSchema.parse(frame));
  }

  private captureInitializeClientIdentifier(frame: IpcResponseFrame): void {
    if (frame.method !== IPC_METHODS.initialize) {
      return;
    }

    // Some hosts append extra initialize fields. We only adopt a validated client identifier.
    const parsedInitializeResult = InitializeResultSchema.safeParse(frame.result);
    if (parsedInitializeResult.success) {
      this.clientId = parsedInitializeResult.data.clientId;
    }
  }

  private rejectAllForOversizedFrame(frameSizeBytes: number): void {
    this.rejectAll(
      new DesktopIpcError(
        `${IPC_ERROR_MESSAGES.frameTooLargePrefix} (${String(frameSizeBytes)} > ${String(
          IPC_FRAME_BOUNDARY.maxFrameSizeBytes
        )})`
      )
    );
    this.socket?.destroy();
  }

  private handleData(chunk: Buffer): void {
    this.frameBuffer.appendChunk(chunk);

    while (true) {
      const readResult = this.frameBuffer.readNextPayload(IPC_FRAME_BOUNDARY.maxFrameSizeBytes);
      if (readResult.type === "none") {
        break;
      }

      if (readResult.type === "frame-too-large") {
        this.rejectAllForOversizedFrame(readResult.size);
        return;
      }

      let raw: JsonValue;
      try {
        raw = this.parseInboundPayload(readResult.payload);
      } catch {
        this.rejectAll(new DesktopIpcError(IPC_ERROR_MESSAGES.invalidJsonFrame));
        return;
      }

      let frame: IpcFrame;
      try {
        frame = this.parseInboundFrame(raw);
      } catch (error) {
        this.rejectAll(
          new DesktopIpcError(
            `${IPC_ERROR_MESSAGES.schemaValidationFailurePrefix}: ${toErrorMessage(error)}`
          )
        );
        this.socket?.destroy();
        return;
      }
      this.handleInboundFrame(frame);
    }
  }

  public sendBroadcast(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {}
  ): void {
    const frame = IpcBroadcastFrameSchema.parse({
      type: IPC_FRAME_TYPES.broadcast,
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
      type: IPC_FRAME_TYPES.request,
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
      `${IPC_ERROR_MESSAGES.requestTimeoutPrefix}: ${method}`
    );

    this.writeRequestFrameOrReject(
      requestId,
      frame,
      `${IPC_ERROR_MESSAGES.requestWriteFailurePrefix} ${method}`
    );
    return responsePromise;
  }

  public async initialize(_userAgent: string): Promise<IpcResponseFrame> {
    const requestId = randomUUID();
    const frame = IpcRequestFrameSchema.parse({
      type: IPC_FRAME_TYPES.request,
      requestId,
      sourceClientId: IPC_CLIENT.initializingClientId,
      version: IPC_DEFAULTS.protocolVersion,
      method: IPC_METHODS.initialize,
      params: {
        clientType: IPC_CLIENT.clientType
      }
    });

    const responsePromise = this.createPendingRequestPromise(
      requestId,
      IPC_METHODS.initialize,
      this.requestTimeoutMs,
      IPC_ERROR_MESSAGES.initializeTimeout
    );

    this.writeRequestFrameOrReject(requestId, frame, IPC_ERROR_MESSAGES.initializeWriteFailure);
    return responsePromise;
  }
}
