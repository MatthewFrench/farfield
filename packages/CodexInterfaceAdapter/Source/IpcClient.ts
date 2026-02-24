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
const INITIALIZING_CLIENT_ID = "initializing-client";
const InitializeResultSchema = z
  .object({
    clientId: z.string().min(1)
  })
  .passthrough();

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
    this.requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
  }

  public onFrame(listener: IpcFrameListener): () => void {
    this.events.on("frame", listener);
    return () => this.events.off("frame", listener);
  }

  public onConnectionState(listener: IpcConnectionListener): () => void {
    this.events.on("connection-state", listener);
    return () => this.events.off("connection-state", listener);
  }

  public isConnected(): boolean {
    return this.socket !== null;
  }

  public async connect(): Promise<void> {
    if (this.socket) {
      throw new DesktopIpcError("IPC client is already connected");
    }

    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);

      socket.once("connect", () => resolve(socket));
      socket.once("error", (error) => reject(new DesktopIpcError(error.message)));
    });

    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("close", () => {
      this.rejectAll(new DesktopIpcError("IPC socket closed"));
      this.socket = null;
      this.frameBuffer.clear();
      this.clientId = null;
      this.emitConnectionState({
        connected: false,
        reason: "IPC socket closed"
      });
    });
    this.socket.on("error", (error) => {
      this.rejectAll(new DesktopIpcError(`IPC socket error: ${error.message}`));
      this.emitConnectionState({
        connected: false,
        reason: `IPC socket error: ${error.message}`
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
    this.rejectAll(new DesktopIpcError("IPC client disconnected"));

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
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
      throw new DesktopIpcError("IPC socket is not connected");
    }
    return this.socket;
  }

  private emitFrame(frame: IpcFrame): void {
    this.events.emit("frame", frame);
  }

  private emitConnectionState(state: IpcConnectionState): void {
    this.events.emit("connection-state", state);
  }

  private writeFrame(frame: IpcFrame): void {
    const socket = this.ensureSocket();
    const encoded = Buffer.from(JSON.stringify(frame), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(encoded.length, 0);
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
      type: "client-discovery-response",
      requestId,
      response: {
        canHandle: false
      }
    });

    this.writeFrame(response);
  }

  private respondNoHandler(requestId: string): void {
    const response = IpcResponseFrameSchema.parse({
      type: "response",
      requestId,
      resultType: "error",
      error: "no-handler-for-request"
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
            `IPC frame exceeded limit (${String(readResult.size)} > ${String(MAX_FRAME_SIZE_BYTES)})`
          )
        );
        this.socket?.destroy();
        return;
      }

      const payloadBuffer = readResult.payload;

      let raw: JsonValue;
      try {
        raw = JsonValueSchema.parse(JSON.parse(payloadBuffer.toString("utf8")));
      } catch {
        this.rejectAll(new DesktopIpcError("IPC frame contained invalid JSON"));
        return;
      }

      let frame: IpcFrame;
      try {
        frame = parseIpcFrame(raw);
      } catch (error) {
        this.rejectAll(
          new DesktopIpcError(
            `IPC frame schema validation failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
        this.socket?.destroy();
        return;
      }
      this.emitFrame(frame);

      if (frame.type === "client-discovery-request") {
        this.respondClientDiscovery(frame.requestId);
        continue;
      }

      if (frame.type === "request") {
        this.respondNoHandler(frame.requestId);
        continue;
      }

      if (frame.type !== "response") {
        continue;
      }

      const pending = this.pending.get(frame.requestId);
      if (!pending) {
        continue;
      }

      this.pending.delete(frame.requestId);
      clearTimeout(pending.timer);

      if (frame.resultType === "error") {
        pending.reject(
          new DesktopIpcError(
            `IPC ${pending.method} failed: ${
              typeof frame.error === "string" ? frame.error : JSON.stringify(frame.error)
            }`
          )
        );
        continue;
      }

      if (frame.method === "initialize") {
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
      type: "broadcast",
      method,
      params,
      sourceClientId: this.clientId ?? INITIALIZING_CLIENT_ID,
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
      type: "request",
      requestId,
      method,
      params,
      sourceClientId: this.clientId ?? INITIALIZING_CLIENT_ID,
      targetClientId: options.targetClientId,
      version: options.version
    });

    const timeout = options.timeoutMs ?? this.requestTimeoutMs;

    const responsePromise = new Promise<IpcResponseFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new DesktopIpcError(`IPC request timed out: ${method}`));
      }, timeout);

      this.pending.set(requestId, {
        method,
        timer,
        resolve,
        reject
      });
    });

    try {
      this.writeFrame(frame);
    } catch (error) {
      this.rejectPendingRequestById(
        requestId,
        new DesktopIpcError(
          `IPC request write failed for ${method}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    }
    return responsePromise;
  }

  public async initialize(_userAgent: string): Promise<IpcResponseFrame> {
    const requestId = randomUUID();
    const frame = IpcRequestFrameSchema.parse({
      type: "request",
      requestId,
      sourceClientId: INITIALIZING_CLIENT_ID,
      version: 1,
      method: "initialize",
      params: {
        clientType: "farfield"
      }
    });

    const responsePromise = new Promise<IpcResponseFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new DesktopIpcError("IPC initialize request timed out"));
      }, this.requestTimeoutMs);

      this.pending.set(requestId, {
        method: "initialize",
        timer,
        resolve,
        reject
      });
    });

    try {
      this.writeFrame(frame);
    } catch (error) {
      this.rejectPendingRequestById(
        requestId,
        new DesktopIpcError(
          `IPC initialize write failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    }
    return responsePromise;
  }
}
