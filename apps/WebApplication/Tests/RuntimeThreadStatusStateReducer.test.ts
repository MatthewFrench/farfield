import { describe, expect, it } from "vitest";
import { applyRuntimeThreadStatusUpdates } from "../Source/Application/StateManagement/RuntimeThreadStatusStateReducer";

describe("RuntimeThreadStatusStateReducer", () => {
  it("applies newer sequence updates and creates per-thread status snapshots", () => {
    const result = applyRuntimeThreadStatusUpdates({
      previousStatusByThreadIdentifier: {},
      updates: [
        {
          sequence: 12,
          threadId: "thread-1",
          statusType: "active",
          activeFlags: ["waitingOnUserInput"],
          receivedAtMilliseconds: 4_101,
        },
      ],
    });

    expect(result).toEqual({
      nextStatusByThreadIdentifier: {
        "thread-1": {
          sequence: 12,
          statusType: "active",
          activeFlags: ["waitingOnUserInput"],
          receivedAtMilliseconds: 4_101,
        },
      },
      stats: {
        processedUpdateCount: 1,
        appliedUpdateCount: 1,
        ignoredStaleUpdateCount: 0,
        createdEntryCount: 1,
        updatedEntryCount: 0,
        clonedStateCount: 1,
      },
    });
  });

  it("ignores stale updates deterministically", () => {
    const result = applyRuntimeThreadStatusUpdates({
      previousStatusByThreadIdentifier: {
        "thread-1": {
          sequence: 20,
          statusType: "idle",
          activeFlags: [],
          receivedAtMilliseconds: 5_000,
        },
      },
      updates: [
        {
          sequence: 19,
          threadId: "thread-1",
          statusType: "active",
          activeFlags: ["waitingOnApproval"],
          receivedAtMilliseconds: 5_001,
        },
      ],
    });

    expect(result.nextStatusByThreadIdentifier).toEqual({
      "thread-1": {
        sequence: 20,
        statusType: "idle",
        activeFlags: [],
        receivedAtMilliseconds: 5_000,
      },
    });
    expect(result.stats).toEqual({
      processedUpdateCount: 1,
      appliedUpdateCount: 0,
      ignoredStaleUpdateCount: 1,
      createdEntryCount: 0,
      updatedEntryCount: 0,
      clonedStateCount: 0,
    });
  });

  it("keeps only the latest update when multiple updates target the same thread", () => {
    const result = applyRuntimeThreadStatusUpdates({
      previousStatusByThreadIdentifier: {},
      updates: [
        {
          sequence: 30,
          threadId: "thread-1",
          statusType: "active",
          activeFlags: [],
          receivedAtMilliseconds: 6_000,
        },
        {
          sequence: 31,
          threadId: "thread-1",
          statusType: "idle",
          activeFlags: [],
          receivedAtMilliseconds: 6_050,
        },
      ],
    });

    expect(result.nextStatusByThreadIdentifier).toEqual({
      "thread-1": {
        sequence: 31,
        statusType: "idle",
        activeFlags: [],
        receivedAtMilliseconds: 6_050,
      },
    });
    expect(result.stats).toEqual({
      processedUpdateCount: 2,
      appliedUpdateCount: 2,
      ignoredStaleUpdateCount: 0,
      createdEntryCount: 1,
      updatedEntryCount: 1,
      clonedStateCount: 1,
    });
  });
});
