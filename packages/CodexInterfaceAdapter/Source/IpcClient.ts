import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import net from "node:net";
import {
  IpcBroadcastFrameSchema,
  IpcClientDiscoveryResponseFrameSchema,
  type IpcFrame,
  type IpcRequestFrame,
  IpcRequestFrameSchema,
  type IpcResponseFrame,
  IpcResponseFrameSchema,
  type JsonValue,
  parseIpcFrame,
} from "@farfield/protocol";
import { DesktopIpcError } from "./Errors.js";
import {
  IPC_CLIENT,
  IPC_DEFAULTS,
  IPC_ERROR_MESSAGES,
  IPC_EVENTS,
  IPC_FRAME_BOUNDARY,
  IPC_FRAME_TYPES,
  IPC_INITIALIZE_RESULT_SCHEMA,
  IPC_METHODS,
  IPC_PROTOCOL_ERRORS,
  IPC_RESULT_TYPES,
} from "./IpcClientConstants.js";
import { formatIpcErrorMessage } from "./IpcErrorMessageFormatter.js";
import { IpcFrameBufferAccumulator } from "./IpcFrameBufferAccumulator.js";
import { encodeIpcFrame, parseIpcPayloadBuffer } from "./IpcFrameCodec.js";
import { IpcPendingRequestOwner } from "./IpcPendingRequestOwner.js";

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
  private readonly pendingRequestOwner = new IpcPendingRequestOwner();
  private readonly events = new EventEmitter();

  public constructor(options: DesktopIpcClientOptions) {
    this.socketPath = options.socketPath;
    this.requestTimeoutMs = options.requestTimeoutMs ?? IPC_DEFAULTS.requestTimeoutMilliseconds;
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
    this.pendingRequestOwner.rejectAllPendingRequests(error);
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
      reason: IPC_ERROR_MESSAGES.socketClosed,
    });
  }

  private handleSocketError(errorMessage: string): void {
    const socketErrorMessage = `${IPC_ERROR_MESSAGES.socketErrorPrefix}: ${errorMessage}`;
    this.rejectAll(new DesktopIpcError(socketErrorMessage));
    this.emitConnectionState({
      connected: false,
      reason: socketErrorMessage,
    });
  }

  private createPendingRequestPromise(
    requestId: string,
    method: string,
    timeoutMs: number,
    timeoutErrorMessage: string,
  ): Promise<IpcResponseFrame> {
    return this.pendingRequestOwner.createPendingRequestPromise({
      requestId,
      method,
      timeoutMilliseconds: timeoutMs,
      timeoutErrorMessage,
    });
  }

  private writeRequestFrameOrReject(
    requestId: string,
    frame: IpcFrame,
    writeFailureMessagePrefix: string,
  ): void {
    try {
      this.writeFrame(frame);
    } catch (error) {
      this.pendingRequestOwner.rejectPendingRequest(
        requestId,
        new DesktopIpcError(`${writeFailureMessagePrefix}: ${formatIpcErrorMessage(error)}`),
      );
    }
  }

  private writeFrame(frame: IpcFrame): void {
    const socket = this.ensureSocket();
    socket.write(encodeIpcFrame(frame));
  }

  private respondClientDiscovery(requestId: string): void {
    const response = IpcClientDiscoveryResponseFrameSchema.parse({
      type: IPC_FRAME_TYPES.clientDiscoveryResponse,
      requestId,
      response: {
        canHandle: false,
      },
    });

    this.writeFrame(response);
  }

  private respondNoHandler(requestId: string): void {
    const response = IpcResponseFrameSchema.parse({
      type: IPC_FRAME_TYPES.response,
      requestId,
      resultType: IPC_RESULT_TYPES.error,
      error: IPC_PROTOCOL_ERRORS.noHandlerForRequest,
    });

    this.writeFrame(response);
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
    const pendingRequest = this.pendingRequestOwner.claimPendingRequest(frame.requestId);
    if (!pendingRequest) {
      return;
    }

    if (frame.resultType === IPC_RESULT_TYPES.error) {
      pendingRequest.reject(
        new DesktopIpcError(
          `IPC ${pendingRequest.method} failed: ${formatIpcErrorMessage(frame.error)}`,
        ),
      );
      return;
    }

    this.captureInitializeClientIdentifier(frame);
    pendingRequest.resolve(IpcResponseFrameSchema.parse(frame));
  }

  private captureInitializeClientIdentifier(frame: IpcResponseFrame): void {
    if (frame.method !== IPC_METHODS.initialize) {
      return;
    }

    // Some hosts append extra initialize fields. We only adopt a validated client identifier.
    const parsedInitializeResult = IPC_INITIALIZE_RESULT_SCHEMA.safeParse(frame.result);
    if (parsedInitializeResult.success) {
      this.clientId = parsedInitializeResult.data.clientId;
    }
  }

  private rejectAllForOversizedFrame(frameSizeBytes: number): void {
    this.rejectAll(
      new DesktopIpcError(
        `${IPC_ERROR_MESSAGES.frameTooLargePrefix} (${String(frameSizeBytes)} > ${String(
          IPC_FRAME_BOUNDARY.maxFrameSizeBytes,
        )})`,
      ),
    );
    this.socket?.destroy();
  }

  private handleData(chunk: Buffer): void {
    this.frameBuffer.appendChunk(chunk);

    for (;;) {
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
        raw = parseIpcPayloadBuffer(readResult.payload);
      } catch {
        this.rejectAll(new DesktopIpcError(IPC_ERROR_MESSAGES.invalidJsonFrame));
        return;
      }

      let frame: IpcFrame;
      try {
        frame = parseIpcFrame(raw);
      } catch (error) {
        this.rejectAll(
          new DesktopIpcError(
            `${IPC_ERROR_MESSAGES.schemaValidationFailurePrefix}: ${formatIpcErrorMessage(error)}`,
          ),
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
    options: SendRequestOptions = {},
  ): void {
    const frame = IpcBroadcastFrameSchema.parse({
      type: IPC_FRAME_TYPES.broadcast,
      method,
      params,
      sourceClientId: this.sourceClientId(),
      targetClientId: options.targetClientId,
      version: options.version,
    });

    this.writeFrame(frame);
  }

  public async sendRequestAndWait(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {},
  ): Promise<IpcResponseFrame> {
    const requestId = randomUUID();

    const frame = IpcRequestFrameSchema.parse({
      type: IPC_FRAME_TYPES.request,
      requestId,
      method,
      params,
      sourceClientId: this.sourceClientId(),
      targetClientId: options.targetClientId,
      version: options.version,
    });

    const timeout = options.timeoutMs ?? this.requestTimeoutMs;
    const responsePromise = this.createPendingRequestPromise(
      requestId,
      method,
      timeout,
      `${IPC_ERROR_MESSAGES.requestTimeoutPrefix}: ${method}`,
    );

    this.writeRequestFrameOrReject(
      requestId,
      frame,
      `${IPC_ERROR_MESSAGES.requestWriteFailurePrefix} ${method}`,
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
        clientType: IPC_CLIENT.clientType,
      },
    });

    const responsePromise = this.createPendingRequestPromise(
      requestId,
      IPC_METHODS.initialize,
      this.requestTimeoutMs,
      IPC_ERROR_MESSAGES.initializeTimeout,
    );

    this.writeRequestFrameOrReject(requestId, frame, IPC_ERROR_MESSAGES.initializeWriteFailure);
    return responsePromise;
  }
}
