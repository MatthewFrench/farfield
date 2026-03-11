import { describe, expect, it } from "vitest";
import {
  FarfieldSidebarThreadSyncRequestSchema,
  FarfieldSidebarThreadSyncResponseSchema,
} from "../Source/Index.js";

describe("FarfieldSidebarThreads", () => {
  it("parses notModified responses with snapshot version metadata", () => {
    const parsed = FarfieldSidebarThreadSyncResponseSchema.parse({
      ok: true,
      syncStatus: "notModified",
      snapshotUpdatedAt: 124,
      snapshotVersion: "snapshot-version-1",
    });

    expect(parsed.syncStatus).toBe("notModified");
    expect(parsed.snapshotVersion).toBe("snapshot-version-1");
  });

  it("rejects snapshot responses that omit snapshot version metadata", () => {
    expect(() =>
      FarfieldSidebarThreadSyncResponseSchema.parse({
        ok: true,
        syncStatus: "snapshot",
        snapshotUpdatedAt: 124,
        threadList: {
          data: [],
          nextCursor: null,
        },
      }),
    ).toThrowError(/snapshotVersion/);
  });

  it("rejects oversized sidebar sync pagination inputs", () => {
    expect(() =>
      FarfieldSidebarThreadSyncRequestSchema.parse({
        archived: false,
        limit: 201,
        maxPages: 1,
        sortKey: "updated_at",
        knownSnapshotVersion: null,
      }),
    ).toThrowError(/limit/);

    expect(() =>
      FarfieldSidebarThreadSyncRequestSchema.parse({
        archived: false,
        limit: 200,
        maxPages: 41,
        sortKey: "updated_at",
        knownSnapshotVersion: null,
      }),
    ).toThrowError(/maxPages/);
  });
});
