export type NextIpcPayloadReadResult =
  | { type: "none" }
  | { type: "frame-too-large"; size: number }
  | { type: "payload"; payload: Buffer };

const FRAME_LENGTH_HEADER_BYTES = 4;
const FRAME_LENGTH_HEADER_OFFSET_BYTES = 0;
const FRAME_LENGTH_MAXIMUM_BYTES = 0xffff_ffff;
const FRAME_SIZE_LIMIT_MINIMUM_BYTES = 0;
const BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES = 64 * 1024;
const BUFFER_COMPACTION_CONSUMED_RATIO_MULTIPLIER = 2;
const INVALID_MAX_FRAME_SIZE_ERROR_MESSAGE =
  `IPC max frame size must be an integer between ${String(FRAME_SIZE_LIMIT_MINIMUM_BYTES)} and ` +
  `${String(FRAME_LENGTH_MAXIMUM_BYTES)} bytes`;

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
    this.assertMaxFrameSizeBytes(maxFrameSizeBytes);

    if (!this.hasCompleteFrameLengthHeader()) {
      this.compactBufferIfNeeded();
      return { type: "none" };
    }

    const size = this.readFramePayloadSizeBytes();
    if (size > maxFrameSizeBytes) {
      return {
        type: "frame-too-large",
        size,
      };
    }

    if (!this.hasCompleteFramePayload(size)) {
      this.compactBufferIfNeeded();
      return { type: "none" };
    }

    const payloadStart = this.bufferOffset + FRAME_LENGTH_HEADER_BYTES;
    const payload = this.buffer.subarray(payloadStart, payloadStart + size);
    this.bufferOffset = payloadStart + size;
    this.compactBufferIfNeeded();

    return {
      type: "payload",
      payload,
    };
  }

  private compactBufferIfNeeded(): void {
    if (this.bufferOffset === 0) {
      return;
    }

    if (this.bufferOffset >= this.buffer.length) {
      this.clear();
      return;
    }

    if (!this.shouldCompactBuffer()) {
      return;
    }

    this.buffer = Buffer.from(this.buffer.subarray(this.bufferOffset));
    this.bufferOffset = 0;
  }

  private hasCompleteFrameLengthHeader(): boolean {
    return this.getUnreadByteCount() >= FRAME_LENGTH_HEADER_BYTES;
  }

  private readFramePayloadSizeBytes(): number {
    return this.buffer.readUInt32LE(this.bufferOffset + FRAME_LENGTH_HEADER_OFFSET_BYTES);
  }

  private hasCompleteFramePayload(size: number): boolean {
    return this.getUnreadByteCount() >= FRAME_LENGTH_HEADER_BYTES + size;
  }

  private shouldCompactBuffer(): boolean {
    const hasConsumedAtLeastHalfOfBuffer =
      this.bufferOffset * BUFFER_COMPACTION_CONSUMED_RATIO_MULTIPLIER >= this.buffer.length;
    if (hasConsumedAtLeastHalfOfBuffer) {
      return true;
    }

    // Protects against retaining very large consumed prefixes after partial frame reads.
    return this.bufferOffset >= BUFFER_COMPACTION_MINIMUM_CONSUMED_BYTES;
  }

  private assertMaxFrameSizeBytes(maxFrameSizeBytes: number): void {
    if (
      Number.isInteger(maxFrameSizeBytes) &&
      maxFrameSizeBytes >= FRAME_SIZE_LIMIT_MINIMUM_BYTES &&
      maxFrameSizeBytes <= FRAME_LENGTH_MAXIMUM_BYTES
    ) {
      return;
    }

    throw new RangeError(INVALID_MAX_FRAME_SIZE_ERROR_MESSAGE);
  }

  private getUnreadByteCount(): number {
    return this.buffer.length - this.bufferOffset;
  }
}
