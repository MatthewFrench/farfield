export type NextIpcPayloadReadResult =
  | { type: "none" }
  | { type: "frame-too-large"; size: number }
  | { type: "payload"; payload: Buffer };

const FRAME_LENGTH_HEADER_BYTES = 4;
const BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES = 64 * 1024;

/**
 * Owns framed IPC payload accumulation so DesktopIpcClient can focus on protocol behavior.
 * Frames are length-prefixed with a 4-byte little-endian header.
 */
export class IpcFrameBufferAccumulator {
  private buffer = Buffer.alloc(0);
  private bufferOffset = 0;

  public clear(): void {
    this.buffer = Buffer.alloc(0);
    this.bufferOffset = 0;
  }

  public appendChunk(chunk: Buffer): void {
    if (chunk.length === 0) {
      return;
    }

    if (this.buffer.length === 0 || this.bufferOffset === this.buffer.length) {
      this.buffer = Buffer.from(chunk);
      this.bufferOffset = 0;
      return;
    }

    if (this.bufferOffset > 0) {
      this.buffer = Buffer.from(this.buffer.subarray(this.bufferOffset));
      this.bufferOffset = 0;
    }

    this.buffer = Buffer.concat([this.buffer, chunk]);
  }

  public readNextPayload(maxFrameSizeBytes: number): NextIpcPayloadReadResult {
    if (this.getUnreadByteCount() < FRAME_LENGTH_HEADER_BYTES) {
      this.compactBufferIfNeeded();
      return { type: "none" };
    }

    const size = this.buffer.readUInt32LE(this.bufferOffset);
    if (size > maxFrameSizeBytes) {
      return {
        type: "frame-too-large",
        size
      };
    }

    if (this.getUnreadByteCount() < FRAME_LENGTH_HEADER_BYTES + size) {
      this.compactBufferIfNeeded();
      return { type: "none" };
    }

    const payloadStart = this.bufferOffset + FRAME_LENGTH_HEADER_BYTES;
    const payload = this.buffer.subarray(payloadStart, payloadStart + size);
    this.bufferOffset = payloadStart + size;
    this.compactBufferIfNeeded();

    return {
      type: "payload",
      payload
    };
  }

  private compactBufferIfNeeded(): void {
    if (this.bufferOffset === 0) {
      return;
    }

    if (this.bufferOffset >= this.buffer.length) {
      this.buffer = Buffer.alloc(0);
      this.bufferOffset = 0;
      return;
    }

    const hasConsumedAtLeastHalfOfBuffer = this.bufferOffset * 2 >= this.buffer.length;
    // Also compact for larger consumed prefixes even when unread data remains significant.
    const hasReachedCompactionByteThreshold =
      this.bufferOffset >= BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES;
    if (!hasConsumedAtLeastHalfOfBuffer && !hasReachedCompactionByteThreshold) {
      return;
    }

    this.buffer = Buffer.from(this.buffer.subarray(this.bufferOffset));
    this.bufferOffset = 0;
  }

  private getUnreadByteCount(): number {
    return this.buffer.length - this.bufferOffset;
  }
}
