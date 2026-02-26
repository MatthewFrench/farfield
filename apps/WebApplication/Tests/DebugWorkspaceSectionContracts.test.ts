import { describe, expect, it } from "vitest";
import { parseDebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";

describe("DebugWorkspaceSectionContracts", () => {
  it("parses supported debug workspace section values", () => {
    expect(parseDebugWorkspaceSection("issues")).toBe("issues");
    expect(parseDebugWorkspaceSection("history")).toBe("history");
    expect(parseDebugWorkspaceSection("stream")).toBe("stream");
    expect(parseDebugWorkspaceSection("trace")).toBe("trace");
  });

  it("throws for unsupported debug workspace section values", () => {
    expect(() => parseDebugWorkspaceSection("unknown-section")).toThrowError();
  });
});
