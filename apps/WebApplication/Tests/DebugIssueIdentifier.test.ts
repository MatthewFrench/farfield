import { describe, expect, it } from "vitest";
import { buildDebugErrorIssueIdentifier } from "@/Features/Debugging/DomainModel/DebugIssueIdentifier";

describe("DebugIssueIdentifier", () => {
  it("builds stable debug error issue identifiers", () => {
    expect(buildDebugErrorIssueIdentifier("error-77")).toBe("error:error-77");
  });
});
