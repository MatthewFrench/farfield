import net from "node:net";
import {
  IpcClientDiscoveryRequestFrameSchema,
  type IpcFrame,
  IpcRequestFrameSchema,
  IpcResponseFrameSchema,
  JsonValueSchema,
  parseIpcFrame,
} from "@farfield/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopIpcClient } from "../Source/IpcClient.js";

const TEST_SOCKET_PATH = "/tmp/farfield-ipc-test.sock";
const MAX_FRAME_SIZE_BYTES = 256 * 1024 * 1024;
const IPC_FRAME_HEADER_SIZE_BYTES = 4;
const IPC_FRAME_HEADER_LENGTH_OFFSET_BYTES = 0;
const IPC_FRAME_PAYLOAD_ENCODING = "utf8";
const IPC_SOCKET_CONNECT_EVENT = "connect";
const IPC_SOCKET_DATA_EVENT = "data";
const IPC_SOCKET_CLOSE_EVENT = "close";
const IPC_SOCKET_ERROR_EVENT = "error";
const IPC_REQUEST_FRAME_TYPE = "request";
const IPC_RESPONSE_FRAME_TYPE = "response";
const IPC_BROADCAST_FRAME_TYPE = "broadcast";
const IPC_CLIENT_DISCOVERY_REQUEST_FRAME_TYPE = "client-discovery-request";
const IPC_CLIENT_DISCOVERY_RESPONSE_FRAME_TYPE = "client-discovery-response";
const IPC_SUCCESS_RESULT_TYPE = "success";
const IPC_ERROR_RESULT_TYPE = "error";
const IPC_INITIALIZE_METHOD = "initialize";
const IPC_INITIALIZING_SOURCE_CLIENT_ID = "initializing-client";
const IPC_PROTOCOL_VERSION = 1;
const IPC_NO_HANDLER_FOR_REQUEST_ERROR = "no-handler-for-request";
const REQUEST_METHOD_INTERRUPT_TURN = "thread-follower-interrupt-turn";
const REQUEST_METHOD_SUBSCRIBE = "thread-follower-subscribe";
const REQUEST_METHOD_START_TURN = "thread-follower-start-turn";
const REQUEST_METHOD_SUBMIT_USER_INPUT = "thread-follower-submit-user-input";
const IPC_SOCKET_CLOSED_REASON = "IPC socket closed";
const IPC_SOCKET_ERROR_PREFIX = "IPC socket error";
const IPC_INVALID_JSON_FRAME_ERROR = "IPC frame contained invalid JSON";
const IPC_REQUEST_TIMEOUT_ERROR_PREFIX = "IPC request timed out";
const IPC_REQUEST_WRITE_FAILURE_ERROR_PREFIX = "IPC request write failed for";
const IPC_INITIALIZE_WRITE_FAILURE_ERROR = "IPC initialize write failed";
const IPC_SOCKET_NOT_CONNECTED_ERROR = "IPC socket is not connected";
const IPC_ALREADY_CONNECTED_ERROR = "IPC client is already connected";
const BROKEN_PIPE_ERROR = "broken pipe";

class InMemorySocket extends net.Socket {
  public readonly writes: Buffer[] = [];
  private nextWriteError: Error | null = null;

  public triggerConnect(): void {
    this.emit(IPC_SOCKET_CONNECT_EVENT);
  }

  public pushInboundData(buffer: Buffer): void {
    this.emit(IPC_SOCKET_DATA_EVENT, buffer);
  }

  public setNextWriteError(error: Error): void {
    this.nextWriteError = error;
  }

  public triggerSocketError(message: string): void {
    this.emit(IPC_SOCKET_ERROR_EVENT, new Error(message));
  }

  public override write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error: Error | null | undefined) => void),
    maybeCallback?: (error: Error | null | undefined) => void,
  ): boolean {
    const callback = typeof encodingOrCallback === "function" ? encodingOrCallback : maybeCallback;
    const encoding = typeof encodingOrCallback === "string" ? encodingOrCallback : undefined;

    if (this.nextWriteError) {
      const writeError = this.nextWriteError;
      this.nextWriteError = null;
      callback?.(writeError);
      throw writeError;
    }

    const encodedChunk =
      typeof chunk === "string" ? Buffer.from(chunk, encoding) : Buffer.from(chunk);
    this.writes.push(encodedChunk);
    callback?.(undefined);
    return true;
  }

  public override end(
    chunkOrCallback?: string | Uint8Array | (() => void),
    encodingOrCallback?: BufferEncoding | (() => void),
    maybeCallback?: () => void,
  ): this {
    const callback =
      typeof chunkOrCallback === "function"
        ? chunkOrCallback
        : typeof encodingOrCallback === "function"
          ? encodingOrCallback
          : maybeCallback;
    callback?.();
    this.emit(IPC_SOCKET_CLOSE_EVENT);
    return this;
  }

  public override destroy(error?: Error): this {
    if (error) {
      this.emit(IPC_SOCKET_ERROR_EVENT, error);
    }
    this.emit(IPC_SOCKET_CLOSE_EVENT);
    return this;
  }
}

