import { describe, expect, it, vi } from "vitest";
import type { DebugHistoryDetailResponse } from "../Source/Features/Debugging/DataAccess/DebugServerClient";
import { DebugWorkspaceActionCoordinator } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceActionCoordinator";
type HistoryDetail = DebugHistoryDetailResponse;

function buildHistoryDetail(id: string): HistoryDetail {
  return {
    ok: true,
    entry: {
      id,
      at: "2025-01-01T00:00:00.000Z",
      source: "app",
      direction: "in",
      payload: {
        kind: "request"
      },
      meta: {
        method: "thread.read"
      }
    },
    fullPayload: {
      entryId: id
    }
  };
}

describe("DebugWorkspaceActionCoordinator", () => {
  it("clears history detail when no history entry identifier is provided", async () => {
    const coordinator = new DebugWorkspaceActionCoordinator();
    const debugClient = {
      readHistoryEntry: vi.fn(async () => buildHistoryDetail("entry-1")),
      replayHistoryEntry: vi.fn(async () => ({})),
      startTrace: vi.fn(async () => {}),
      markTrace: vi.fn(async () => {}),
      stopTrace: vi.fn(async () => {})
    };
    const onHistoryDetailLoaded = vi.fn();

    await coordinator.loadHistoryDetail({
      historyEntryId: "",
      debugClient,
      onHistoryDetailLoaded
    });

    expect(debugClient.readHistoryEntry).not.toHaveBeenCalled();
    expect(onHistoryDetailLoaded).toHaveBeenCalledWith(null);
  });

  it("loads and applies history detail for selected history entry", async () => {
    const coordinator = new DebugWorkspaceActionCoordinator();
    const detail = buildHistoryDetail("entry-9");
    const debugClient = {
      readHistoryEntry: vi.fn(async () => detail),
      replayHistoryEntry: vi.fn(async () => ({})),
      startTrace: vi.fn(async () => {}),
      markTrace: vi.fn(async () => {}),
      stopTrace: vi.fn(async () => {})
    };
    const onHistoryDetailLoaded = vi.fn();

    await coordinator.loadHistoryDetail({
      historyEntryId: "entry-9",
      debugClient,
      onHistoryDetailLoaded
    });

    expect(debugClient.readHistoryEntry).toHaveBeenCalledWith("entry-9");
    expect(onHistoryDetailLoaded).toHaveBeenCalledWith(detail);
  });

  it("replays selected history entry and refreshes core data", async () => {
    const coordinator = new DebugWorkspaceActionCoordinator();
    const debugClient = {
      readHistoryEntry: vi.fn(async () => buildHistoryDetail("entry-1")),
      replayHistoryEntry: vi.fn(async () => ({
        ok: true
      })),
      startTrace: vi.fn(async () => {}),
      markTrace: vi.fn(async () => {}),
      stopTrace: vi.fn(async () => {})
    };
    const refreshCoreData = vi.fn(async () => {});

    await coordinator.replayHistoryEntry({
      replayRequest: {
        entryId: "entry-1",
        waitForResponse: true
      },
      debugClient,
      refreshCoreData
    });

    expect(debugClient.replayHistoryEntry).toHaveBeenCalledWith({
      entryId: "entry-1",
      waitForResponse: true
    });
    expect(refreshCoreData).toHaveBeenCalledTimes(1);
  });

  it("starts and marks trace, then refreshes core data", async () => {
    const coordinator = new DebugWorkspaceActionCoordinator();
    const debugClient = {
      readHistoryEntry: vi.fn(async () => buildHistoryDetail("entry-1")),
      replayHistoryEntry: vi.fn(async () => ({})),
      startTrace: vi.fn(async () => {}),
      markTrace: vi.fn(async () => {}),
      stopTrace: vi.fn(async () => {})
    };
    const refreshCoreData = vi.fn(async () => {});

    await coordinator.startTrace({
      traceLabel: "Initial trace",
      debugClient,
      refreshCoreData
    });
    await coordinator.markTrace({
      traceNote: "after selected-thread load",
      debugClient,
      refreshCoreData
    });

    expect(debugClient.startTrace).toHaveBeenCalledWith("Initial trace");
    expect(debugClient.markTrace).toHaveBeenCalledWith("after selected-thread load");
    expect(refreshCoreData).toHaveBeenCalledTimes(2);
  });

  it("stops trace and refreshes core data", async () => {
    const coordinator = new DebugWorkspaceActionCoordinator();
    const debugClient = {
      readHistoryEntry: vi.fn(async () => buildHistoryDetail("entry-1")),
      replayHistoryEntry: vi.fn(async () => ({})),
      startTrace: vi.fn(async () => {}),
      markTrace: vi.fn(async () => {}),
      stopTrace: vi.fn(async () => {})
    };
    const refreshCoreData = vi.fn(async () => {});

    await coordinator.stopTrace({
      debugClient,
      refreshCoreData
    });

    expect(debugClient.stopTrace).toHaveBeenCalledTimes(1);
    expect(refreshCoreData).toHaveBeenCalledTimes(1);
  });
});
