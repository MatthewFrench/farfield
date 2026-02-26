import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IpcClientDiscoveryRequestFrameSchema,
  IpcRequestFrameSchema,
  IpcResponseFrameSchema,
  JsonValueSchema,
  parseIpcFrame,
  type IpcFrame
} from "@farfield/protocol";
import { DesktopIpcClient } from "../Source/IpcClient.js";

const TEST_SOCKET_PATH = "/tmp/farfield-ipc-test.sock";
const MAX_FRAME_SIZE_BYTES = 256 * 1024 * 1024;

class InMemorySocket extends net.Socket {
  public readonly writes: Buffer[] = [];
  private nextWriteError: Error | null = null;

  public triggerConnect(): void {
    this.emit("connect");
  }

  public pushInboundData(buffer: Buffer): void {
    this.emit("data", buffer);
  }

  public setNextWriteError(error: Error): void {
    this.nextWriteError = error;
  }

  public triggerSocketError(message: string): void {
    this.emit("error", new Error(message));
  }

  public override write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error: Error | null | undefined) => void),
    maybeCallback?: (error: Error | null | undefined) => void
  ): boolean {
    const callback =
      typeof encodingOrCallback === "function" ? encodingOrCallback : maybeCallback;
    const encoding = typeof encodingOrCallback === "string" ? encodingOrCallback : undefined;

    if (this.nextWriteError) {
      const writeError = this.nextWriteError;
      this.nextWriteError = null;
      callback?.(writeError);
      throw writeError;
    }

    const encodedChunk = typeof chunk === "string" ? Buffer.from(chunk, encoding) : Buffer.from(chunk);
    this.writes.push(encodedChunk);
    callback?.(undefined);
    return true;
  }

  public override end(
    chunkOrCallback?: string | Uint8Array | (() => void),
    encodingOrCallback?: BufferEncoding | (() => void),
    maybeCallback?: () => void
  ): this {
    const callback =
      typeof chunkOrCallback === "function"
        ? chunkOrCallback
        : typeof encodingOrCallback === "function"
          ? encodingOrCallback
          : maybeCallback;
    callback?.();
    this.emit("close");
    return this;
  }

  public override destroy(error?: Error): this {
    if (error) {
      this.emit("error", error);
    }
    this.emit("close");
    return this;
  }
}

