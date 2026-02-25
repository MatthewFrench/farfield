import { describe, expect, it } from "vitest";
import { ServiceWorkerControllerChangeReloadOwner } from "@/Application/Boot/ServiceWorkerControllerChangeReloadOwner";

describe("ServiceWorkerControllerChangeReloadOwner", () => {
  it("skips reload on first controller adoption and reloads on later controller changes", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(false);

    const firstDecision = owner.readDecision({ reloadSuppressed: false });
    expect(firstDecision.shouldReload).toBe(false);

    const secondDecision = owner.readDecision({ reloadSuppressed: false });
    expect(secondDecision.shouldReload).toBe(true);

    const thirdDecision = owner.readDecision({ reloadSuppressed: false });
    expect(thirdDecision.shouldReload).toBe(false);
  });

  it("reloads immediately when a controller already exists and no suppression is active", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(true);

    const firstDecision = owner.readDecision({ reloadSuppressed: false });
    expect(firstDecision.shouldReload).toBe(true);

    const secondDecision = owner.readDecision({ reloadSuppressed: false });
    expect(secondDecision.shouldReload).toBe(false);
  });

  it("honors reload suppression and allows one unsuppressed reload afterward", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(true);

    const suppressedDecision = owner.readDecision({ reloadSuppressed: true });
    expect(suppressedDecision.shouldReload).toBe(false);

    const unsuppressedDecision = owner.readDecision({ reloadSuppressed: false });
    expect(unsuppressedDecision.shouldReload).toBe(true);
  });
});
