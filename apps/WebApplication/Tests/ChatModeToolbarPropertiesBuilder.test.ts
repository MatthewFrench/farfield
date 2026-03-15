import { describe, expect, it, vi } from "vitest";
import {
  type BuildChatModeToolbarPropertiesInput,
  ChatModeToolbarPropertiesBuilder,
} from "../Source/Features/Chat/UserInterface/ChatModeToolbarPropertiesBuilder";

function createInput(): BuildChatModeToolbarPropertiesInput {
  return {
    canSetCollaborationMode: true,
    canListCollaborationModes: true,
    canListModels: true,
    planModeOption: {
      mode: "plan",
    },
    defaultModeKey: "default",
    isPlanModeEnabled: false,
    selectedThreadId: "thread-1",
    appDefaultValue: "__app_default__",
    appDefaultModel: "gpt-5.3-codex",
    appDefaultReasoningEffort: "medium",
    selectedModelId: "gpt-5",
    selectedReasoningEffort: "high",
    selectedModeKey: "default",
    modelOptionsWithoutAssumedDefault: [{ id: "gpt-5", label: "GPT-5" }],
    effortOptionsWithoutAssumedDefault: ["low", "high"],
    isModeSyncing: false,
    pendingRequestCount: 0,
    runningTerminalCount: 0,
    onSetSelectedModeKey: vi.fn(),
    onSetSelectedModelId: vi.fn(),
    onSetSelectedReasoningEffort: vi.fn(),
    onApplyModeDraft: vi.fn(),
  };
}

describe("ChatModeToolbarPropertiesBuilder", () => {
  it("applies plan mode draft when plan mode is toggled on", () => {
    const builder = new ChatModeToolbarPropertiesBuilder();
    const input = createInput();

    const properties = builder.build(input);
    properties.onTogglePlanMode();

    expect(input.onSetSelectedModeKey).toHaveBeenCalledWith("plan");
    expect(input.onApplyModeDraft).toHaveBeenCalledWith({
      modeKey: "plan",
      modelId: "gpt-5",
      reasoningEffort: "high",
    });
  });

  it("restores default mode draft when plan mode is toggled off", () => {
    const builder = new ChatModeToolbarPropertiesBuilder();
    const input = createInput();
    input.isPlanModeEnabled = true;
    input.selectedModeKey = "plan";

    const properties = builder.build(input);
    properties.onTogglePlanMode();

    expect(input.onSetSelectedModeKey).toHaveBeenCalledWith("default");
    expect(input.onApplyModeDraft).toHaveBeenCalledWith({
      modeKey: "default",
      modelId: "gpt-5",
      reasoningEffort: "high",
    });
  });

  it("skips toggle behavior when no next mode key can be resolved", () => {
    const builder = new ChatModeToolbarPropertiesBuilder();
    const input = createInput();
    input.planModeOption = {};
    input.defaultModeKey = null;
    input.selectedModeKey = "";

    const properties = builder.build(input);
    properties.onTogglePlanMode();

    expect(input.onSetSelectedModeKey).not.toHaveBeenCalled();
    expect(input.onApplyModeDraft).not.toHaveBeenCalled();
  });

  it("keeps mode and reasoning selections when model selection changes", () => {
    const builder = new ChatModeToolbarPropertiesBuilder();
    const input = createInput();

    const properties = builder.build(input);
    properties.onModelChange("gpt-5.1");

    expect(input.onSetSelectedModelId).toHaveBeenCalledWith("gpt-5.1");
    expect(input.onApplyModeDraft).toHaveBeenCalledWith({
      modeKey: "default",
      modelId: "gpt-5.1",
      reasoningEffort: "high",
    });
  });

  it("uses the default mode key when reasoning effort changes while the default mode is selected implicitly", () => {
    const builder = new ChatModeToolbarPropertiesBuilder();
    const input = createInput();
    input.selectedModeKey = "";

    const properties = builder.build(input);
    properties.onReasoningEffortChange("low");

    expect(input.onSetSelectedReasoningEffort).toHaveBeenCalledWith("low");
    expect(input.onApplyModeDraft).toHaveBeenCalledWith({
      modeKey: "default",
      modelId: "gpt-5",
      reasoningEffort: "low",
    });
  });

  it("keeps mode and model selections when reasoning effort changes", () => {
    const builder = new ChatModeToolbarPropertiesBuilder();
    const input = createInput();

    const properties = builder.build(input);
    properties.onReasoningEffortChange("low");

    expect(input.onSetSelectedReasoningEffort).toHaveBeenCalledWith("low");
    expect(input.onApplyModeDraft).toHaveBeenCalledWith({
      modeKey: "default",
      modelId: "gpt-5",
      reasoningEffort: "low",
    });
  });

  it("passes running terminal count through to toolbar view properties", () => {
    const builder = new ChatModeToolbarPropertiesBuilder();
    const input = createInput();
    input.runningTerminalCount = 4;

    const properties = builder.build(input);

    expect(properties.runningTerminalCount).toBe(4);
  });
});
