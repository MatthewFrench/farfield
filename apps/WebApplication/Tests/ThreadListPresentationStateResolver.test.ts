import { describe, expect, it } from "vitest";
import type { ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListPresentationStateResolver } from "@/Features/Threads/StateManagement/ThreadListPresentationStateResolver";

function buildThread(input: {
  id: string;
  preview: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  isProjectRemoved?: boolean;
}): ThreadListItem {
  return {
    id: input.id,
    preview: input.preview,
    cwd: input.cwd,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    agentId: "codex",
    hasUnreadTurn: null,
    isProjectRemoved: input.isProjectRemoved ?? false,
  };
}

function buildLargeThreadCollection(
  projectCount: number,
  threadsPerProject: number,
): ThreadListItem[] {
  const threads: ThreadListItem[] = [];
  for (let projectIndex = 0; projectIndex < projectCount; projectIndex += 1) {
    for (let threadIndex = 0; threadIndex < threadsPerProject; threadIndex += 1) {
      const threadId = `thread-${String(projectIndex)}-${String(threadIndex)}`;
      const updatedAt = projectCount * threadsPerProject - threads.length;
      threads.push(
        buildThread({
          id: threadId,
          preview: `preview-${threadId}`,
          cwd: `/workspace/project-${String(projectIndex)}`,
          createdAt: updatedAt - 10,
          updatedAt,
        }),
      );
    }
  }
  return threads;
}

