import { describe, expect, it } from "vitest";
import {
  type CollaborationModeOption,
  type ModeSelectionConversationState,
  ModeSelectionStateResolver,
} from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";

const DEFAULT_MODEL = "gpt-5.3-codex";
const DEFAULT_REASONING_EFFORT = "medium";

describe("ModeSelectionStateResolver", () => {
  it("detects plan mode options from key or mode name", () => {
    const resolver = new ModeSelectionStateResolver();

    const planByKey: CollaborationModeOption = {
      name: "Default",
      mode: "plan",
    };
    const planByName: CollaborationModeOption = {
      name: "Plan Workflow",
      mode: null,
    };
    const nonPlanMode: CollaborationModeOption = {
      name: "Default",
      mode: "default",
    };

    expect(resolver.isPlanModeOption(planByKey)).toBe(true);
    expect(resolver.isPlanModeOption(planByName)).toBe(true);
    expect(resolver.isPlanModeOption(nonPlanMode)).toBe(false);
  });

  it("returns an empty selection when conversation state is unavailable", () => {
    const resolver = new ModeSelectionStateResolver();

    expect(
      resolver.readModeSelectionFromConversationState(
        null,
        DEFAULT_MODEL,
        DEFAULT_REASONING_EFFORT,
      ),
    ).toEqual({
      modeKey: "",
      modelId: "",
      reasoningEffort: "",
    });
  });

  it("normalizes default mode settings to empty overrides", () => {
    const resolver = new ModeSelectionStateResolver();
    const conversationState: ModeSelectionConversationState = {
      latestCollaborationMode: {
        mode: "default",
        settings: {
          model: DEFAULT_MODEL,
          reasoning_effort: DEFAULT_REASONING_EFFORT,
        },
      },
    };

    expect(
      resolver.readModeSelectionFromConversationState(
        conversationState,
        DEFAULT_MODEL,
        DEFAULT_REASONING_EFFORT,
      ),
    ).toEqual({
      modeKey: "default",
      modelId: "",
      reasoningEffort: "",
    });
  });

  it("uses latest model fields when no collaboration mode is recorded", () => {
    const resolver = new ModeSelectionStateResolver();
    const conversationState: ModeSelectionConversationState = {
      latestModel: "gpt-4.1",
      latestReasoningEffort: "high",
      latestCollaborationMode: null,
    };

    expect(
      resolver.readModeSelectionFromConversationState(
        conversationState,
        DEFAULT_MODEL,
        DEFAULT_REASONING_EFFORT,
      ),
    ).toEqual({
      modeKey: "",
      modelId: "gpt-4.1",
      reasoningEffort: "high",
    });
  });
});
