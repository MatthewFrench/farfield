import { afterEach, describe, expect, it, vi } from "vitest";
import { syncSidebarThreadList } from "@/Features/Threads/DataAccess/ThreadSidebarSyncApi";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

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

describe("ThreadSidebarSyncApi", () => {
  it("posts the strict sidebar sync request body and parses snapshot responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        syncStatus: "snapshot",
        snapshotUpdatedAt: 123,
        snapshotVersion: "snapshot-version-1",
        threadList: {
          data: [
            {
              id: "thread_1",
              preview: "hello",
              createdAt: 100,
              updatedAt: 123,
              cwd: "/tmp/workspace",
              agentId: "codex",
              hasUnreadTurn: null,
              isProjectRemoved: false,
            },
          ],
          nextCursor: null,
          pages: 1,
          truncated: false,
          sync: {
            mode: "full",
            sinceUpdatedAt: null,
            snapshotUpdatedAt: 123,
            snapshotVersion: "snapshot-version-1",
          },
        },
      }),
    );

    const result = await syncSidebarThreadList({
      archived: false,
      limit: 20,
      maxPages: 2,
      sortKey: "updated_at",
      cwd: "/tmp/workspace",
      knownSnapshotVersion: "snapshot-version-0",
    });

    expect(result).toEqual({
      syncStatus: "snapshot",
      snapshotUpdatedAt: 123,
      snapshotVersion: "snapshot-version-1",
      threadList: {
        data: [
          {
            id: "thread_1",
            preview: "hello",
            createdAt: 100,
            updatedAt: 123,
            cwd: "/tmp/workspace",
            agentId: "codex",
            hasUnreadTurn: null,
            isProjectRemoved: false,
          },
        ],
        nextCursor: null,
        pages: 1,
        truncated: false,
        sync: {
          mode: "full",
          sinceUpdatedAt: null,
          snapshotUpdatedAt: 123,
          snapshotVersion: "snapshot-version-1",
        },
      },
    });

    const fetchCall = fetchSpy.mock.calls[0];
    if (!fetchCall) {
      throw new Error("Expected fetch to be called");
    }

    expect(fetchCall[0]).toBe("/api/sidebar/threads/sync");
    const requestOptions = fetchCall[1];
    expect(requestOptions?.method).toBe("POST");
    expect(requestOptions?.body).toBe(
      JSON.stringify({
        archived: false,
        limit: 20,
        maxPages: 2,
        sortKey: "updated_at",
        cwd: "/tmp/workspace",
        knownSnapshotVersion: "snapshot-version-0",
      }),
    );
    expect(new Headers(requestOptions?.headers).get("Content-Type")).toBe("application/json");
  });

  it("parses notModified responses without a thread list payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        ok: true,
        syncStatus: "notModified",
        snapshotUpdatedAt: 123,
        snapshotVersion: "snapshot-version-1",
      }),
    );

    await expect(
      syncSidebarThreadList({
        archived: false,
        limit: 20,
        maxPages: 2,
        sortKey: "updated_at",
        knownSnapshotVersion: "snapshot-version-1",
      }),
    ).resolves.toEqual({
      syncStatus: "notModified",
      snapshotUpdatedAt: 123,
      snapshotVersion: "snapshot-version-1",
    });
  });
});
