import { describe, expect, it } from "vitest";
import type { ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListStateStore } from "@/Features/Threads/StateManagement/ThreadListStateStore";

interface ThreadFixtureInput {
  id: string;
  preview?: string;
  createdAt?: number;
  updatedAt?: number;
  cwd?: string;
  path?: string | null;
  agentId?: ThreadListItem["agentId"];
}

function buildThread(input: ThreadFixtureInput): ThreadListItem {
  return {
    id: input.id,
    preview: input.preview ?? `preview-${input.id}`,
    createdAt: input.createdAt ?? 1_735_000_000_000,
    updatedAt: input.updatedAt ?? 1_735_000_000_100,
    cwd: input.cwd ?? "/tmp/thread-state-store",
    path: input.path ?? "/tmp/thread-state-store",
    agentId: input.agentId ?? "codex",
  };
}

function buildSelectionThreads(): ThreadListItem[] {
  return [
    buildThread({
      id: "thread-opencode",
      preview: "OpenCode thread",
      createdAt: 1_735_000_000_000,
      updatedAt: 1_735_000_000_100,
      agentId: "opencode",
    }),
    buildThread({
      id: "thread-codex",
      preview: "Codex thread",
      createdAt: 1_735_000_000_001,
      updatedAt: 1_735_000_000_101,
      agentId: "codex",
    }),
  ];
}

describe("ThreadListStateStore", () => {
  it("resets one-time initial selection hydration so preferred-agent selection can run again", () => {
    const store = new ThreadListStateStore();
    const nextThreads = buildSelectionThreads();

    const initialSelection = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "codex",
      nextThreads,
    });
    expect(initialSelection).toBe("thread-codex");

    const secondSelectionWithoutReset = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "opencode",
      nextThreads,
    });
    expect(secondSelectionWithoutReset).toBeNull();

    store.resetState();

    const selectionAfterReset = store.computeInitialSelectedThreadIdentifier({
      currentSelectedThreadIdentifier: null,
      preferredAgentIdentifier: "opencode",
      nextThreads,
    });
    expect(selectionAfterReset).toBe("thread-opencode");
  });

  it("treats unchanged active thread signatures as stable across refreshes", () => {
    const store = new ThreadListStateStore();
    const firstThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-alpha",
        preview: "Alpha",
        updatedAt: 100,
        cwd: "/workspace/alpha",
        path: "/workspace/alpha",
        agentId: "codex",
      }),
      buildThread({
        id: "thread-beta",
        preview: "Beta",
        updatedAt: 200,
        cwd: "/workspace/beta",
        path: "/workspace/beta",
        agentId: "opencode",
      }),
    ];

    const firstResult = store.computeActiveThreadState({
      nextThreads: firstThreads,
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: null,
    });
    expect(firstResult.didChangeThreads).toBe(true);
    expect(firstResult.nextUnreadThreadIdentifiers).toEqual({});

    const secondThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-alpha",
        preview: "Alpha",
        updatedAt: 100,
        cwd: "/workspace/alpha",
        path: "/workspace/alpha",
        agentId: "codex",
      }),
      buildThread({
        id: "thread-beta",
        preview: "Beta",
        updatedAt: 200,
        cwd: "/workspace/beta",
        path: "/workspace/beta",
        agentId: "opencode",
      }),
    ];

    const secondResult = store.computeActiveThreadState({
      nextThreads: secondThreads,
      previousUnreadThreadIdentifiers: firstResult.nextUnreadThreadIdentifiers,
      selectedThreadIdentifier: null,
    });
    expect(secondResult.didChangeThreads).toBe(false);
  });

  it("marks changed unselected threads unread while excluding the selected thread", () => {
    const store = new ThreadListStateStore();
    const initialThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-alpha",
        preview: "Alpha",
        updatedAt: 100,
        agentId: "opencode",
      }),
      buildThread({
        id: "thread-beta",
        preview: "Beta",
        updatedAt: 200,
        agentId: "opencode",
      }),
    ];

    const initialResult = store.computeActiveThreadState({
      nextThreads: initialThreads,
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: null,
    });
    expect(initialResult.nextUnreadThreadIdentifiers).toEqual({});

    const updatedThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-alpha",
        preview: "Alpha",
        updatedAt: 101,
        agentId: "opencode",
      }),
      buildThread({
        id: "thread-beta",
        preview: "Beta",
        updatedAt: 200,
        agentId: "opencode",
      }),
    ];

    const unreadUpdateResult = store.computeActiveThreadState({
      nextThreads: updatedThreads,
      previousUnreadThreadIdentifiers: initialResult.nextUnreadThreadIdentifiers,
      selectedThreadIdentifier: "thread-beta",
    });
    expect(unreadUpdateResult.nextUnreadThreadIdentifiers).toEqual({
      "thread-alpha": true,
    });

    const selectedUnreadThreadResult = store.computeActiveThreadState({
      nextThreads: updatedThreads,
      previousUnreadThreadIdentifiers: unreadUpdateResult.nextUnreadThreadIdentifiers,
      selectedThreadIdentifier: "thread-alpha",
    });
    expect(selectedUnreadThreadResult.nextUnreadThreadIdentifiers).toEqual({});
  });

  it("keeps codex threads read when unread signal is missing", () => {
    const store = new ThreadListStateStore();
    const initialThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-codex",
        preview: "Codex",
        updatedAt: 100,
        agentId: "codex",
      }),
    ];

    const initialResult = store.computeActiveThreadState({
      nextThreads: initialThreads,
      previousUnreadThreadIdentifiers: {},
      selectedThreadIdentifier: null,
    });
    expect(initialResult.nextUnreadThreadIdentifiers).toEqual({});

    const updatedThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-codex",
        preview: "Codex",
        updatedAt: 101,
        agentId: "codex",
      }),
    ];

    const unreadUpdateResult = store.computeActiveThreadState({
      nextThreads: updatedThreads,
      previousUnreadThreadIdentifiers: {
        "thread-codex": true,
      },
      selectedThreadIdentifier: null,
    });

    expect(unreadUpdateResult.nextUnreadThreadIdentifiers).toEqual({});
  });

  it("removes selected unread identifiers and reuses the unread map when no change is needed", () => {
    const store = new ThreadListStateStore();
    const unreadThreadIdentifiers: Record<string, true> = {
      "thread-alpha": true,
      "thread-beta": true,
    };

    const nextUnreadAfterSelection = store.computeUnreadThreadIdentifiersAfterSelectionChange({
      previousUnreadThreadIdentifiers: unreadThreadIdentifiers,
      selectedThreadIdentifier: "thread-alpha",
    });
    expect(nextUnreadAfterSelection).toEqual({
      "thread-beta": true,
    });
    expect(nextUnreadAfterSelection).not.toBe(unreadThreadIdentifiers);

    const unchangedWhenNoSelection = store.computeUnreadThreadIdentifiersAfterSelectionChange({
      previousUnreadThreadIdentifiers: unreadThreadIdentifiers,
      selectedThreadIdentifier: null,
    });
    expect(unchangedWhenNoSelection).toBe(unreadThreadIdentifiers);

    const unchangedWhenSelectionIsNotUnread =
      store.computeUnreadThreadIdentifiersAfterSelectionChange({
        previousUnreadThreadIdentifiers: unreadThreadIdentifiers,
        selectedThreadIdentifier: "thread-missing",
      });
    expect(unchangedWhenSelectionIsNotUnread).toBe(unreadThreadIdentifiers);
  });
});