describe("ThreadListPresentationStateResolver", () => {
  it("reads grouped project state and merged archived section counts", () => {
    const resolver = new ThreadListPresentationStateResolver();
    const activeThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-1",
        preview: "alpha",
        cwd: "/workspace/alpha",
        createdAt: 10,
        updatedAt: 20,
      }),
      buildThread({
        id: "thread-2",
        preview: "beta",
        cwd: "/workspace/beta",
        createdAt: 11,
        updatedAt: 21,
        isProjectRemoved: true,
      }),
    ];
    const archivedThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-3",
        preview: "gamma",
        cwd: "/workspace/gamma",
        createdAt: 12,
        updatedAt: 22,
      }),
    ];

    const result = resolver.readState({
      threads: activeThreads,
      archivedThreads,
      selectedThreadIdentifier: "thread-1",
    });

    expect(result.selectedThread?.id).toBe("thread-1");
    expect(result.activeProjectGroups.map((group) => group.label)).toEqual(["alpha"]);
    expect(result.archivedProjectGroups.map((group) => group.label).sort()).toEqual([
      "beta",
      "gamma",
    ]);
    expect(result.archivedThreadIdentifiers.has("thread-3")).toBe(true);
    expect(result.archivedThreadIdentifiers.has("thread-2")).toBe(false);
    expect(result.archivedSectionThreadCount).toBe(2);
  });

  it("returns null selected thread when identifier is absent", () => {
    const resolver = new ThreadListPresentationStateResolver();
    const result = resolver.readState({
      threads: [],
      archivedThreads: [],
      selectedThreadIdentifier: "thread-missing",
    });

    expect(result.selectedThread).toBeNull();
    expect(result.activeProjectGroups).toEqual([]);
    expect(result.archivedProjectGroups).toEqual([]);
    expect(result.archivedSectionThreadCount).toBe(0);
  });

  it("orders active project groups by project first-created timestamp descending", () => {
    const resolver = new ThreadListPresentationStateResolver();
    const result = resolver.readState({
      threads: [
        buildThread({
          id: "thread-farfield",
          preview: "farfield preview",
          cwd: "/Users/example/GitHub/farfield",
          createdAt: 10,
          updatedAt: 10,
        }),
        buildThread({
          id: "thread-vladimir-new",
          preview: "vladimir new preview",
          cwd: "/Users/example/Documents/League of Legends/Vladimir",
          createdAt: 20,
          updatedAt: 20,
        }),
        buildThread({
          id: "thread-vladimir-old",
          preview: "vladimir old preview",
          cwd: "/Users/example/Documents/League of Legends/Vladimir",
          createdAt: 5,
          updatedAt: 25,
        }),
        buildThread({
          id: "thread-caddy",
          preview: "caddy preview",
          cwd: "/Users/example/caddy",
          createdAt: 30,
          updatedAt: 30,
        }),
      ],
      archivedThreads: [],
      selectedThreadIdentifier: null,
    });

    expect(result.activeProjectGroups.map((group) => group.label)).toEqual([
      "caddy",
      "farfield",
      "Vladimir",
    ]);
  });

  it("updates project ordering when incremental updates add older threads", () => {
    const resolver = new ThreadListPresentationStateResolver();
    const initialThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-farfield",
        preview: "farfield preview",
        cwd: "/Users/example/GitHub/farfield",
        createdAt: 10,
        updatedAt: 10,
      }),
      buildThread({
        id: "thread-vladimir-new",
        preview: "vladimir new preview",
        cwd: "/Users/example/Documents/League of Legends/Vladimir",
        createdAt: 20,
        updatedAt: 20,
      }),
      buildThread({
        id: "thread-caddy",
        preview: "caddy preview",
        cwd: "/Users/example/caddy",
        createdAt: 30,
        updatedAt: 30,
      }),
    ];

    const initialState = resolver.readState({
      threads: initialThreads,
      archivedThreads: [],
      selectedThreadIdentifier: null,
    });
    expect(initialState.activeProjectGroups.map((group) => group.label)).toEqual([
      "caddy",
      "Vladimir",
      "farfield",
    ]);

    const updatedState = resolver.readState({
      threads: [
        ...initialThreads,
        buildThread({
          id: "thread-vladimir-old",
          preview: "vladimir old preview",
          cwd: "/Users/example/Documents/League of Legends/Vladimir",
          createdAt: 5,
          updatedAt: 35,
        }),
      ],
      archivedThreads: [],
      selectedThreadIdentifier: null,
    });

    expect(updatedState.activeProjectGroups.map((group) => group.label)).toEqual([
      "caddy",
      "farfield",
      "Vladimir",
    ]);

    const computationStats = resolver.readComputationStatsSnapshot();
    expect(computationStats.active.usedIncrementalUpdate).toBe(true);
    expect(computationStats.active.addedThreadCount).toBe(1);
    expect(computationStats.active.changedThreadCount).toBe(0);
    expect(computationStats.active.removedThreadCount).toBe(0);
  });

  it("orders active projects using combined active and archived project metadata", () => {
    const resolver = new ThreadListPresentationStateResolver();
    const activeThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-crunchy-active",
        preview: "crunchy active",
        cwd: "/Users/example/GitHub/Crunchy-Watchlist",
        createdAt: 200,
        updatedAt: 200,
      }),
      buildThread({
        id: "thread-caddy-active",
        preview: "caddy active",
        cwd: "/Users/example/caddy",
        createdAt: 100,
        updatedAt: 100,
      }),
    ];
    const archivedThreads: ThreadListItem[] = [
      buildThread({
        id: "thread-crunchy-archived-old",
        preview: "crunchy archived old",
        cwd: "/Users/example/GitHub/Crunchy-Watchlist",
        createdAt: 50,
        updatedAt: 210,
      }),
    ];

    const result = resolver.readState({
      threads: activeThreads,
      archivedThreads,
      selectedThreadIdentifier: null,
    });

    expect(result.activeProjectGroups.map((group) => group.label)).toEqual([
      "caddy",
      "Crunchy-Watchlist",
    ]);
  });

  it("uses incremental group patching for large-state small-delta updates", () => {
    const resolver = new ThreadListPresentationStateResolver();
    const initialThreads = buildLargeThreadCollection(20, 30);

    resolver.readState({
      threads: initialThreads,
      archivedThreads: [],
      selectedThreadIdentifier: initialThreads[0]?.id ?? null,
    });

    const updatedThreads = initialThreads.map((thread) => {
      if (thread.id === "thread-4-9") {
        return {
          ...thread,
          preview: `${thread.preview}-updated`,
          updatedAt: thread.updatedAt + 100,
        };
      }
      return thread;
    });

    resolver.readState({
      threads: updatedThreads,
      archivedThreads: [],
      selectedThreadIdentifier: initialThreads[0]?.id ?? null,
    });

    const computationStats = resolver.readComputationStatsSnapshot();
    expect(computationStats.active.totalThreadCount).toBe(initialThreads.length);
    expect(computationStats.active.changedThreadCount).toBe(1);
    expect(computationStats.active.addedThreadCount).toBe(0);
    expect(computationStats.active.removedThreadCount).toBe(0);
    expect(computationStats.active.usedIncrementalUpdate).toBe(true);
    expect(computationStats.active.rebuiltGroupCount).toBeLessThanOrEqual(2);
  });
});
