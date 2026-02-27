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
    source: "opencode",
    agentId: "codex",
    isProjectRemoved: input.isProjectRemoved ?? false,
  };
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
});
