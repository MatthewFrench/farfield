import { describe, expect, it } from "vitest";
import { ThreadIndex } from "../Source/Agents/ThreadIndex.js";

describe("ThreadIndex", () => {
  it("returns null for unknown thread identifiers", () => {
    const threadIndex = new ThreadIndex();

    expect(threadIndex.resolve("missing-thread")).toBeNull();
    expect(threadIndex.list()).toEqual([]);
  });

  it("stores and lists registered thread owners", () => {
    const threadIndex = new ThreadIndex();

    threadIndex.register("thread-a", "codex");
    threadIndex.register("thread-b", "opencode");

    expect(threadIndex.resolve("thread-a")).toBe("codex");
    expect(threadIndex.resolve("thread-b")).toBe("opencode");
    expect(threadIndex.list()).toEqual([
      { threadId: "thread-a", agentId: "codex" },
      { threadId: "thread-b", agentId: "opencode" },
    ]);
  });

  it("accepts idempotent registration for the same thread owner", () => {
    const threadIndex = new ThreadIndex();

    threadIndex.register("thread-a", "codex");
    threadIndex.register("thread-a", "codex");

    expect(threadIndex.resolve("thread-a")).toBe("codex");
  });

  it("rejects thread-owner reassignment to a different agent id", () => {
    const threadIndex = new ThreadIndex();

    threadIndex.register("thread-a", "codex");

    expect(() => threadIndex.register("thread-a", "opencode")).toThrowError(
      /already bound to codex/,
    );
  });
});
