import { describe, expect, it } from "vitest";
import { readInitialModeKeyFromModes } from "@/App";
import type { CoreDataModesResponse } from "@/Application/StateManagement/CoreDataSnapshotContracts";

type ModeOption = CoreDataModesResponse["data"][number];

function createModeOption(mode: "plan" | "default" | null, name: string): ModeOption {
  return {
    mode,
    name,
  };
}

describe("App initial mode key selection", () => {
  it("uses the first non-plan mode when plan mode appears first", () => {
    const modes: CoreDataModesResponse["data"] = [
      createModeOption("plan", "Plan"),
      createModeOption("default", "Chat"),
    ];

    expect(readInitialModeKeyFromModes(modes)).toBe("default");
  });

  it("uses the first mode when no non-plan mode exists", () => {
    const modes: CoreDataModesResponse["data"] = [
      createModeOption("plan", "Plan"),
      createModeOption("plan", "Planning"),
    ];

    expect(readInitialModeKeyFromModes(modes)).toBe("plan");
  });

  it("returns an empty string when there are no modes", () => {
    const modes: CoreDataModesResponse["data"] = [];

    expect(readInitialModeKeyFromModes(modes)).toBe("");
  });
});
