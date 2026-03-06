import { describe, expect, it } from "vitest";
import { FarfieldClientPerformanceProbeSnapshotSchema } from "../Source/Index.js";

describe("FarfieldPerformanceProbe", () => {
  it("parses an empty snapshot with explicit empty collections", () => {
    const parsed = FarfieldClientPerformanceProbeSnapshotSchema.parse({
      installedAtEpochMilliseconds: 10,
      freezeThresholdMilliseconds: 120,
      instantEvents: [],
      inFlightOperations: [],
      completedOperations: [],
      longTasks: [],
      freezeWindows: [],
    });

    expect(parsed.freezeThresholdMilliseconds).toBe(120);
    expect(parsed.completedOperations).toEqual([]);
  });

  it("rejects non-json details payloads", () => {
    expect(() =>
      FarfieldClientPerformanceProbeSnapshotSchema.parse({
        installedAtEpochMilliseconds: 10,
        freezeThresholdMilliseconds: 120,
        instantEvents: [
          {
            sequence: 1,
            name: "sidebar-toggle-open-requested",
            atEpochMilliseconds: 11,
            atHighResolutionMilliseconds: 1.5,
            details: {
              invalid: undefined,
            },
          },
        ],
        inFlightOperations: [],
        completedOperations: [],
        longTasks: [],
        freezeWindows: [],
      }),
    ).toThrowError(/details/);
  });
});
