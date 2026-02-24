import { describe, expect, it } from "vitest";
import { CapabilitySnapshotCache } from "../Source/Features/Capabilities/DataAccess/CapabilitySnapshotCache";

interface TestCapabilitySnapshot {
  fetchedAt: number;
  revision: number;
}

describe("CapabilitySnapshotCache", () => {
  it("returns the cached snapshot while it is fresh", async () => {
    const cache = new CapabilitySnapshotCache<TestCapabilitySnapshot>(1_000);
    let loadCount = 0;
    const loadSnapshot = async (): Promise<TestCapabilitySnapshot> => {
      loadCount += 1;
      return {
        fetchedAt: 1_000,
        revision: loadCount
      };
    };

    const first = await cache.readSnapshot(loadSnapshot, 1_000);
    const second = await cache.readSnapshot(loadSnapshot, 1_500);

    expect(loadCount).toBe(1);
    expect(first).toEqual(second);
    expect(second.revision).toBe(1);
  });

  it("refreshes the snapshot after the freshness interval elapses", async () => {
    const cache = new CapabilitySnapshotCache<TestCapabilitySnapshot>(1_000);
    let nextRevision = 1;
    const loadSnapshot = async (): Promise<TestCapabilitySnapshot> => {
      const revision = nextRevision;
      nextRevision += 1;
      return {
        fetchedAt: revision === 1 ? 1_000 : 2_500,
        revision
      };
    };

    const first = await cache.readSnapshot(loadSnapshot, 1_000);
    const second = await cache.readSnapshot(loadSnapshot, 2_500);

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
  });

  it("coalesces concurrent refreshes into a single in-flight request", async () => {
    const cache = new CapabilitySnapshotCache<TestCapabilitySnapshot>(1);
    let loadCount = 0;
    let resolveLoader: (value: TestCapabilitySnapshot) => void = () => {
      throw new Error("Expected resolveLoader to be initialized");
    };
    const inFlightLoadSnapshot = new Promise<TestCapabilitySnapshot>((resolve) => {
      resolveLoader = resolve;
    });
    const loadSnapshot = async (): Promise<TestCapabilitySnapshot> => {
      loadCount += 1;
      return inFlightLoadSnapshot;
    };

    const firstPromise = cache.readSnapshot(loadSnapshot, 100);
    const secondPromise = cache.readSnapshot(loadSnapshot, 100);

    expect(loadCount).toBe(1);
    resolveLoader({
      fetchedAt: 100,
      revision: 1
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toEqual(second);
    expect(second.revision).toBe(1);
  });
});
