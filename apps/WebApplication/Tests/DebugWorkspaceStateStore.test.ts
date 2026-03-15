import { describe, expect, it } from "vitest";
import { DebugWorkspaceStateStore } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore";

type DebugHistoryEntry = {
  id: string;
  at: string;
  source: "ipc" | "app" | "system";
  direction: "in" | "out" | "system";
  payload: Record<string, string>;
  meta: Record<string, string>;
};

function createHistoryEntry(entryId: string): DebugHistoryEntry {
  return {
    id: entryId,
    at: "2026-02-23T00:00:00.000Z",
    source: "app",
    direction: "in",
    payload: {},
    meta: {},
  };
}

function createHistoryCollection(entryCount: number): DebugHistoryEntry[] {
  return Array.from({ length: entryCount }, (_value, index) =>
    createHistoryEntry(`history-${String(index)}`),
  );
}

describe("DebugWorkspaceStateStore", () => {
  it("reuses existing history state when length and tail identifier are unchanged", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = [createHistoryEntry("history-1"), createHistoryEntry("history-2")];
    const nextHistory = [createHistoryEntry("history-1"), createHistoryEntry("history-2")];

    const result = store.readNextHistory(previousHistory, nextHistory);

    expect(result).toBe(previousHistory);
  });

  it("uses incoming history when shape changed", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = [createHistoryEntry("history-1")];
    const nextHistory = [createHistoryEntry("history-1"), createHistoryEntry("history-2")];

    const result = store.readNextHistory(previousHistory, nextHistory);

    expect(result).toBe(nextHistory);
  });

  it("uses incoming history when first identifier changes even if tail matches", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = [createHistoryEntry("history-1"), createHistoryEntry("history-2")];
    const nextHistory = [createHistoryEntry("history-9"), createHistoryEntry("history-2")];

    const result = store.readNextHistory(previousHistory, nextHistory);

    expect(result).toBe(nextHistory);
  });

  it("reuses previous large history collection when first and tail identifiers match", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = createHistoryCollection(2_500);
    const nextHistory = createHistoryCollection(2_500);
    nextHistory[1_200] = createHistoryEntry("history-middle-replaced");

    const result = store.readNextHistory(previousHistory, nextHistory);
    const previousMiddleHistoryEntry = previousHistory[1_200];
    const nextMiddleHistoryEntry = nextHistory[1_200];
    if (previousMiddleHistoryEntry === undefined) {
      throw new Error("Expected middle history entries to be present");
    }

    expect(previousMiddleHistoryEntry.id).toBe("history-1200");
    expect(nextMiddleHistoryEntry.id).toBe("history-middle-replaced");
    expect(result).toBe(previousHistory);
  });

  it("uses incoming large history collection when tail identifier changes", () => {
    const store = new DebugWorkspaceStateStore();
    const previousHistory = createHistoryCollection(2_500);
    const nextHistory = createHistoryCollection(2_500);
    nextHistory[2_499] = createHistoryEntry("history-tail-replaced");

    const result = store.readNextHistory(previousHistory, nextHistory);

    expect(result).toBe(nextHistory);
  });

  it("detects changed debug error signatures", () => {
    const store = new DebugWorkspaceStateStore();

    expect(store.shouldApplyDebugErrors(["error-1", "error-2"], ["error-1", "error-2"])).toBe(
      false,
    );
    expect(store.shouldApplyDebugErrors(["error-1", "error-2"], ["error-1", "error-3"])).toBe(true);
  });
});
