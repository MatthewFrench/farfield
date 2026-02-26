import { describe, expect, it } from "vitest";
import { isCodexUnavailableBootstrapErrorMessage } from "../Source/Agents/Adapters/CodexConnectionLifecycleOwner.js";

describe("CodexConnectionLifecycleOwner", () => {
  it("classifies ENOENT process errors as codex unavailable", () => {
    expect(isCodexUnavailableBootstrapErrorMessage("app-server process error: spawn codex ENOENT")).toBe(true);
  });

  it("classifies not-found process errors as codex unavailable", () => {
    expect(isCodexUnavailableBootstrapErrorMessage("app-server process error: executable not found")).toBe(true);
  });

  it("does not classify unrelated transport errors as codex unavailable", () => {
    expect(isCodexUnavailableBootstrapErrorMessage("app-server transport closed")).toBe(false);
  });
});
