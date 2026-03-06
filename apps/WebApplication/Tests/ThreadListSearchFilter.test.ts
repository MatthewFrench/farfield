import { describe, expect, it } from "vitest";
import type {
  ThreadListItem,
  ThreadProjectGroup,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListSearchFilter } from "@/Features/Threads/DomainModel/ThreadListSearchFilter";

function buildThread(input: {
  id: string;
  preview: string;
  cwd: string;
  path: string;
  agentId: ThreadListItem["agentId"];
}): ThreadListItem {
  return {
    id: input.id,
    preview: input.preview,
    createdAt: 1_735_000_000_000,
    updatedAt: 1_735_000_000_100,
    cwd: input.cwd,
    path: input.path,
    agentId: input.agentId,
    hasUnreadTurn: null,
    isProjectRemoved: false,
  };
}

function buildProjectGroup(input: {
  key: string;
  label: string;
  projectPath: string;
  threads: ThreadListItem[];
}): ThreadProjectGroup {
  return {
    key: input.key,
    label: input.label,
    projectPath: input.projectPath,
    projectCreatedAt: 1_735_000_000_000,
    latestUpdatedAt: 1_735_000_000_100,
    threads: input.threads,
    isRemoved: false,
  };
}

describe("ThreadListSearchFilter", () => {
  it("returns the original groups when the normalized query is empty", () => {
    const projectGroups: ThreadProjectGroup[] = [
      buildProjectGroup({
        key: "project:/tmp/alpha",
        label: "alpha",
        projectPath: "/tmp/alpha",
        threads: [
          buildThread({
            id: "thread-1",
            preview: "Alpha thread",
            cwd: "/tmp/alpha",
            path: "/tmp/alpha",
            agentId: "codex",
          }),
        ],
      }),
    ];

    const result = ThreadListSearchFilter.filterProjectGroups({
      projectGroups,
      query: "   ",
      readAgentLabel: () => "Codex",
    });

    expect(result).toBe(projectGroups);
  });

  it("keeps full project groups when project labels match the query", () => {
    const alphaThreads = [
      buildThread({
        id: "thread-1",
        preview: "Alpha first",
        cwd: "/tmp/alpha",
        path: "/tmp/alpha",
        agentId: "codex",
      }),
      buildThread({
        id: "thread-2",
        preview: "Alpha second",
        cwd: "/tmp/alpha",
        path: "/tmp/alpha",
        agentId: "opencode",
      }),
    ];
    const projectGroups: ThreadProjectGroup[] = [
      buildProjectGroup({
        key: "project:/tmp/alpha",
        label: "Alpha Workspace",
        projectPath: "/tmp/alpha",
        threads: alphaThreads,
      }),
    ];

    const result = ThreadListSearchFilter.filterProjectGroups({
      projectGroups,
      query: "workspace",
      readAgentLabel: (thread) => (thread.agentId === "codex" ? "Codex" : "OpenCode"),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.threads).toHaveLength(2);
    expect(result[0]?.threads.map((thread) => thread.id)).toEqual(["thread-1", "thread-2"]);
  });

  it("matches thread rows by agent label and returns only matching threads", () => {
    const projectGroups: ThreadProjectGroup[] = [
      buildProjectGroup({
        key: "project:/tmp/threads",
        label: "Threads",
        projectPath: "/tmp/threads",
        threads: [
          buildThread({
            id: "thread-codex",
            preview: "Codex thread",
            cwd: "/tmp/threads",
            path: "/tmp/threads",
            agentId: "codex",
          }),
          buildThread({
            id: "thread-opencode",
            preview: "OpenCode thread",
            cwd: "/tmp/threads",
            path: "/tmp/threads",
            agentId: "opencode",
          }),
        ],
      }),
    ];

    const result = ThreadListSearchFilter.filterProjectGroups({
      projectGroups,
      query: "opencode",
      readAgentLabel: (thread) => (thread.agentId === "codex" ? "Codex" : "OpenCode"),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.threads.map((thread) => thread.id)).toEqual(["thread-opencode"]);
  });
});
