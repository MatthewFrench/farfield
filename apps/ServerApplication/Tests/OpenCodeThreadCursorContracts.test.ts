import { describe, expect, it } from "vitest";
import {
  decodeOpenCodeThreadCursor,
  encodeOpenCodeThreadCursor
} from "../Source/Agents/Adapters/OpenCodeThreadCursorContracts.js";

describe("OpenCodeThreadCursorContracts", () => {
  it("encodes and decodes cursor offsets deterministically", () => {
    const encodedCursor = encodeOpenCodeThreadCursor(123);
    expect(decodeOpenCodeThreadCursor(encodedCursor)).toBe(123);
  });

  it("treats null and empty cursors as zero offset", () => {
    expect(decodeOpenCodeThreadCursor(null)).toBe(0);
    expect(decodeOpenCodeThreadCursor("")).toBe(0);
  });

  it("fails hard for malformed cursor payloads", () => {
    const malformedCursor = Buffer.from(JSON.stringify({ offset: 42 }), "utf8").toString("base64url");
    expect(() => decodeOpenCodeThreadCursor(malformedCursor)).toThrow();
  });
});
