import { afterEach, describe, expect, it, vi } from "vitest";
import { listThreads } from "@/Features/Threads/DataAccess/ThreadApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

const DEFAULT_LIST_THREADS_OPTIONS = {
  limit: 80,
  archived: false,
  all: true,
  maxPages: 20
} as const;

function createJsonResponse(body: StructuredDataValue): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
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
            projectState: "removed"
          }
        ],
        nextCursor: null
      })
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.data[0]?.hasUnreadTurn).toBe(true);
    expect(result.data[0]?.isProjectRemoved).toBe(true);
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
            hasUnreadTurn: "yes"
          }
        ],
        nextCursor: null
      })
    );

    await expect(
      listThreads(DEFAULT_LIST_THREADS_OPTIONS)
    ).rejects.toThrow(/hasUnreadTurn/);
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
            projectState: "deleted"
          }
        ],
        nextCursor: null
      })
    );

    await expect(
      listThreads(DEFAULT_LIST_THREADS_OPTIONS)
    ).rejects.toThrow(/projectState/);
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
            agentId: "codex"
          }
        ],
        nextCursor: null
      })
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.data[0]?.hasUnreadTurn).toBeNull();
    expect(result.data[0]?.isProjectRemoved).toBe(false);
  });

  it("normalizes missing nextCursor values to null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        data: []
      })
    );

    const result = await listThreads(DEFAULT_LIST_THREADS_OPTIONS);

    expect(result.nextCursor).toBeNull();
  });
});
