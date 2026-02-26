import { describe, expect, it } from "vitest";
import { buildDebugErrorSignature } from "../Source/Features/Debugging/DomainModel/DebugErrorSignature";

describe("DebugErrorSignature", () => {
  it("builds a versioned tuple signature for debug errors", () => {
    const signature = buildDebugErrorSignature({
      errorId: "error-7",
      recordedAt: "2026-02-26T00:00:01.000Z",
      message: "failed to refresh"
    });

    expect(signature).toBe("[\"v1\",\"error-7\",\"2026-02-26T00:00:01.000Z\",\"failed to refresh\"]");
  });

  it("avoids delimiter-collision ambiguity across fields", () => {
    const firstSignature = buildDebugErrorSignature({
      errorId: "a",
      recordedAt: "b",
      message: "c|d"
    });
    const secondSignature = buildDebugErrorSignature({
      errorId: "a|b",
      recordedAt: "c",
      message: "d"
    });

    expect(firstSignature).not.toBe(secondSignature);
  });
});
