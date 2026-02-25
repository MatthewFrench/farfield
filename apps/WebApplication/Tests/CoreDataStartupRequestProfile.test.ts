import { describe, expect, it } from "vitest";
import {
  STARTUP_CRITICAL_REQUEST_BUDGET_MAXIMUM,
  STARTUP_REQUEST_PROFILE
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
});