function encodeFrame(frame: IpcFrame): Buffer {
  const encodedPayload = Buffer.from(JSON.stringify(frame), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(encodedPayload.length, 0);
  return Buffer.concat([header, encodedPayload]);
}

function encodeRawJsonPayload(rawJson: string): Buffer {
  const encodedPayload = Buffer.from(rawJson, "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(encodedPayload.length, 0);
  return Buffer.concat([header, encodedPayload]);
}

function decodeFrameFromWrite(buffer: Buffer): IpcFrame {
  const payloadSize = buffer.readUInt32LE(0);
  const payload = buffer.subarray(4, 4 + payloadSize);
  const parsedPayload = JsonValueSchema.parse(JSON.parse(payload.toString("utf8")));
  return parseIpcFrame(parsedPayload);
}

function requireWrittenFrame(socket: InMemorySocket, writeIndex: number): IpcFrame {
  const writeBuffer = socket.writes[writeIndex];
  if (!writeBuffer) {
    throw new Error(`Expected write at index ${String(writeIndex)}`);
  }
  return decodeFrameFromWrite(writeBuffer);
}

function pushBufferInChunks(socket: InMemorySocket, buffer: Buffer, chunkByteSize: number): void {
  let cursor = 0;
  while (cursor < buffer.length) {
    const nextCursor = Math.min(cursor + chunkByteSize, buffer.length);
    socket.pushInboundData(buffer.subarray(cursor, nextCursor));
    cursor = nextCursor;
  }
}

async function connectClient(socket: InMemorySocket, requestTimeoutMs?: number): Promise<DesktopIpcClient> {
  vi.spyOn(net, "createConnection").mockReturnValue(socket);

  const client = new DesktopIpcClient({
    socketPath: TEST_SOCKET_PATH,
    ...(requestTimeoutMs ? { requestTimeoutMs } : {})
  });

  const connectPromise = client.connect();
  socket.triggerConnect();
  await connectPromise;

  return client;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("DesktopIpcClient", () => {
  it("sends requests and resolves pending promises for success responses", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait(
      "thread-follower-interrupt-turn",
      {
        conversationId: "thread-1"
      },
      {
        targetClientId: "owner-client",
        version: 7
      }
    );

    const requestFrame = requireWrittenFrame(socket, 0);
    expect(requestFrame).toMatchObject({
      type: "request",
      method: "thread-follower-interrupt-turn",
      sourceClientId: "initializing-client",
      targetClientId: "owner-client",
      version: 7
    });
    if (requestFrame.type !== "request") {
      throw new Error("Expected request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: "response",
          requestId: requestFrame.requestId,
          resultType: "success",
          result: {
            ok: true
          }
        })
      )
    );

    const response = await responsePromise;
    expect(response.resultType).toBe("success");

    await client.disconnect();
  });

  it("stores initialize client id and uses it for subsequent broadcasts", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const initializePromise = client.initialize("farfield-tests");
    const initializeRequestFrame = requireWrittenFrame(socket, 0);
    expect(initializeRequestFrame).toMatchObject({
      type: "request",
      method: "initialize",
      sourceClientId: "initializing-client",
      version: 1
    });
    if (initializeRequestFrame.type !== "request") {
      throw new Error("Expected initialize request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: "response",
          requestId: initializeRequestFrame.requestId,
          method: "initialize",
          resultType: "success",
          result: {
            clientId: "desktop-client-42"
          }
        })
      )
    );

    await initializePromise;

    client.sendBroadcast("thread-follower-subscribe", {
      conversationId: "thread-1"
    });
    const broadcastFrame = requireWrittenFrame(socket, 1);
    expect(broadcastFrame).toMatchObject({
      type: "broadcast",
      method: "thread-follower-subscribe",
      sourceClientId: "desktop-client-42"
    });

    await client.disconnect();
  });

  it("auto-responds to discovery and request frames while parsing chunked payloads", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const receivedFrames: IpcFrame[] = [];
    const unsubscribe = client.onFrame((frame) => {
      receivedFrames.push(frame);
    });

    const discoveryFrame = IpcClientDiscoveryRequestFrameSchema.parse({
      type: "client-discovery-request",
      requestId: "discovery-1",
      request: IpcRequestFrameSchema.parse({
        type: "request",
        requestId: "nested-1",
        method: "thread-follower-interrupt-turn",
        params: {
          conversationId: "thread-1"
        }
      })
    });

    const requestFrame = IpcRequestFrameSchema.parse({
      type: "request",
      requestId: "request-without-handler",
      method: "thread-follower-start-turn",
      params: {
        conversationId: "thread-1"
      }
    });

    pushBufferInChunks(
      socket,
      Buffer.concat([encodeFrame(discoveryFrame), encodeFrame(requestFrame)]),
      5
    );

    expect(receivedFrames).toHaveLength(2);
    expect(receivedFrames[0]).toMatchObject({
      type: "client-discovery-request",
      requestId: "discovery-1"
    });
    expect(receivedFrames[1]).toMatchObject({
      type: "request",
      requestId: "request-without-handler"
    });

    const discoveryResponseFrame = requireWrittenFrame(socket, 0);
    expect(discoveryResponseFrame).toMatchObject({
      type: "client-discovery-response",
      requestId: "discovery-1",
      response: {
        canHandle: false
      }
    });

    const noHandlerFrame = requireWrittenFrame(socket, 1);
    expect(noHandlerFrame).toMatchObject({
      type: "response",
      requestId: "request-without-handler",
      resultType: "error",
      error: "no-handler-for-request"
    });

    unsubscribe();
    await client.disconnect();
  });

  it("rejects request promises for response error frames", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait("thread-follower-submit-user-input", {});
    const requestFrame = requireWrittenFrame(socket, 0);
    if (requestFrame.type !== "request") {
      throw new Error("Expected request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: "response",
          requestId: requestFrame.requestId,
          resultType: "error",
          error: {
            reason: "permission denied"
          }
        })
      )
    );

    await expect(responsePromise).rejects.toThrowError(
      'IPC thread-follower-submit-user-input failed: {"reason":"permission denied"}'
    );

    await client.disconnect();
  });

  it("rejects timed out requests", async () => {
    vi.useFakeTimers();
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait("thread-follower-start-turn", {}, { timeoutMs: 10 });
    const timeoutExpectation = expect(responsePromise).rejects.toThrowError(
      "IPC request timed out: thread-follower-start-turn"
    );
    await vi.advanceTimersByTimeAsync(11);

    await timeoutExpectation;
    await client.disconnect();
  });

  it("rejects pending requests when socket closes and emits disconnect state", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);
    const connectionStates: { connected: boolean; reason?: string }[] = [];
    const unsubscribe = client.onConnectionState((state) => {
      connectionStates.push(state);
    });

    const responsePromise = client.sendRequestAndWait("thread-follower-start-turn", {});
    socket.emit("close");

    await expect(responsePromise).rejects.toThrowError("IPC socket closed");
    expect(client.isConnected()).toBe(false);
    expect(connectionStates).toEqual([
      {
        connected: false,
        reason: "IPC socket closed"
      }
    ]);

    unsubscribe();
  });

  it("rejects pending requests and emits state for socket error events", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);
    const connectionStates: { connected: boolean; reason?: string }[] = [];
    client.onConnectionState((state) => {
      connectionStates.push(state);
    });

    const responsePromise = client.sendRequestAndWait("thread-follower-start-turn", {});
    socket.triggerSocketError("stream reset");

    await expect(responsePromise).rejects.toThrowError("IPC socket error: stream reset");
    expect(connectionStates).toEqual([
      {
        connected: false,
        reason: "IPC socket error: stream reset"
      }
    ]);
  });

  it("rejects all pending requests when inbound payload contains invalid json", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait("thread-follower-start-turn", {});
    socket.pushInboundData(encodeRawJsonPayload("{ invalid-json"));

    await expect(responsePromise).rejects.toThrowError("IPC frame contained invalid JSON");
    await client.disconnect();
  });

  it("rejects all pending requests and closes the socket for schema-invalid frames", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);
    const connectionStates: { connected: boolean; reason?: string }[] = [];
    client.onConnectionState((state) => {
      connectionStates.push(state);
    });

    const responsePromise = client.sendRequestAndWait("thread-follower-start-turn", {});
    socket.pushInboundData(encodeRawJsonPayload(JSON.stringify({ invalid: true })));

    await expect(responsePromise).rejects.toThrowError(/IPC frame schema validation failed:/i);
    expect(client.isConnected()).toBe(false);
    expect(connectionStates).toEqual([
      {
        connected: false,
        reason: "IPC socket closed"
      }
    ]);
  });

  it("rejects all pending requests when frame length exceeds maximum size", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);
    const responsePromise = client.sendRequestAndWait("thread-follower-start-turn", {});

    const oversizedHeader = Buffer.alloc(4);
    oversizedHeader.writeUInt32LE(MAX_FRAME_SIZE_BYTES + 1, 0);
    socket.pushInboundData(oversizedHeader);

    await expect(responsePromise).rejects.toThrowError(
      `IPC frame exceeded limit (${String(MAX_FRAME_SIZE_BYTES + 1)} > ${String(MAX_FRAME_SIZE_BYTES)})`
    );
    expect(client.isConnected()).toBe(false);
  });

  it("maps write failures for request and initialize operations", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    socket.setNextWriteError(new Error("broken pipe"));
    await expect(client.sendRequestAndWait("thread-follower-start-turn", {})).rejects.toThrowError(
      "IPC request write failed for thread-follower-start-turn: broken pipe"
    );

    socket.setNextWriteError(new Error("broken pipe"));
    await expect(client.initialize("farfield-tests")).rejects.toThrowError(
      "IPC initialize write failed: broken pipe"
    );

    await client.disconnect();
  });

  it("throws when sending frames without an active socket connection", () => {
    const client = new DesktopIpcClient({
      socketPath: TEST_SOCKET_PATH
    });

    expect(() =>
      client.sendBroadcast("thread-follower-start-turn", {
        conversationId: "thread-1"
      })
    ).toThrowError("IPC socket is not connected");
  });

  it("rejects duplicate connect calls after a successful connect", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    await expect(client.connect()).rejects.toThrowError("IPC client is already connected");
    await client.disconnect();
  });

  it("maps initial connection errors to DesktopIpcError", async () => {
    const socket = new InMemorySocket();
    vi.spyOn(net, "createConnection").mockReturnValue(socket);

    const client = new DesktopIpcClient({
      socketPath: TEST_SOCKET_PATH
    });

    const connectPromise = client.connect();
    socket.emit("error", new Error("permission denied"));

    await expect(connectPromise).rejects.toThrowError("permission denied");
  });
});
