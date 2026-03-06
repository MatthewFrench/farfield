import { describe, expect, it } from "vitest";
import {
  ThreadSidebarRuntimeSummaryNetworkCacheOwner,
  type ThreadSidebarRuntimeSummaryNetworkSnapshot,
  type ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage,
} from "@/Application/StateManagement/ThreadSidebarRuntimeSummaryNetworkCacheOwner";

function buildSnapshot(
  overrides: Partial<ThreadSidebarRuntimeSummaryNetworkSnapshot> = {},
): ThreadSidebarRuntimeSummaryNetworkSnapshot {
  return {
    account: {
      mode: "chatgpt",
      planType: "pro",
      email: "user@example.com",
      requiresOpenaiAuth: false,
      refreshedAtMilliseconds: 1_735_000_000_000,
    },
    rateLimits: null,
    apps: null,
    ...overrides,
  };
}

function buildCoverage(
  overrides: Partial<ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage> = {},
): ThreadSidebarRuntimeSummaryNetworkSnapshotCoverage {
  return {
    account: false,
    rateLimits: false,
    apps: false,
    ...overrides,
  };
}

describe("ThreadSidebarRuntimeSummaryNetworkCacheOwner", () => {
  it("reuses a fresh snapshot only when it covers the requested slices", () => {
    const owner = new ThreadSidebarRuntimeSummaryNetworkCacheOwner(1_000);
    const snapshot = buildSnapshot();
    owner.writeSnapshot("codex", snapshot, buildCoverage({ account: true }), 100);

    expect(owner.readSnapshotIfFresh("codex", buildCoverage({ account: true }), 200)).toEqual(
      snapshot,
    );
    expect(owner.readSnapshotIfFresh("codex", buildCoverage({ apps: true }), 200)).toBeNull();
  });

  it("coalesces identical in-flight loads for the same agent and coverage", async () => {
    const owner = new ThreadSidebarRuntimeSummaryNetworkCacheOwner(1_000);
    const snapshot = buildSnapshot({
      apps: {
        appCount: 0,
        refreshedAtMilliseconds: 1_735_000_000_001,
      },
    });
    let loadCount = 0;
    const loadSnapshot = async (): Promise<ThreadSidebarRuntimeSummaryNetworkSnapshot> => {
      loadCount += 1;
      await Promise.resolve();
      return snapshot;
    };

    const [firstResult, secondResult] = await Promise.all([
      owner.readFreshOrLoad({
        agentIdentifier: "codex",
        requiredCoverage: buildCoverage({ account: true, apps: true }),
        loadSnapshot,
      }),
      owner.readFreshOrLoad({
        agentIdentifier: "codex",
        requiredCoverage: buildCoverage({ account: true, apps: true }),
        loadSnapshot,
      }),
    ]);

    expect(loadCount).toBe(1);
    expect(firstResult).toEqual(snapshot);
    expect(secondResult).toEqual(snapshot);
    expect(
      owner.readSnapshotIfFresh("codex", buildCoverage({ account: true, apps: true })),
    ).toEqual(snapshot);
  });
});
