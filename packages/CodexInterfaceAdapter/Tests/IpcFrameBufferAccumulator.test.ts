import { describe, expect, it } from "vitest";
import { IpcFrameBufferAccumulator } from "../Source/IpcFrameBufferAccumulator.js";

const FRAME_HEADER_BYTES = 4;

function encodePayloadFrame(payloadText: string): Buffer {
  const payload = Buffer.from(payloadText, "utf8");
  const header = Buffer.alloc(FRAME_HEADER_BYTES);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

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
    const combined = Buffer.concat([
      encodePayloadFrame("first"),
      encodePayloadFrame("second")
    ]);

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
      size: 129
    });
    expect(accumulator.readNextPayload(128)).toEqual({
      type: "frame-too-large",
      size: 129
    });
  });

  it("drops buffered state when cleared", () => {
    const accumulator = new IpcFrameBufferAccumulator();
    accumulator.appendChunk(encodePayloadFrame("value"));
    accumulator.clear();

    expect(accumulator.readNextPayload(128)).toEqual({ type: "none" });
  });
});
