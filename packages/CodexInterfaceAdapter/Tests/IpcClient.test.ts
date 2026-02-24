import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { IpcResponseFrameSchema, type IpcFrame } from "@farfield/protocol";
import { DesktopIpcClient } from "../Source/IpcClient.js";

function buildSocketPath(): string {
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\farfield-ipc-test-${randomUUID()}`;
  }
  return path.join(os.tmpdir(), `ffipc-${randomUUID().slice(0, 8)}.sock`);
}

function encodeFrame(frame: IpcFrame): Buffer {
  const encodedPayload = Buffer.from(JSON.stringify(frame), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(encodedPayload.length, 0);
  return Buffer.concat([header, encodedPayload]);
}

async function writeBufferInChunks(
  socket: net.Socket,
  buffer: Buffer,
  chunkByteSize: number
): Promise<void> {
  let cursor = 0;
  while (cursor < buffer.length) {
    const nextCursor = Math.min(cursor + chunkByteSize, buffer.length);
    const chunk = buffer.subarray(cursor, nextCursor);
    await new Promise<void>((resolve, reject) => {
      socket.write(chunk, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    cursor = nextCursor;
  }
}

async function startSocketServer(socketPath: string): Promise<{
  server: net.Server;
  connectionPromise: Promise<net.Socket>;
}> {
  const server = net.createServer();
  const connectionPromise = new Promise<net.Socket>((resolve) => {
    server.once("connection", (socket) => {
      resolve(socket);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      resolve();
    });
  });
  return {
    server,
    connectionPromise
  };
}

async function waitForFrameCount(frameList: IpcFrame[], expectedCount: number): Promise<void> {
  const startTime = Date.now();
  while (frameList.length < expectedCount) {
    if (Date.now() - startTime > 1_000) {
      throw new Error(`Only received ${String(frameList.length)} frames; expected ${String(expectedCount)}.`);
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });
  }
}

describe("DesktopIpcClient", () => {
  it("parses multiple IPC frames delivered in small chunks", async () => {
    const socketPath = buildSocketPath();
    const { server, connectionPromise } = await startSocketServer(socketPath);
    const client = new DesktopIpcClient({
      socketPath
    });

    const receivedFrames: IpcFrame[] = [];
    const unsubscribe = client.onFrame((frame) => {
      receivedFrames.push(frame);
    });

    try {
      await client.connect();
      const serverSideSocket = await connectionPromise;

      const responseFrameOne = IpcResponseFrameSchema.parse({
        type: "response",
        requestId: "request-1",
        resultType: "success",
        result: {
          ok: true,
          index: 1
        }
      });
      const responseFrameTwo = IpcResponseFrameSchema.parse({
        type: "response",
        requestId: "request-2",
        resultType: "success",
        result: {
          ok: true,
          index: 2
        }
      });

      const encodedFrames = Buffer.concat([
        encodeFrame(responseFrameOne),
        encodeFrame(responseFrameTwo)
      ]);
      await writeBufferInChunks(serverSideSocket, encodedFrames, 7);

      await waitForFrameCount(receivedFrames, 2);
      const firstFrame = receivedFrames[0];
      const secondFrame = receivedFrames[1];
      if (!firstFrame || !secondFrame) {
        throw new Error("Expected two IPC frames");
      }

      expect(firstFrame).toMatchObject({
        type: "response",
        requestId: "request-1"
      });
      expect(secondFrame).toMatchObject({
        type: "response",
        requestId: "request-2"
      });
    } finally {
      unsubscribe();
      await client.disconnect();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      if (process.platform !== "win32" && fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
      }
    }
  });
});
