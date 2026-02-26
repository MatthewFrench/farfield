import { describe, expect, it } from "vitest";
import {
  RuntimeStateOwner,
  type RuntimeStateReadModel
} from "../Source/Application/StateManagement/RuntimeStateOwner.js";

function createRuntimeStateReadModel(overrides: Partial<RuntimeStateReadModel> = {}): RuntimeStateReadModel {
  return {
    appExecutable: "codex",
    socketPath: "/tmp/ipc.sock",
    workspaceDir: "/tmp/workspace",
    gitCommit: "abc123",
    readCodexRuntimeState: () => {
      return {
        appReady: true,
        ipcConnected: true,
        ipcInitialized: true,
        codexAvailable: true,
        lastError: null
      };
    },
    readHistoryCount: () => 1,
    readThreadOwnerCount: () => 2,
    readPushEnabled: () => false,
    readPushSubscriptionCount: () => 0,
    readPushReceiptCount: () => 0,
    readClientErrorCount: () => 0,
    readActiveTraceSummary: () => null,
    ...overrides
  };
}

describe("RuntimeStateOwner", () => {
  it("reuses snapshot values within cache time-to-live", () => {
    let readRuntimeStateCalls = 0;
    const owner = new RuntimeStateOwner(
      createRuntimeStateReadModel({
        readCodexRuntimeState: () => {
          readRuntimeStateCalls += 1;
          return {
            appReady: true,
            ipcConnected: true,
            ipcInitialized: true,
            codexAvailable: true,
            lastError: null
          };
        }
      }),
      250
    );

    const firstSnapshot = owner.readSnapshot(1_000);
    const secondSnapshot = owner.readSnapshot(1_100);

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(readRuntimeStateCalls).toBe(1);
  });

  it("invalidates cache when runtime last error is updated", () => {
    let readRuntimeStateCalls = 0;
    const owner = new RuntimeStateOwner(
      createRuntimeStateReadModel({
        readCodexRuntimeState: () => {
          readRuntimeStateCalls += 1;
          return {
            appReady: true,
            ipcConnected: true,
            ipcInitialized: true,
            codexAvailable: true,
            lastError: "from-codex"
          };
        }
      }),
      250
    );

    const firstSnapshot = owner.readSnapshot(1_000);
    expect(firstSnapshot.lastError).toBe("from-codex");
    expect(readRuntimeStateCalls).toBe(1);

    owner.setRuntimeLastError("from-runtime-owner");
    const secondSnapshot = owner.readSnapshot(1_050);
    expect(secondSnapshot.lastError).toBe("from-runtime-owner");
    expect(readRuntimeStateCalls).toBe(2);
  });

  it("does not reuse cached snapshot when clock value moves backwards", () => {
    let readRuntimeStateCalls = 0;
    const owner = new RuntimeStateOwner(
      createRuntimeStateReadModel({
        readCodexRuntimeState: () => {
          readRuntimeStateCalls += 1;
          return {
            appReady: true,
            ipcConnected: true,
            ipcInitialized: true,
            codexAvailable: true,
            lastError: null
          };
        }
      }),
      250
    );

    owner.readSnapshot(1_000);
    owner.readSnapshot(900);
    expect(readRuntimeStateCalls).toBe(2);
  });

  it("rejects non-finite nowEpochMs values", () => {
    const owner = new RuntimeStateOwner(createRuntimeStateReadModel(), 250);

    expect(() => owner.readSnapshot(Number.NaN)).toThrowError(/finite nowEpochMs/);
    expect(() => owner.readSnapshot(Number.POSITIVE_INFINITY)).toThrowError(/finite nowEpochMs/);
  });
});
