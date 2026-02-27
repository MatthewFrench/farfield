import { describe, expect, it } from "vitest";
import {
  isStartupActionName,
  readStartupRequestDescription,
  STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
  STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM,
  STARTUP_REQUEST_ALLOWED_TIERS,
  STARTUP_REQUEST_PROFILE,
} from "../Source/Application/StateManagement/CoreDataStartupRequestProfile";

describe("CoreDataStartupRequestProfile", () => {
  it("keeps startup critical request count within budget", () => {
    const criticalRequestCount = STARTUP_REQUEST_PROFILE.filter(
      (entry) => entry.tier === "critical",
    ).length;
    expect(criticalRequestCount).toBeLessThanOrEqual(STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM);
  });

  it("keeps startup action names unique", () => {
    const actionNames = STARTUP_REQUEST_PROFILE.map((entry) => entry.actionName);
    const uniqueActionNames = new Set(actionNames);
    expect(uniqueActionNames.size).toBe(actionNames.length);
  });

  it("keeps startup request tiers within the owner allowed tier set", () => {
    const startupRequestAllowedTierSet = new Set(STARTUP_REQUEST_ALLOWED_TIERS);
    for (const startupRequestProfileEntry of STARTUP_REQUEST_PROFILE) {
      expect(startupRequestAllowedTierSet.has(startupRequestProfileEntry.tier)).toBe(true);
    }
  });

  it("keeps startup request descriptions non-empty", () => {
    for (const startupRequestProfileEntry of STARTUP_REQUEST_PROFILE) {
      expect(startupRequestProfileEntry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves startup action-name membership from owner index", () => {
    for (const startupRequestProfileEntry of STARTUP_REQUEST_PROFILE) {
      expect(isStartupActionName(startupRequestProfileEntry.actionName)).toBe(true);
    }
    expect(isStartupActionName(STARTUP_CRITICAL_EVENTS_SESSION_OPERATION)).toBe(true);
    expect(isStartupActionName("startup-unknown.operation")).toBe(false);
  });

  it("resolves startup request descriptions from owner index and preserves unknown action names", () => {
    for (const startupRequestProfileEntry of STARTUP_REQUEST_PROFILE) {
      expect(readStartupRequestDescription(startupRequestProfileEntry.actionName)).toBe(
        startupRequestProfileEntry.description,
      );
    }
    expect(readStartupRequestDescription(STARTUP_CRITICAL_EVENTS_SESSION_OPERATION)).toBe(
      "Bootstrap API session/auth gate",
    );
    expect(readStartupRequestDescription("startup-unknown.operation")).toBe(
      "startup-unknown.operation",
    );
  });

  it("keeps membership and description lookup deterministic across repeated reads", () => {
    const firstStartupProfileEntry = STARTUP_REQUEST_PROFILE[0];
    if (firstStartupProfileEntry === undefined) {
      throw new Error("Expected startup request profile to contain at least one entry");
    }
    const unknownActionName = "startup-unknown.operation";

    expect(isStartupActionName(firstStartupProfileEntry.actionName)).toBe(true);
    expect(isStartupActionName(firstStartupProfileEntry.actionName)).toBe(true);
    expect(readStartupRequestDescription(firstStartupProfileEntry.actionName)).toBe(
      firstStartupProfileEntry.description,
    );
    expect(readStartupRequestDescription(firstStartupProfileEntry.actionName)).toBe(
      firstStartupProfileEntry.description,
    );
    expect(readStartupRequestDescription(unknownActionName)).toBe(unknownActionName);
    expect(readStartupRequestDescription(unknownActionName)).toBe(unknownActionName);
  });
});
