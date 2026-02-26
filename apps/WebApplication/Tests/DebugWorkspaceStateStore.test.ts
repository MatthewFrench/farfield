import { describe, expect, it } from "vitest";
import { DebugWorkspaceStateStore } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore";

function createHistoryEntry(entryId: string): {
  id: string;
  at: string;
  source: "ipc" | "app" | "system";
  direction: "in" | "out" | "system";
  payload: Record<string, string>;
  meta: Record<string, string>;
} {
  return {
    id: entryId,
    at: "2026-02-23T00:00:00.000Z",
    source: "app",
    direction: "in",
    payload: {},
    meta: {}
  };
}

describe("DebugWorkspaceStateStore", () => {
  it("reuses existing history state when length and tail identifier are unchanged", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = [
      createHistoryEntry("history-1"),
      createHistoryEntry("history-2")
    ];
    const nextHistory = [
      createHistoryEntry("history-1"),
      createHistoryEntry("history-2")
    ];

    const result = store.readNextHistory(previousHistory, nextHistory);

    expect(result).toBe(previousHistory);
  });

  it("uses incoming history when shape changed", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = [
      createHistoryEntry("history-1")
    ];
    const nextHistory = [
      createHistoryEntry("history-1"),
      createHistoryEntry("history-2")
    ];

    const result = store.readNextHistory(previousHistory, nextHistory);

    expect(result).toBe(nextHistory);
  });

  it("uses incoming history when first identifier changes even if tail matches", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = [
      createHistoryEntry("history-1"),
      createHistoryEntry("history-2")
    ];
    const nextHistory = [
      createHistoryEntry("history-9"),
      createHistoryEntry("history-2")
    ];

    const result = store.readNextHistory(previousHistory, nextHistory);

    expect(result).toBe(nextHistory);
  });

  it("detects changed debug error signatures", () => {
    const store = new DebugWorkspaceStateStore();

    expect(store.shouldApplyDebugErrors(["error-1", "error-2"], ["error-1", "error-2"])).toBe(false);
    expect(store.shouldApplyDebugErrors(["error-1", "error-2"], ["error-1", "error-3"])).toBe(true);
  });
});
