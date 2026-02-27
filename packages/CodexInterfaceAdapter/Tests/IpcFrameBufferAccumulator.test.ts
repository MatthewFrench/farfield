import { afterEach, describe, expect, it, vi } from "vitest";
import { IpcFrameBufferAccumulator } from "../Source/IpcFrameBufferAccumulator.js";

const FRAME_HEADER_BYTES = 4;
const FRAME_LENGTH_MAXIMUM_BYTES = 0xffff_ffff;
const BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES = 64 * 1024;
const INVALID_MAX_FRAME_SIZE_ERROR_MESSAGE = `IPC max frame size must be an integer between 0 and ${String(FRAME_LENGTH_MAXIMUM_BYTES)} bytes`;

function encodePayloadFrame(payloadText: string): Buffer {
  const payload = Buffer.from(payloadText, "utf8");
  return encodeBinaryPayloadFrame(payload);
}

function encodeBinaryPayloadFrame(payload: Buffer): Buffer {
  const header = Buffer.alloc(FRAME_HEADER_BYTES);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IpcFrameBufferAccumulator", () => {
  it("returns none until a full frame has been accumulated", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    const encodedFrame = encodePayloadFrame("hello");

    accumulator.appendChunk(encodedFrame.subarray(0, 2));
    expect(accumulator.readNextPayload(128)).toEqual({ type: "none" });

    accumulator.appendChunk(encodedFrame.subarray(2, 7));
    expect(accumulator.readNextPayload(128)).toEqual({ type: "none" });

    accumulator.appendChunk(encodedFrame.subarray(7));
    const payloadResult = accumulator.readNextPayload(128);
    expect(payloadResult.type).toBe("payload");
    if (payloadResult.type !== "payload") {
      throw new Error("Expected payload result");
    }
    expect(payloadResult.payload.toString("utf8")).toBe("hello");
    expect(accumulator.readNextPayload(128)).toEqual({ type: "none" });
  });

  it("reads multiple frames in-order from a single chunk", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    const combined = Buffer.concat([encodePayloadFrame("first"), encodePayloadFrame("second")]);

    accumulator.appendChunk(combined);

    const firstResult = accumulator.readNextPayload(128);
    const secondResult = accumulator.readNextPayload(128);

    expect(firstResult.type).toBe("payload");
    if (firstResult.type !== "payload") {
      throw new Error("Expected payload result for first frame");
    }

    expect(secondResult.type).toBe("payload");
    if (secondResult.type !== "payload") {
      throw new Error("Expected payload result for second frame");
    }

    expect(firstResult.payload.toString("utf8")).toBe("first");
    expect(secondResult.payload.toString("utf8")).toBe("second");
  });

  it("retains trailing bytes across append operations after a prior read", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    const firstFrame = encodePayloadFrame("alpha");
    const secondFrame = encodePayloadFrame("bravo");
    const firstWrite = Buffer.concat([firstFrame, secondFrame.subarray(0, 2)]);

    accumulator.appendChunk(firstWrite);

    const firstResult = accumulator.readNextPayload(128);
    expect(firstResult.type).toBe("payload");
    if (firstResult.type !== "payload") {
      throw new Error("Expected payload result for first frame");
    }
    expect(firstResult.payload.toString("utf8")).toBe("alpha");
    expect(accumulator.readNextPayload(128)).toEqual({ type: "none" });

    accumulator.appendChunk(secondFrame.subarray(2));

    const secondResult = accumulator.readNextPayload(128);
    expect(secondResult.type).toBe("payload");
    if (secondResult.type !== "payload") {
      throw new Error("Expected payload result for second frame");
    }
    expect(secondResult.payload.toString("utf8")).toBe("bravo");
    expect(accumulator.readNextPayload(128)).toEqual({ type: "none" });
  });

  it("reports oversized frames and preserves the encoded size", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    const oversizedHeader = Buffer.alloc(FRAME_HEADER_BYTES);
    oversizedHeader.writeUInt32LE(129, 0);

    accumulator.appendChunk(oversizedHeader);

    expect(accumulator.readNextPayload(128)).toEqual({
      type: "frame-too-large",
      size: 129,
    });
    expect(accumulator.readNextPayload(128)).toEqual({
      type: "frame-too-large",
      size: 129,
    });
  });

  it("throws when max frame size input is outside the supported range", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    accumulator.appendChunk(encodePayloadFrame("value"));

    const invalidMaxFrameSizes = [
      -1,
      1.25,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      FRAME_LENGTH_MAXIMUM_BYTES + 1,
    ];

    for (const invalidMaxFrameSize of invalidMaxFrameSizes) {
      expect(() => accumulator.readNextPayload(invalidMaxFrameSize)).toThrow(
        INVALID_MAX_FRAME_SIZE_ERROR_MESSAGE,
      );
    }
  });

  it("compacts unread bytes when consumed data reaches half the buffer", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    accumulator.appendChunk(Buffer.concat([encodePayloadFrame("abc"), encodePayloadFrame("def")]));

    const bufferFromSpy = vi.spyOn(Buffer, "from");
    bufferFromSpy.mockClear();

    const firstResult = accumulator.readNextPayload(128);
    expect(firstResult.type).toBe("payload");
    if (firstResult.type !== "payload") {
      throw new Error("Expected payload result for first frame");
    }

    expect(bufferFromSpy).toHaveBeenCalledTimes(1);

    const secondResult = accumulator.readNextPayload(128);
    expect(secondResult.type).toBe("payload");
    if (secondResult.type !== "payload") {
      throw new Error("Expected payload result for second frame");
    }
    expect(secondResult.payload.toString("utf8")).toBe("def");
  });

  it("compacts unread bytes after large consumed prefixes even when unread data is larger", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    const firstPayload = Buffer.alloc(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES, 65);
    const secondPayload = Buffer.alloc(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES + 1, 66);
    accumulator.appendChunk(
      Buffer.concat([
        encodeBinaryPayloadFrame(firstPayload),
        encodeBinaryPayloadFrame(secondPayload),
      ]),
    );

    const bufferFromSpy = vi.spyOn(Buffer, "from");
    bufferFromSpy.mockClear();

    const firstResult = accumulator.readNextPayload(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES * 4);
    expect(firstResult.type).toBe("payload");
    if (firstResult.type !== "payload") {
      throw new Error("Expected payload result for first frame");
    }
    expect(firstResult.payload.length).toBe(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES);
    expect(bufferFromSpy).toHaveBeenCalledTimes(1);

    const secondResult = accumulator.readNextPayload(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES * 4);
    expect(secondResult.type).toBe("payload");
    if (secondResult.type !== "payload") {
      throw new Error("Expected payload result for second frame");
    }
    expect(secondResult.payload.length).toBe(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES + 1);
  });

  it("does not compact for small consumed prefixes below both compaction thresholds", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    const firstPayload = Buffer.from("tiny", "utf8");
    const secondPayload = Buffer.alloc(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES, 67);
    accumulator.appendChunk(
      Buffer.concat([
        encodeBinaryPayloadFrame(firstPayload),
        encodeBinaryPayloadFrame(secondPayload),
      ]),
    );

    const bufferFromSpy = vi.spyOn(Buffer, "from");
    bufferFromSpy.mockClear();

    const firstResult = accumulator.readNextPayload(BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES * 2);
    expect(firstResult.type).toBe("payload");
    if (firstResult.type !== "payload") {
      throw new Error("Expected payload result");
    }
    expect(firstResult.payload.toString("utf8")).toBe("tiny");
    expect(bufferFromSpy).toHaveBeenCalledTimes(0);
  });

  it("drops buffered state when cleared", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    const staleFrame = encodePayloadFrame("stale-value");
    accumulator.appendChunk(staleFrame.subarray(0, FRAME_HEADER_BYTES - 1));
    accumulator.clear();

    accumulator.appendChunk(encodePayloadFrame("fresh-value"));
    const payloadResult = accumulator.readNextPayload(128);
    expect(payloadResult.type).toBe("payload");
    if (payloadResult.type !== "payload") {
      throw new Error("Expected payload result");
    }
    expect(payloadResult.payload.toString("utf8")).toBe("fresh-value");
    expect(accumulator.readNextPayload(128)).toEqual({ type: "none" });
  });
});
