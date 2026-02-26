import { describe, expect, it } from "vitest";
import { ThreadListStateStore } from "@/Features/Threads/StateManagement/ThreadListStateStore";
import type { ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

function buildThreads(): ThreadListItem[] {
  return [
    {
      id: "thread-opencode",
      preview: "OpenCode thread",
      createdAt: 1_735_000_000_000,
      updatedAt: 1_735_000_000_100,
      cwd: "/tmp/thread-state-store",
      path: "/tmp/thread-state-store",
      agentId: "opencode"
    },
    {
      id: "thread-codex",
      preview: "Codex thread",
      createdAt: 1_735_000_000_001,
      updatedAt: 1_735_000_000_101,
      cwd: "/tmp/thread-state-store",
      path: "/tmp/thread-state-store",
      agentId: "codex"
    }
  ];
}

describe("ThreadListStateStore", () => {
  it("resets one-time initial selection hydration so preferred-agent selection can run again", () => {
    const store = new ThreadListStateStore();
    const nextThreads = buildThreads();

    const initialSelection = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "codex",
      nextThreads
    });
    expect(initialSelection).toBe("thread-codex");

    const secondSelectionWithoutReset = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "opencode",
      nextThreads
    });
    expect(secondSelectionWithoutReset).toBeNull();

    store.resetState();

    const selectionAfterReset = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "opencode",
      nextThreads
    });
    expect(selectionAfterReset).toBe("thread-opencode");
  });
});
