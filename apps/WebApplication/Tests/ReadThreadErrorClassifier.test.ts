import { describe, expect, it } from "vitest";
import {
  isThreadNotLoadedReadError,
  isTransientReadThreadError,
} from "../Source/Features/Chat/DomainModel/ReadThreadErrorClassifier";

describe("ReadThreadErrorClassifier", () => {
  it("identifies transient read-thread errors", () => {
    expect(isTransientReadThreadError("failed to load rollout abc is empty")).toBe(true);
    expect(isTransientReadThreadError("thread not loaded in app-server")).toBe(true);
    expect(
      isTransientReadThreadError(
        "app-server error -32600: thread abc is not materialized yet; includeTurns is unavailable before first user message",
      ),
    ).toBe(true);
    expect(isTransientReadThreadError("conversation not found")).toBe(true);
    expect(isTransientReadThreadError("permission denied")).toBe(false);
  });

  it("identifies thread-not-loaded errors specifically", () => {
    expect(isThreadNotLoadedReadError("thread not loaded in app-server")).toBe(true);
    expect(isThreadNotLoadedReadError("conversation not found")).toBe(false);
  });
});
