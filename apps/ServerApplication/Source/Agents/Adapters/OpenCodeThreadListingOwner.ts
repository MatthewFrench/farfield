import type { MappedThreadListItem } from "@farfield/opencode-api";
import type { AgentListThreadsInput, AgentListThreadsResult } from "../Types.js";
import {
  decodeOpenCodeThreadCursor,
  encodeOpenCodeThreadCursor,
} from "./OpenCodeThreadCursorContracts.js";

export interface OpenCodeThreadListingOwnerDependencies {
  parseThreadListItem: (session: MappedThreadListItem) => AgentListThreadsResult["data"][number];
  listSessions: (input?: { directory?: string }) => Promise<{ data: MappedThreadListItem[] }>;
  resolveSessionDirectories: (inputDirectory: string | null) => Promise<string[]>;
  cacheThreadDirectory: (threadId: string, directory: string | undefined) => void;
}

function createEmptyThreadListResult(): AgentListThreadsResult {
  return {
    data: [],
    nextCursor: null,
    pages: 0,
    truncated: false,
  };
}

function compareThreadsBySortKey(
  left: AgentListThreadsResult["data"][number],
  right: AgentListThreadsResult["data"][number],
  sortKey: "created_at" | "updated_at",
): number {
  const leftValue = sortKey === "created_at" ? left.createdAt : left.updatedAt;
  const rightValue = sortKey === "created_at" ? right.createdAt : right.updatedAt;
  if (leftValue !== rightValue) {
    return rightValue - leftValue;
  }
  return left.id.localeCompare(right.id);
}

/**
 * Owns OpenCode session reads, mapping, sorting, and cursor pagination for listThreads.
 */
export class OpenCodeThreadListingOwner {
  private readonly deps: OpenCodeThreadListingOwnerDependencies;

  public constructor(dependencies: OpenCodeThreadListingOwnerDependencies) {
    this.deps = dependencies;
  }

  public async listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
    if (input.archived) {
      return createEmptyThreadListResult();
    }

    const sessions = await this.readSessions(input.cwd);
    const mappedData = Array.from(sessions.values())
      .map((session) => this.deps.parseThreadListItem(session))
      .sort((left, right) => compareThreadsBySortKey(left, right, input.sortKey));

    const cursorOffset = decodeOpenCodeThreadCursor(input.cursor);
    if (cursorOffset >= mappedData.length) {
      return createEmptyThreadListResult();
    }

    if (!input.all) {
      const pageData = mappedData.slice(cursorOffset, cursorOffset + input.limit);
      const nextOffset = cursorOffset + pageData.length;
      const nextCursor =
        nextOffset < mappedData.length ? encodeOpenCodeThreadCursor(nextOffset) : null;
      return {
        data: pageData,
        nextCursor,
        pages: pageData.length > 0 ? 1 : 0,
        truncated: nextCursor !== null,
      };
    }

    const maxItems = input.limit * input.maxPages;
    const pageData = mappedData.slice(cursorOffset, cursorOffset + maxItems);
    const nextOffset = cursorOffset + pageData.length;
    const nextCursor =
      nextOffset < mappedData.length ? encodeOpenCodeThreadCursor(nextOffset) : null;

    return {
      data: pageData,
      nextCursor,
      pages: pageData.length === 0 ? 0 : Math.ceil(pageData.length / input.limit),
      truncated: nextCursor !== null,
    };
  }

  private async readSessions(
    inputDirectory: string | null,
  ): Promise<Map<string, MappedThreadListItem>> {
    const directories = await this.deps.resolveSessionDirectories(inputDirectory);
    const sessionMap = new Map<string, MappedThreadListItem>();

    if (directories.length === 0) {
      const result = await this.deps.listSessions();
      this.mergeSessions(sessionMap, result.data);
      return sessionMap;
    }

    await Promise.all(
      directories.map(async (directory) => {
        const result = await this.deps.listSessions({ directory });
        this.mergeSessions(sessionMap, result.data);
      }),
    );

    return sessionMap;
  }

  private mergeSessions(
    targetSessionMap: Map<string, MappedThreadListItem>,
    sessions: ReadonlyArray<MappedThreadListItem>,
  ): void {
    for (const session of sessions) {
      targetSessionMap.set(session.id, session);
      this.deps.cacheThreadDirectory(session.id, session.cwd);
    }
  }
}
