import { describe, expect, it } from "vitest";
import { FarfieldThreadListResponseSchema } from "../Source/Index.js";

describe("FarfieldThreadListContracts", () => {
  it("normalizes optional thread-list fields to sidebar-safe defaults", () => {
    const parsed = FarfieldThreadListResponseSchema.parse({
      data: [
        {
          id: "thread-1",
          preview: "hello",
          createdAt: 123,
          updatedAt: 124,
          agentId: "codex",
        },
      ],
      sync: {
        mode: "full",
        sinceUpdatedAt: null,
        snapshotUpdatedAt: 124,
        snapshotVersion: "snapshot-version-1",
      },
    });

    expect(parsed.nextCursor).toBeNull();
    expect(parsed.data[0]?.hasUnreadTurn).toBeNull();
    expect(parsed.data[0]?.isProjectRemoved).toBe(false);
    expect(parsed.sync?.snapshotVersion).toBe("snapshot-version-1");
  });

  it("rejects raw adapter-only fields on the Farfield thread-list surface", () => {
    expect(() =>
      FarfieldThreadListResponseSchema.parse({
        data: [
          {
            id: "thread-1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            agentId: "codex",
            threadName: "raw adapter field",
          },
        ],
      }),
    ).toThrowError(/threadName/);
  });

  it("requires snapshotVersion when thread-list sync metadata is present", () => {
    expect(() =>
      FarfieldThreadListResponseSchema.parse({
        data: [
          {
            id: "thread-1",
            preview: "hello",
            createdAt: 123,
            updatedAt: 124,
            agentId: "codex",
          },
        ],
        sync: {
          mode: "full",
          sinceUpdatedAt: null,
          snapshotUpdatedAt: 124,
        },
      }),
    ).toThrowError(/snapshotVersion/);
  });
});
