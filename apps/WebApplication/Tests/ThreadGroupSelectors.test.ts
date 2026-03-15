import { describe, expect, it } from "vitest";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import type {
  ThreadListItem,
  ThreadProjectGroup,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";

interface ThreadFixtureInput {
  id: string;
  preview?: string;
  displayName?: string;
  lastUserMessage?: string;
  createdAt?: number;
  updatedAt?: number;
  cwd?: string;
  path?: string | null;
  hasUnreadTurn?: boolean | null;
  latestActivityIsUserMessage?: boolean;
  isProjectRemoved?: boolean;
  agentId?: ThreadListItem["agentId"];
}

interface ProjectGroupFixtureInput {
  key: string;
  label: string;
  projectPath: string | null;
  projectCreatedAt: number;
  latestUpdatedAt: number;
  threads: ThreadListItem[];
  isRemoved: boolean;
}

function buildThread(input: ThreadFixtureInput): ThreadListItem {
  return {
    id: input.id,
    preview: input.preview ?? `preview-${input.id}`,
    displayName: input.displayName,
    lastUserMessage: input.lastUserMessage,
    createdAt: input.createdAt ?? 100,
    updatedAt: input.updatedAt ?? 100,
    cwd: input.cwd,
    path: input.path,
    hasUnreadTurn: input.hasUnreadTurn ?? null,
    latestActivityIsUserMessage: input.latestActivityIsUserMessage,
    isProjectRemoved: input.isProjectRemoved ?? false,
    agentId: input.agentId ?? "codex",
  };
}

function buildProjectGroup(input: ProjectGroupFixtureInput): ThreadProjectGroup {
  return {
    key: input.key,
    label: input.label,
    projectPath: input.projectPath,
    projectCreatedAt: input.projectCreatedAt,
    latestUpdatedAt: input.latestUpdatedAt,
    threads: input.threads,
    isRemoved: input.isRemoved,
  };
}

describe("ThreadGroupSelectors", () => {
  it("prefers last user messages, then display names, then preview labels, and falls back to a stable identifier prefix", () => {
    const userMessagePriorityLabel = ThreadGroupSelectors.threadLabel(
      buildThread({
        id: "thread-with-display-name",
        preview: "ignored-preview",
        displayName: "  Configure Caddy for Farfield site  ",
        lastUserMessage: "  Last user message should win  ",
      }),
    );
    const displayNameFallbackLabel = ThreadGroupSelectors.threadLabel(
      buildThread({
        id: "thread-with-display-name-only",
        preview: "preview fallback",
        displayName: "  Display name fallback  ",
      }),
    );
    const userMessageLabel = ThreadGroupSelectors.threadLabel(
      buildThread({
        id: "thread-with-last-user-message",
        preview: "preview fallback",
        lastUserMessage: "  Last user instruction to run tests  ",
      }),
    );
    const previewLabel = ThreadGroupSelectors.threadLabel(
      buildThread({
        id: "thread-with-label",
        preview: "  Thread Label  ",
      }),
    );
    const identifierLabel = ThreadGroupSelectors.threadLabel(
      buildThread({
        id: "1234567890abcdef",
        preview: "   ",
      }),
    );

    expect(userMessagePriorityLabel).toBe("Last user message should win");
    expect(displayNameFallbackLabel).toBe("Display name fallback");
    expect(userMessageLabel).toBe("Last user instruction to run tests");
    expect(previewLabel).toBe("Thread Label");
    expect(identifierLabel).toBe("thread 12345678");
  });

  it("applies explicit unread signals before history-based unread heuristics", () => {
    const nextUnreadThreadIdentifiers = ThreadGroupSelectors.computeUnreadThreadIdentifiers({
      previousUnreadThreadIdentifiers: {
        "thread-history-unread": true,
        "thread-explicit-read": true,
        "thread-codex-unknown-signal": true,
      },
      previousThreadUpdatedAtByIdentifier: {
        "thread-history-update": 10,
        "thread-history-same": 20,
        "thread-explicit-read": 5,
        "thread-codex-unknown-signal": 20,
      },
      selectedThreadIdentifier: "thread-selected",
      nextThreads: [
        buildThread({
          id: "thread-selected",
          updatedAt: 99,
          hasUnreadTurn: true,
        }),
        buildThread({
          id: "thread-explicit-unread",
          updatedAt: 10,
          hasUnreadTurn: true,
        }),
        buildThread({
          id: "thread-explicit-unread-user-activity",
          updatedAt: 10,
          hasUnreadTurn: true,
          latestActivityIsUserMessage: true,
        }),
        buildThread({
          id: "thread-explicit-read",
          updatedAt: 11,
          hasUnreadTurn: false,
        }),
        buildThread({
          id: "thread-history-unread",
          updatedAt: 10,
          hasUnreadTurn: null,
          agentId: "opencode",
        }),
        buildThread({
          id: "thread-history-update",
          updatedAt: 11,
          hasUnreadTurn: null,
          agentId: "opencode",
        }),
        buildThread({
          id: "thread-history-same",
          updatedAt: 20,
          hasUnreadTurn: null,
          agentId: "opencode",
        }),
        buildThread({
          id: "thread-no-history",
          updatedAt: 50,
          hasUnreadTurn: null,
          agentId: "opencode",
        }),
        buildThread({
          id: "thread-codex-unknown-signal",
          updatedAt: 30,
          hasUnreadTurn: null,
          agentId: "codex",
        }),
      ],
    });

    expect(nextUnreadThreadIdentifiers).toEqual({
      "thread-explicit-unread": true,
      "thread-history-unread": true,
      "thread-history-update": true,
    });
  });

  it("normalizes project paths and keeps no-project threads under a stable literal key", () => {
    const groupedThreads = ThreadGroupSelectors.groupThreadsByProject([
      buildThread({
        id: "thread-alpha-older",
        cwd: "  C:\\workspace\\alpha\\\\  ",
        updatedAt: 10,
        createdAt: 3,
      }),
      buildThread({
        id: "thread-alpha-newer",
        path: "C:/workspace/alpha////",
        updatedAt: 15,
        createdAt: 7,
        isProjectRemoved: true,
      }),
      buildThread({
        id: "thread-beta",
        path: " /workspace/beta/// ",
        updatedAt: 20,
        createdAt: 4,
      }),
      buildThread({
        id: "thread-no-project",
        cwd: "",
        path: null,
        updatedAt: 25,
        createdAt: 9,
      }),
    ]);

    const alphaGroup = groupedThreads.find((group) => group.key === "project:C:/workspace/alpha");
    const unknownGroup = groupedThreads.find((group) => group.key === "project:unknown");

    expect(alphaGroup?.label).toBe("alpha");
    expect(alphaGroup?.projectPath).toBe("C:/workspace/alpha");
    expect(alphaGroup?.projectCreatedAt).toBe(3);
    expect(alphaGroup?.latestUpdatedAt).toBe(15);
    expect(alphaGroup?.isRemoved).toBe(true);
    expect(alphaGroup?.threads.map((thread) => thread.id)).toEqual([
      "thread-alpha-newer",
      "thread-alpha-older",
    ]);

    expect(unknownGroup?.label).toBe("No project");
    expect(unknownGroup?.projectPath).toBeNull();
    expect(groupedThreads[groupedThreads.length - 1]?.key).toBe("project:unknown");
  });

  it("merges matching groups with deterministic metadata and thread ordering", () => {
    const mergedProjectGroups = ThreadGroupSelectors.mergeProjectGroups(
      [
        buildProjectGroup({
          key: "project:/workspace/alpha",
          label: "alpha",
          projectPath: "/workspace/alpha",
          projectCreatedAt: 10,
          latestUpdatedAt: 20,
          threads: [
            buildThread({
              id: "thread-z",
              updatedAt: 4,
            }),
            buildThread({
              id: "thread-b",
              updatedAt: 2,
            }),
          ],
          isRemoved: false,
        }),
      ],
      [
        buildProjectGroup({
          key: "project:/workspace/alpha",
          label: "alpha",
          projectPath: "/workspace/alpha",
          projectCreatedAt: 15,
          latestUpdatedAt: 25,
          threads: [
            buildThread({
              id: "thread-y",
              updatedAt: 5,
            }),
            buildThread({
              id: "thread-a",
              updatedAt: 2,
            }),
          ],
          isRemoved: true,
        }),
        buildProjectGroup({
          key: "project:unknown",
          label: "No project",
          projectPath: null,
          projectCreatedAt: 100,
          latestUpdatedAt: 100,
          threads: [
            buildThread({
              id: "thread-no-project",
              updatedAt: 8,
            }),
          ],
          isRemoved: false,
        }),
      ],
    );

    const alphaGroup = mergedProjectGroups.find(
      (group) => group.key === "project:/workspace/alpha",
    );

    expect(alphaGroup?.projectCreatedAt).toBe(10);
    expect(alphaGroup?.latestUpdatedAt).toBe(25);
    expect(alphaGroup?.isRemoved).toBe(true);
    expect(alphaGroup?.threads.map((thread) => thread.id)).toEqual([
      "thread-y",
      "thread-z",
      "thread-a",
      "thread-b",
    ]);
    expect(mergedProjectGroups[mergedProjectGroups.length - 1]?.key).toBe("project:unknown");
  });

  it("keeps thread grouping and unread derivation performant for large thread lists", () => {
    const threadCount = 3000;
    const generatedThreads = Array.from({ length: threadCount }, (_value, index) =>
      buildThread({
        id: `thread-${String(index)}`,
        createdAt: index,
        updatedAt: index * 2,
        cwd: `/workspace/project-${String(index % 30)}`,
        hasUnreadTurn: index % 9 === 0 ? true : null,
      }),
    );
    const previousThreadUpdatedAtByIdentifier =
      ThreadGroupSelectors.mapThreadUpdatedAtByIdentifier(generatedThreads);

    const startedAtMilliseconds = performance.now();
    const groupedThreads = ThreadGroupSelectors.groupThreadsByProject(generatedThreads);
    const unreadThreadIdentifiers = ThreadGroupSelectors.computeUnreadThreadIdentifiers({
      previousUnreadThreadIdentifiers: {},
      previousThreadUpdatedAtByIdentifier,
      nextThreads: generatedThreads,
      selectedThreadIdentifier: null,
    });
    const elapsedMilliseconds = performance.now() - startedAtMilliseconds;

    expect(groupedThreads.length).toBe(30);
    expect(Object.keys(unreadThreadIdentifiers).length).toBeGreaterThan(0);
    expect(elapsedMilliseconds).toBeLessThan(1_500);
  });
});
