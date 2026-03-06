import { describe, expect, it } from "vitest";
import { FarfieldSidebarThreadSyncResponseSchema } from "../Source/Index.js";

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
});
