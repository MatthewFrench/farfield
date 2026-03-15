import { type IpcFrame, type JsonValue, JsonValueSchema } from "@farfield/protocol";
import { IPC_FRAME_BOUNDARY } from "./IpcClientConstants.js";

/**
 * Owns IPC frame byte encoding and JSON payload parsing boundaries.
 */
export function encodeIpcFrame(frame: IpcFrame): Buffer {
  const encodedPayload = Buffer.from(JSON.stringify(frame), IPC_FRAME_BOUNDARY.payloadEncoding);
  const header = Buffer.alloc(IPC_FRAME_BOUNDARY.headerSizeBytes);
  header.writeUInt32LE(encodedPayload.length, IPC_FRAME_BOUNDARY.headerLengthOffsetBytes);
  return Buffer.concat([header, encodedPayload]);
}

export function parseIpcPayloadBuffer(payloadBuffer: Buffer): JsonValue {
  const payloadText = payloadBuffer.toString(IPC_FRAME_BOUNDARY.payloadEncoding);
  return JsonValueSchema.parse(JSON.parse(payloadText));
}
