import { describe, expect, it } from "vitest";
import { RuntimeStateOwner } from "../Source/Application/StateManagement/RuntimeStateOwner.js";

describe("RuntimeStateOwner", () => {
  it("reuses snapshot values within cache time-to-live", () => {
    let readRuntimeStateCalls = 0;
    const owner = new RuntimeStateOwner({
      appExecutable: "codex",
      socketPath: "/tmp/ipc.sock",
      workspaceDir: "/tmp/workspace",
      gitCommit: "abc123",
      readCodexRuntimeState: () => {
        readRuntimeStateCalls += 1;
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
      readActiveTraceSummary: () => null
    }, 250);

    const firstSnapshot = owner.readSnapshot(1_000);
    const secondSnapshot = owner.readSnapshot(1_100);

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(readRuntimeStateCalls).toBe(1);
  });
});
