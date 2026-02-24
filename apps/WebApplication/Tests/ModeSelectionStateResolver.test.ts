import { describe, expect, it } from "vitest";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";

describe("ModeSelectionStateResolver", () => {
  it("detects plan mode options by key or name", () => {
    const resolver = new ModeSelectionStateResolver();

    expect(resolver.isPlanModeOption({ mode: "plan", name: "Default" })).toBe(true);
    expect(resolver.isPlanModeOption({ mode: "default", name: "Plan Mode" })).toBe(true);
    expect(resolver.isPlanModeOption({ mode: "default", name: "Normal" })).toBe(false);
  });

  it("normalizes collaboration settings with assumed defaults", () => {
    const resolver = new ModeSelectionStateResolver();

    const selection = resolver.readModeSelectionFromConversationState(
      {
        latestModel: "gpt-5.3-codex",
        latestReasoningEffort: "medium",
        latestCollaborationMode: {
          mode: "default",
          settings: {
            model: "gpt-5.3-codex",
            reasoning_effort: "high",
            developer_instructions: null
          }
        }
      },
      "gpt-5.3-codex",
      "medium"
    );

    expect(selection).toEqual({
      modeKey: "default",
      modelId: "",
      reasoningEffort: "high"
    });
  });

  it("builds a deterministic signature for mode selection state", () => {
    const resolver = new ModeSelectionStateResolver();
    const signature = resolver.buildModeSignature("default", "gpt-5.3", "medium");

    expect(signature).toBe("default|gpt-5.3|medium");
  });
});
