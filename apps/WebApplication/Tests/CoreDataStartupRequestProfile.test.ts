import { describe, expect, it } from "vitest";
import {
  STARTUP_CRITICAL_EVENTS_SESSION_OPERATION,
  STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM,
  STARTUP_REQUEST_PROFILE,
  isStartupActionName,
  readStartupRequestDescription
} from "../Source/Application/StateManagement/CoreDataStartupRequestProfile";

describe("CoreDataStartupRequestProfile", () => {
  it("keeps startup critical request count within budget", () => {
    const criticalRequestCount = STARTUP_REQUEST_PROFILE.filter((entry) => entry.tier === "critical").length;
    expect(criticalRequestCount).toBeLessThanOrEqual(STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM);
  });

  it("keeps startup action names unique", () => {
    const actionNames = STARTUP_REQUEST_PROFILE.map((entry) => entry.actionName);
    const uniqueActionNames = new Set(actionNames);
    expect(uniqueActionNames.size).toBe(actionNames.length);
  });

  it("resolves startup action-name membership from owner index", () => {
    expect(isStartupActionName(STARTUP_CRITICAL_EVENTS_SESSION_OPERATION)).toBe(true);
    expect(isStartupActionName("startup-unknown.operation")).toBe(false);
  });

  it("resolves startup request descriptions and preserves unknown action names", () => {
    expect(readStartupRequestDescription(STARTUP_CRITICAL_EVENTS_SESSION_OPERATION)).toBe(
      "Bootstrap API session/auth gate"
    );
    expect(readStartupRequestDescription("startup-unknown.operation")).toBe("startup-unknown.operation");
  });
});
