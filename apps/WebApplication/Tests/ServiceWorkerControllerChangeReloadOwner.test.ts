import { describe, expect, it } from "vitest";
import { ServiceWorkerControllerChangeReloadOwner } from "@/Application/Boot/ServiceWorkerControllerChangeReloadOwner";

describe("ServiceWorkerControllerChangeReloadOwner", () => {
  it("skips reload on first controller adoption and reloads on later controller changes", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(false);

    const firstDecision = owner.readDecision({ reloadSuppressed: false });
    expect(firstDecision.shouldReload).toBe(false);
    expect(firstDecision.reason).toBe("first-controller-adoption");

    const secondDecision = owner.readDecision({ reloadSuppressed: false });
    expect(secondDecision.shouldReload).toBe(true);
    expect(secondDecision.reason).toBe("reload-required");

    const thirdDecision = owner.readDecision({ reloadSuppressed: false });
    expect(thirdDecision.shouldReload).toBe(false);
    expect(thirdDecision.reason).toBe("reload-already-requested");
  });

  it("reloads immediately when a controller already exists and no suppression is active", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(true);

    const firstDecision = owner.readDecision({ reloadSuppressed: false });
    expect(firstDecision.shouldReload).toBe(true);
    expect(firstDecision.reason).toBe("reload-required");

    const secondDecision = owner.readDecision({ reloadSuppressed: false });
    expect(secondDecision.shouldReload).toBe(false);
    expect(secondDecision.reason).toBe("reload-already-requested");
  });

  it("honors reload suppression and allows one unsuppressed reload afterward", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(true);

    const suppressedDecision = owner.readDecision({ reloadSuppressed: true });
    expect(suppressedDecision.shouldReload).toBe(false);
    expect(suppressedDecision.reason).toBe("reload-suppressed");

    const unsuppressedDecision = owner.readDecision({ reloadSuppressed: false });
    expect(unsuppressedDecision.shouldReload).toBe(true);
    expect(unsuppressedDecision.reason).toBe("reload-required");
  });

  it("does not consume the one reload while suppression remains active across rapid controller changes", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(true);

    const firstSuppressedDecision = owner.readDecision({ reloadSuppressed: true });
    const secondSuppressedDecision = owner.readDecision({ reloadSuppressed: true });
    const thirdSuppressedDecision = owner.readDecision({ reloadSuppressed: true });
    expect(firstSuppressedDecision.shouldReload).toBe(false);
    expect(firstSuppressedDecision.reason).toBe("reload-suppressed");
    expect(secondSuppressedDecision.shouldReload).toBe(false);
    expect(secondSuppressedDecision.reason).toBe("reload-suppressed");
    expect(thirdSuppressedDecision.shouldReload).toBe(false);
    expect(thirdSuppressedDecision.reason).toBe("reload-suppressed");

    const unsuppressedDecision = owner.readDecision({ reloadSuppressed: false });
    expect(unsuppressedDecision.shouldReload).toBe(true);
    expect(unsuppressedDecision.reason).toBe("reload-required");
  });

  it("keeps first-adoption skip deterministic even when suppression is active during adoption", () => {
    const owner = new ServiceWorkerControllerChangeReloadOwner(false);

    const firstSuppressedDecision = owner.readDecision({ reloadSuppressed: true });
    expect(firstSuppressedDecision.shouldReload).toBe(false);
    expect(firstSuppressedDecision.reason).toBe("first-controller-adoption");

    const secondSuppressedDecision = owner.readDecision({ reloadSuppressed: true });
    expect(secondSuppressedDecision.shouldReload).toBe(false);
    expect(secondSuppressedDecision.reason).toBe("reload-suppressed");

    const unsuppressedDecision = owner.readDecision({ reloadSuppressed: false });
    expect(unsuppressedDecision.shouldReload).toBe(true);
    expect(unsuppressedDecision.reason).toBe("reload-required");
  });
});
