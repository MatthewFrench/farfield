import { describe, expect, it } from "vitest";
import {
  readThreadRuntimeStatusBadgeClasses,
  readThreadRuntimeStatusBadgeLabel,
  readThreadRuntimeStatusBadgeTitle,
} from "../Source/Features/Threads/UserInterface/ThreadRuntimeStatusBadgeMetadata";

describe("ThreadRuntimeStatusBadgeMetadata", () => {
  it("returns not-loaded metadata when status is unavailable", () => {
    expect(readThreadRuntimeStatusBadgeLabel(undefined)).toBe("Not loaded");
    expect(readThreadRuntimeStatusBadgeTitle(undefined)).toBe(
      "Runtime status has not been observed yet",
    );
    expect(readThreadRuntimeStatusBadgeClasses(undefined)).toContain("text-slate-300");
  });

  it("returns awaiting-approval metadata for active status with waitingOnApproval", () => {
    const status = {
      sequence: 11,
      statusType: "active" as const,
      activeFlags: ["waitingOnApproval" as const],
      receivedAtMilliseconds: 2_001,
    };

    expect(readThreadRuntimeStatusBadgeLabel(status)).toBe("Awaiting approval");
    expect(readThreadRuntimeStatusBadgeTitle(status)).toBe("Runtime status at sequence 11");
    expect(readThreadRuntimeStatusBadgeClasses(status)).toContain("text-amber-300");
  });

  it("returns awaiting-input metadata for active status with waitingOnUserInput", () => {
    const status = {
      sequence: 12,
      statusType: "active" as const,
      activeFlags: ["waitingOnUserInput" as const],
      receivedAtMilliseconds: 2_101,
    };

    expect(readThreadRuntimeStatusBadgeLabel(status)).toBe("Awaiting input");
    expect(readThreadRuntimeStatusBadgeClasses(status)).toContain("text-amber-300");
  });

  it("returns active/idle/error metadata from status type", () => {
    expect(
      readThreadRuntimeStatusBadgeLabel({
        sequence: 13,
        statusType: "active",
        activeFlags: [],
        receivedAtMilliseconds: 2_201,
      }),
    ).toBe("Active");
    expect(
      readThreadRuntimeStatusBadgeLabel({
        sequence: 14,
        statusType: "idle",
        activeFlags: [],
        receivedAtMilliseconds: 2_301,
      }),
    ).toBe("Idle");
    expect(
      readThreadRuntimeStatusBadgeLabel({
        sequence: 15,
        statusType: "systemError",
        activeFlags: [],
        receivedAtMilliseconds: 2_401,
      }),
    ).toBe("Error");
  });
});
