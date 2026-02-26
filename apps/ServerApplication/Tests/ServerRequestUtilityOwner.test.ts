import { describe, expect, it } from "vitest";
import { ServerRequestUtilityOwner } from "../Source/Network/ServerRequestUtilityOwner.js";

describe("ServerRequestUtilityOwner", () => {
  it("parses positive integer values with default handling", () => {
    const owner = new ServerRequestUtilityOwner();

    expect(owner.parseInteger("42", 5)).toBe(42);
    expect(owner.parseInteger("0", 5)).toBe(5);
    expect(owner.parseInteger("-2", 5)).toBe(5);
    expect(owner.parseInteger("abc", 5)).toBe(5);
    expect(owner.parseInteger(null, 5)).toBe(5);
  });

  it("parses boolean values with strict accepted inputs", () => {
    const owner = new ServerRequestUtilityOwner();

    expect(owner.parseBoolean("1", false)).toBe(true);
    expect(owner.parseBoolean("true", false)).toBe(true);
    expect(owner.parseBoolean(" TRUE ", false)).toBe(true);
    expect(owner.parseBoolean("0", true)).toBe(false);
    expect(owner.parseBoolean("false", true)).toBe(false);
    expect(owner.parseBoolean("yes", true)).toBe(true);
    expect(owner.parseBoolean(null, false)).toBe(false);
  });

  it("parses agent identifiers and optional strings", () => {
    const owner = new ServerRequestUtilityOwner();

    expect(owner.parseAgentId("codex")).toBe("codex");
    expect(owner.parseAgentId("opencode")).toBe("opencode");
    expect(owner.parseAgentId(" CODEX ")).toBe("codex");
    expect(owner.parseAgentId("invalid")).toBeNull();
    expect(owner.parseAgentId(null)).toBeNull();

    expect(owner.normalizeOptionalString("  hello  ")).toBe("hello");
    expect(owner.normalizeOptionalString("   ")).toBeNull();
    expect(owner.normalizeOptionalString(null)).toBeNull();
  });

  it("wraps promises with timeout behavior", async () => {
    const owner = new ServerRequestUtilityOwner();

    await expect(
      owner.withTimeout(
        Promise.resolve("ok"),
        100,
        "fast"
      )
    ).resolves.toBe("ok");

    await expect(
      owner.withTimeout(
        new Promise((resolve) => {
          setTimeout(() => {
            resolve("late");
          }, 60);
        }),
        10,
        "slow"
      )
    ).rejects.toThrow("slow timed out after 10ms");
  });

  it("rejects invalid timeout inputs and invalid integer defaults", async () => {
    const owner = new ServerRequestUtilityOwner();

    expect(() => owner.parseInteger("5", 0)).toThrow();
    await expect(
      owner.withTimeout(Promise.resolve("ok"), 0, "invalid")
    ).rejects.toThrow();
    await expect(
      owner.withTimeout(Promise.resolve("ok"), 10, "   ")
    ).rejects.toThrow();
  });
});