function encodeFrame(frame: IpcFrame): Buffer {
  const encodedPayload = Buffer.from(JSON.stringify(frame), IPC_FRAME_PAYLOAD_ENCODING);
  const header = Buffer.alloc(IPC_FRAME_HEADER_SIZE_BYTES);
  header.writeUInt32LE(encodedPayload.length, IPC_FRAME_HEADER_LENGTH_OFFSET_BYTES);
  return Buffer.concat([header, encodedPayload]);
}

function encodeRawJsonPayload(rawJson: string): Buffer {
  const encodedPayload = Buffer.from(rawJson, IPC_FRAME_PAYLOAD_ENCODING);
  const header = Buffer.alloc(IPC_FRAME_HEADER_SIZE_BYTES);
  header.writeUInt32LE(encodedPayload.length, IPC_FRAME_HEADER_LENGTH_OFFSET_BYTES);
  return Buffer.concat([header, encodedPayload]);
}

function decodeFrameFromWrite(buffer: Buffer): IpcFrame {
  const payloadSize = buffer.readUInt32LE(IPC_FRAME_HEADER_LENGTH_OFFSET_BYTES);
  const payload = buffer.subarray(
    IPC_FRAME_HEADER_SIZE_BYTES,
    IPC_FRAME_HEADER_SIZE_BYTES + payloadSize,
  );
  const parsedPayload = JsonValueSchema.parse(
    JSON.parse(payload.toString(IPC_FRAME_PAYLOAD_ENCODING)),
  );
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

async function connectClient(
  socket: InMemorySocket,
  requestTimeoutMs?: number,
): Promise<DesktopIpcClient> {
  vi.spyOn(net, "createConnection").mockReturnValue(socket);

  const client = new DesktopIpcClient({
    socketPath: TEST_SOCKET_PATH,
    ...(requestTimeoutMs ? { requestTimeoutMs } : {}),
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
      REQUEST_METHOD_INTERRUPT_TURN,
      {
        conversationId: "thread-1",
      },
      {
        targetClientId: "owner-client",
        version: 7,
      },
    );

    const requestFrame = requireWrittenFrame(socket, 0);
    expect(requestFrame).toMatchObject({
      type: IPC_REQUEST_FRAME_TYPE,
      method: REQUEST_METHOD_INTERRUPT_TURN,
      sourceClientId: IPC_INITIALIZING_SOURCE_CLIENT_ID,
      targetClientId: "owner-client",
      version: 7,
    });
    if (requestFrame.type !== IPC_REQUEST_FRAME_TYPE) {
      throw new Error("Expected request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: IPC_RESPONSE_FRAME_TYPE,
          requestId: requestFrame.requestId,
          resultType: IPC_SUCCESS_RESULT_TYPE,
          result: {
            ok: true,
          },
        }),
      ),
    );

    const response = await responsePromise;
    expect(response.resultType).toBe(IPC_SUCCESS_RESULT_TYPE);

    await client.disconnect();
  });

  it("stores initialize client id and uses it for subsequent broadcasts", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const initializePromise = client.initialize("farfield-tests");
    const initializeRequestFrame = requireWrittenFrame(socket, 0);
    expect(initializeRequestFrame).toMatchObject({
      type: IPC_REQUEST_FRAME_TYPE,
      method: IPC_INITIALIZE_METHOD,
      sourceClientId: IPC_INITIALIZING_SOURCE_CLIENT_ID,
      version: IPC_PROTOCOL_VERSION,
    });
    if (initializeRequestFrame.type !== IPC_REQUEST_FRAME_TYPE) {
      throw new Error("Expected initialize request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: IPC_RESPONSE_FRAME_TYPE,
          requestId: initializeRequestFrame.requestId,
          method: IPC_INITIALIZE_METHOD,
          resultType: IPC_SUCCESS_RESULT_TYPE,
          result: {
            clientId: "desktop-client-42",
          },
        }),
      ),
    );

    await initializePromise;

    client.sendBroadcast(REQUEST_METHOD_SUBSCRIBE, {
      conversationId: "thread-1",
    });
    const broadcastFrame = requireWrittenFrame(socket, 1);
    expect(broadcastFrame).toMatchObject({
      type: IPC_BROADCAST_FRAME_TYPE,
      method: REQUEST_METHOD_SUBSCRIBE,
      sourceClientId: "desktop-client-42",
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
      type: IPC_CLIENT_DISCOVERY_REQUEST_FRAME_TYPE,
      requestId: "discovery-1",
      request: IpcRequestFrameSchema.parse({
        type: IPC_REQUEST_FRAME_TYPE,
        requestId: "nested-1",
        method: REQUEST_METHOD_INTERRUPT_TURN,
        params: {
          conversationId: "thread-1",
        },
      }),
    });

    const requestFrame = IpcRequestFrameSchema.parse({
      type: IPC_REQUEST_FRAME_TYPE,
      requestId: "request-without-handler",
      method: REQUEST_METHOD_START_TURN,
      params: {
        conversationId: "thread-1",
      },
    });

    pushBufferInChunks(
      socket,
      Buffer.concat([encodeFrame(discoveryFrame), encodeFrame(requestFrame)]),
      5,
    );

    expect(receivedFrames).toHaveLength(2);
    expect(receivedFrames[0]).toMatchObject({
      type: IPC_CLIENT_DISCOVERY_REQUEST_FRAME_TYPE,
      requestId: "discovery-1",
    });
    expect(receivedFrames[1]).toMatchObject({
      type: IPC_REQUEST_FRAME_TYPE,
      requestId: "request-without-handler",
    });

    const discoveryResponseFrame = requireWrittenFrame(socket, 0);
    expect(discoveryResponseFrame).toMatchObject({
      type: IPC_CLIENT_DISCOVERY_RESPONSE_FRAME_TYPE,
      requestId: "discovery-1",
      response: {
        canHandle: false,
      },
    });

    const noHandlerFrame = requireWrittenFrame(socket, 1);
    expect(noHandlerFrame).toMatchObject({
      type: IPC_RESPONSE_FRAME_TYPE,
      requestId: "request-without-handler",
      resultType: IPC_ERROR_RESULT_TYPE,
      error: IPC_NO_HANDLER_FOR_REQUEST_ERROR,
    });

    unsubscribe();
    await client.disconnect();
  });

  it("rejects request promises for response error frames", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_SUBMIT_USER_INPUT, {});
    const requestFrame = requireWrittenFrame(socket, 0);
    if (requestFrame.type !== IPC_REQUEST_FRAME_TYPE) {
      throw new Error("Expected request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: IPC_RESPONSE_FRAME_TYPE,
          requestId: requestFrame.requestId,
          resultType: IPC_ERROR_RESULT_TYPE,
          error: {
            reason: "permission denied",
          },
        }),
      ),
    );

    await expect(responsePromise).rejects.toThrowError(
      `IPC ${REQUEST_METHOD_SUBMIT_USER_INPUT} failed: {"reason":"permission denied"}`,
    );

    await client.disconnect();
  });

  it("formats primitive response error payloads in rejection messages", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_SUBMIT_USER_INPUT, {});
    const requestFrame = requireWrittenFrame(socket, 0);
    if (requestFrame.type !== IPC_REQUEST_FRAME_TYPE) {
      throw new Error("Expected request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: IPC_RESPONSE_FRAME_TYPE,
          requestId: requestFrame.requestId,
          resultType: IPC_ERROR_RESULT_TYPE,
          error: false,
        }),
      ),
    );

    await expect(responsePromise).rejects.toThrowError(
      `IPC ${REQUEST_METHOD_SUBMIT_USER_INPUT} failed: false`,
    );

    await client.disconnect();
  });

  it("ignores unmatched response frames until matching request ids arrive", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_START_TURN, {});
    const requestFrame = requireWrittenFrame(socket, 0);
    if (requestFrame.type !== IPC_REQUEST_FRAME_TYPE) {
      throw new Error("Expected request frame");
    }

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: IPC_RESPONSE_FRAME_TYPE,
          requestId: "different-request-id",
          resultType: IPC_SUCCESS_RESULT_TYPE,
          result: {
            ignored: true,
          },
        }),
      ),
    );

    socket.pushInboundData(
      encodeFrame(
        IpcResponseFrameSchema.parse({
          type: IPC_RESPONSE_FRAME_TYPE,
          requestId: requestFrame.requestId,
          resultType: IPC_SUCCESS_RESULT_TYPE,
          result: {
            ok: true,
          },
        }),
      ),
    );

    const response = await responsePromise;
    expect(response.resultType).toBe(IPC_SUCCESS_RESULT_TYPE);

    await client.disconnect();
  });

  it("rejects timed out requests", async () => {
    vi.useFakeTimers();
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait(
      REQUEST_METHOD_START_TURN,
      {},
      { timeoutMs: 10 },
    );
    const timeoutExpectation = expect(responsePromise).rejects.toThrowError(
      `${IPC_REQUEST_TIMEOUT_ERROR_PREFIX}: ${REQUEST_METHOD_START_TURN}`,
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

    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_START_TURN, {});
    socket.emit(IPC_SOCKET_CLOSE_EVENT);

    await expect(responsePromise).rejects.toThrowError(IPC_SOCKET_CLOSED_REASON);
    expect(client.isConnected()).toBe(false);
    expect(connectionStates).toEqual([
      {
        connected: false,
        reason: IPC_SOCKET_CLOSED_REASON,
      },
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

    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_START_TURN, {});
    socket.triggerSocketError("stream reset");

    await expect(responsePromise).rejects.toThrowError(`${IPC_SOCKET_ERROR_PREFIX}: stream reset`);
    expect(connectionStates).toEqual([
      {
        connected: false,
        reason: `${IPC_SOCKET_ERROR_PREFIX}: stream reset`,
      },
    ]);
  });

  it("rejects all pending requests when inbound payload contains invalid json", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_START_TURN, {});
    socket.pushInboundData(encodeRawJsonPayload("{ invalid-json"));

    await expect(responsePromise).rejects.toThrowError(IPC_INVALID_JSON_FRAME_ERROR);
    await client.disconnect();
  });

  it("rejects all pending requests and closes the socket for schema-invalid frames", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);
    const connectionStates: { connected: boolean; reason?: string }[] = [];
    client.onConnectionState((state) => {
      connectionStates.push(state);
    });

    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_START_TURN, {});
    socket.pushInboundData(encodeRawJsonPayload(JSON.stringify({ invalid: true })));

    await expect(responsePromise).rejects.toThrowError(/IPC frame schema validation failed:/i);
    expect(client.isConnected()).toBe(false);
    expect(connectionStates).toEqual([
      {
        connected: false,
        reason: IPC_SOCKET_CLOSED_REASON,
      },
    ]);
  });

  it("rejects all pending requests when frame length exceeds maximum size", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);
    const responsePromise = client.sendRequestAndWait(REQUEST_METHOD_START_TURN, {});

    const oversizedHeader = Buffer.alloc(IPC_FRAME_HEADER_SIZE_BYTES);
    oversizedHeader.writeUInt32LE(MAX_FRAME_SIZE_BYTES + 1, IPC_FRAME_HEADER_LENGTH_OFFSET_BYTES);
    socket.pushInboundData(oversizedHeader);

    await expect(responsePromise).rejects.toThrowError(
      `IPC frame exceeded limit (${String(MAX_FRAME_SIZE_BYTES + 1)} > ${String(MAX_FRAME_SIZE_BYTES)})`,
    );
    expect(client.isConnected()).toBe(false);
  });

  it("maps write failures for request and initialize operations", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    socket.setNextWriteError(new Error(BROKEN_PIPE_ERROR));
    await expect(client.sendRequestAndWait(REQUEST_METHOD_START_TURN, {})).rejects.toThrowError(
      `${IPC_REQUEST_WRITE_FAILURE_ERROR_PREFIX} ${REQUEST_METHOD_START_TURN}: ${BROKEN_PIPE_ERROR}`,
    );

    socket.setNextWriteError(new Error(BROKEN_PIPE_ERROR));
    await expect(client.initialize("farfield-tests")).rejects.toThrowError(
      `${IPC_INITIALIZE_WRITE_FAILURE_ERROR}: ${BROKEN_PIPE_ERROR}`,
    );

    await client.disconnect();
  });

  it("throws when sending frames without an active socket connection", () => {
    const client = new DesktopIpcClient({
      socketPath: TEST_SOCKET_PATH,
    });

    expect(() =>
      client.sendBroadcast(REQUEST_METHOD_START_TURN, {
        conversationId: "thread-1",
      }),
    ).toThrowError(IPC_SOCKET_NOT_CONNECTED_ERROR);
  });

  it("rejects duplicate connect calls after a successful connect", async () => {
    const socket = new InMemorySocket();
    const client = await connectClient(socket);

    await expect(client.connect()).rejects.toThrowError(IPC_ALREADY_CONNECTED_ERROR);
    await client.disconnect();
  });

  it("maps initial connection errors to DesktopIpcError", async () => {
    const socket = new InMemorySocket();
    vi.spyOn(net, "createConnection").mockReturnValue(socket);

    const client = new DesktopIpcClient({
      socketPath: TEST_SOCKET_PATH,
    });

    const connectPromise = client.connect();
    socket.emit(IPC_SOCKET_ERROR_EVENT, new Error("permission denied"));

    await expect(connectPromise).rejects.toThrowError("permission denied");
  });
});
