import { afterEach, describe, expect, it, vi } from "vitest";
import {
  archiveThread,
  cleanThreadBackgroundTerminals,
  compactThread,
  listThreads,
  rollbackThread,
  startThreadReview,
  unarchiveThread,
} from "@/Features/Threads/DataAccess/ThreadApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

const DEFAULT_LIST_THREADS_OPTIONS = {
  limit: 80,
  archived: false,
  all: true,
  maxPages: 20,
} as const;

function createJsonResponse(body: StructuredDataValue): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThreadApi", () => {
  it("maps unread and project-removal signals to strict thread contracts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
            hasUnreadTurn: true,
            isLoadedInMemory: true,
            projectState: "removed",
          },
        ],
        nextCursor: null,
      }),
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.data[0]?.hasUnreadTurn).toBe(true);
    expect(result.data[0]?.isLoadedInMemory).toBe(true);
    expect(result.data[0]?.isProjectRemoved).toBe(true);
  });

  it("maps threadName and title wire fields to displayName", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_name_field",
            preview: "preview one",
            threadName: "  Name from threadName  ",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
          },
          {
            id: "thread_title_field",
            preview: "preview two",
            title: "  Name from title  ",
            createdAt: 125,
            updatedAt: 126,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
          },
        ],
        nextCursor: null,
      }),
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.data[0]?.displayName).toBe("Name from threadName");
    expect(result.data[1]?.displayName).toBe("Name from title");
  });

  it("maps lastUserMessage and latest-activity ownership from turns", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_last_user_message",
            preview: "first question",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
            turns: [
              {
                id: "turn_1",
                items: [
                  {
                    id: "item_1",
                    type: "userMessage",
                    content: [{ type: "text", text: "initial question" }],
                  },
                ],
              },
              {
                id: "turn_2",
                items: [
                  {
                    id: "item_2",
                    type: "agentMessage",
                    text: "assistant answer",
                  },
                  {
                    id: "item_3",
                    type: "userMessage",
                    content: [{ type: "text", text: "latest user ask" }],
                  },
                ],
              },
            ],
          },
          {
            id: "thread_latest_activity_not_user",
            preview: "question before assistant response",
            createdAt: 130,
            updatedAt: 131,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
            turns: [
              {
                id: "turn_1",
                items: [
                  {
                    id: "item_4",
                    type: "userMessage",
                    content: [{ type: "text", text: "user question" }],
                  },
                  {
                    id: "item_5",
                    type: "agentMessage",
                    text: "assistant response",
                  },
                ],
              },
            ],
          },
        ],
        nextCursor: null,
      }),
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.data[0]?.lastUserMessage).toBe("latest user ask");
    expect(result.data[0]?.latestActivityIsUserMessage).toBe(true);
    expect(result.data[1]?.lastUserMessage).toBe("user question");
    expect(result.data[1]?.latestActivityIsUserMessage).toBe(false);
  });

  it("rejects malformed userMessage turn items in thread list payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_bad_user_message",
            preview: "preview",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
            turns: [
              {
                id: "turn_1",
                items: [
                  {
                    id: "item_1",
                    type: "userMessage",
                  },
                ],
              },
            ],
          },
        ],
        nextCursor: null,
      }),
    );

    await expect(listThreads(DEFAULT_LIST_THREADS_OPTIONS)).rejects.toThrow(/content/);
  });

  it("rejects thread list payloads when hasUnreadTurn is not a boolean", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
            hasUnreadTurn: "yes",
          },
        ],
        nextCursor: null,
      }),
    );

    await expect(listThreads(DEFAULT_LIST_THREADS_OPTIONS)).rejects.toThrow(/hasUnreadTurn/);
  });

  it("rejects thread list payloads when isLoadedInMemory is not a boolean", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
            isLoadedInMemory: "yes",
          },
        ],
        nextCursor: null,
      }),
    );

    await expect(listThreads(DEFAULT_LIST_THREADS_OPTIONS)).rejects.toThrow(/isLoadedInMemory/);
  });

  it("rejects thread list payloads when projectState is invalid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
            projectState: "deleted",
          },
        ],
        nextCursor: null,
      }),
    );

    await expect(listThreads(DEFAULT_LIST_THREADS_OPTIONS)).rejects.toThrow(/projectState/);
  });

  it("normalizes missing hasUnreadTurn to null and project-removal to false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
          },
        ],
        nextCursor: null,
      }),
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.data[0]?.hasUnreadTurn).toBeNull();
    expect(result.data[0]?.isProjectRemoved).toBe(false);
  });

  it("normalizes missing nextCursor values to null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [],
      }),
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.nextCursor).toBeNull();
  });

  it("parses delta sync metadata and ordered thread identifiers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            cwd: "/tmp/workspace",
            source: "opencode",
            agentId: "codex",
          },
        ],
        nextCursor: null,
        orderedThreadIds: ["thread_1", "thread_2"],
        sync: {
          mode: "delta",
          sinceUpdatedAt: 120,
          snapshotUpdatedAt: 124,
        },
      }),
    );

    const result = await listThreads({
      ...DEFAULT_LIST_THREADS_OPTIONS,
      sinceUpdatedAt: 120,
    });

    expect(result.orderedThreadIds).toEqual(["thread_1", "thread_2"]);
    expect(result.sync).toEqual({
      mode: "delta",
      sinceUpdatedAt: 120,
      snapshotUpdatedAt: 124,
    });
  });

  it("treats removed and projectRemoved wire flags as project-removal signals", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: [
          {
            id: "thread_removed",
            preview: "removed",
            createdAt: 10,
            updatedAt: 11,
            cwd: "/tmp/workspace",
            agentId: "codex",
            source: "opencode",
            removed: true,
          },
          {
            id: "thread_project_removed",
            preview: "project removed",
            createdAt: 12,
            updatedAt: 13,
            cwd: "/tmp/workspace",
            agentId: "codex",
            source: "opencode",
            projectRemoved: true,
          },
          {
            id: "thread_active",
            preview: "active",
            createdAt: 14,
            updatedAt: 15,
            cwd: "/tmp/workspace",
            agentId: "codex",
            source: "opencode",
            projectState: "active",
          },
        ],
        nextCursor: null,
      }),
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.data[0]?.isProjectRemoved).toBe(true);
    expect(result.data[1]?.isProjectRemoved).toBe(true);
    expect(result.data[2]?.isProjectRemoved).toBe(false);
  });

  it("posts archive and unarchive mutations through encoded thread member routes", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          threadId: "thread_123",
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          threadId: "thread_123",
        }),
      );

    await archiveThread("thread 123/with slash");
    await unarchiveThread("thread 123/with slash");

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstRequestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    const secondRequestUrl = String(fetchMock.mock.calls[1]?.[0] ?? "");
    expect(firstRequestUrl).toBe("/api/threads/thread%20123%2Fwith%20slash/archive");
    expect(secondRequestUrl).toBe("/api/threads/thread%20123%2Fwith%20slash/unarchive");

    const firstRequestInit = fetchMock.mock.calls[0]?.[1];
    const secondRequestInit = fetchMock.mock.calls[1]?.[1];
    expect(firstRequestInit?.method).toBe("POST");
    expect(secondRequestInit?.method).toBe("POST");
  });

  it("posts rollback mutations with strict turn-count payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_123",
      }),
    );

    await rollbackThread({
      threadId: "thread 123/with slash",
      numTurns: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestUrl).toBe("/api/threads/thread%20123%2Fwith%20slash/rollback");

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.body).toBe(JSON.stringify({ numTurns: 2 }));
  });

  it("posts compact mutations through encoded thread member routes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_123",
      }),
    );

    await compactThread("thread 123/with slash");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestUrl).toBe("/api/threads/thread%20123%2Fwith%20slash/compact");

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("POST");
  });

  it("posts background-terminal cleanup mutations through encoded thread member routes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_123",
      }),
    );

    await cleanThreadBackgroundTerminals("thread 123/with slash");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestUrl).toBe("/api/threads/thread%20123%2Fwith%20slash/background-terminals-clean");

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("POST");
  });

  it("posts start-review mutations and parses returned review identifiers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        threadId: "thread_123",
        reviewThreadId: "thread_review_123",
        reviewTurnId: "turn_review_123",
      }),
    );

    const result = await startThreadReview("thread 123/with slash");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestUrl).toBe("/api/threads/thread%20123%2Fwith%20slash/review");

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.method).toBe("POST");
    expect(result).toEqual({
      reviewThreadId: "thread_review_123",
      reviewTurnId: "turn_review_123",
    });
  });
});
