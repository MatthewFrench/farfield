import { describe, expect, it } from "vitest";
import {
  ServiceWorkerReloadEligibilityOwner,
  type WebShellVersionSnapshot,
} from "@/Application/Boot/ServiceWorkerReloadEligibilityOwner";

const INITIAL_VERSION_SNAPSHOT: WebShellVersionSnapshot = {
  buildId: "build-1",
  gitCommit: "commit-1",
  serviceWorkerVersion: "sw-1",
};

describe("ServiceWorkerReloadEligibilityOwner", () => {
  it("does not reload when no pending update was observed", () => {
    const owner = new ServiceWorkerReloadEligibilityOwner(INITIAL_VERSION_SNAPSHOT);

    expect(
      owner.readShouldReload({
        hasPendingUpdate: false,
        nextVersionSnapshot: {
          buildId: "build-2",
          gitCommit: "commit-2",
          serviceWorkerVersion: "sw-2",
        },
      }),
    ).toBe(false);
  });

  it("does not reload when the baseline version snapshot is unavailable", () => {
    const owner = new ServiceWorkerReloadEligibilityOwner(null);

    expect(
      owner.readShouldReload({
        hasPendingUpdate: true,
        nextVersionSnapshot: INITIAL_VERSION_SNAPSHOT,
      }),
    ).toBe(false);
  });

  it("does not reload when the next version snapshot matches the baseline", () => {
    const owner = new ServiceWorkerReloadEligibilityOwner(INITIAL_VERSION_SNAPSHOT);

    expect(
      owner.readShouldReload({
        hasPendingUpdate: true,
        nextVersionSnapshot: INITIAL_VERSION_SNAPSHOT,
      }),
    ).toBe(false);
  });

  it("reloads when the web-shell version snapshot changes after a pending update", () => {
    const owner = new ServiceWorkerReloadEligibilityOwner(INITIAL_VERSION_SNAPSHOT);

    expect(
      owner.readShouldReload({
        hasPendingUpdate: true,
        nextVersionSnapshot: {
          buildId: "build-1",
          gitCommit: "commit-1",
          serviceWorkerVersion: "sw-2",
        },
      }),
    ).toBe(true);
  });
});
