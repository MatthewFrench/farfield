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
    });

    expect(parsed.nextCursor).toBeNull();
    expect(parsed.data[0]?.hasUnreadTurn).toBeNull();
    expect(parsed.data[0]?.isProjectRemoved).toBe(false);
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
});
