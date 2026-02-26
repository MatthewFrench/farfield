import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type UseChatModeToolbarPropertiesInput,
  useChatModeToolbarProperties
} from "@/Features/Chat/StateManagement/UseChatModeToolbarProperties";
import type { ChatModeToolbarProps } from "@/Features/Chat/UserInterface/ChatModeToolbar";

interface ToolbarPropertiesHarnessProperties {
  input: UseChatModeToolbarPropertiesInput;
  onPropertiesReady: (properties: ChatModeToolbarProps) => void;
}

function ToolbarPropertiesHarness(properties: ToolbarPropertiesHarnessProperties): React.JSX.Element {
  const toolbarProperties = useChatModeToolbarProperties(properties.input);

  useEffect(() => {
    properties.onPropertiesReady(toolbarProperties);
  }, [properties, toolbarProperties]);

  return <></>;
}

function createInput(): UseChatModeToolbarPropertiesInput {
  return {
    canSetCollaborationMode: true,
    canListCollaborationModes: true,
    canListModels: true,
    planModeOption: {
      mode: "plan"
    },
    defaultModeKey: "default",
    isPlanModeEnabled: false,
    selectedThreadId: "thread-1",
    appDefaultValue: "__app_default__",
    appDefaultModel: "gpt-5.3-codex",
    appDefaultReasoningEffort: "medium",
    selectedModelId: "gpt-5",
    selectedReasoningEffort: "medium",
    selectedModeKey: "default",
    modelOptionsWithoutAssumedDefault: [
      {
        id: "gpt-5",
        label: "GPT-5"
      }
    ],
    effortOptionsWithoutAssumedDefault: ["low", "medium"],
    isModeSyncing: false,
    pendingRequestCount: 0,
    setSelectedModeKey: vi.fn(),
    setSelectedModelId: vi.fn(),
    setSelectedReasoningEffort: vi.fn(),
    applyModeDraft: vi.fn(async () => {})
  };
}

function readToolbarPropertiesSnapshot(snapshotReference: {
  current: ChatModeToolbarProps | null;
}): ChatModeToolbarProps {
  const toolbarProperties = snapshotReference.current;
  if (!toolbarProperties) {
    throw new Error("Expected toolbar properties to be captured");
  }
  return toolbarProperties;
}

describe("useChatModeToolbarProperties", () => {
  afterEach(() => {
    cleanup();
  });

  it("delegates toolbar actions through state setters and draft application", async () => {
    const input = createInput();
    const toolbarPropertiesSnapshot: { current: ChatModeToolbarProps | null } = {
      current: null
    };

    render(
      <ToolbarPropertiesHarness
        input={input}
        onPropertiesReady={(properties) => {
          toolbarPropertiesSnapshot.current = properties;
        }}
      />
    );

    await waitFor(() => {
      expect(toolbarPropertiesSnapshot.current).not.toBeNull();
    });

    const toolbarProperties = readToolbarPropertiesSnapshot(toolbarPropertiesSnapshot);
    toolbarProperties.onModelChange("gpt-5.1");
    toolbarProperties.onReasoningEffortChange("low");
    toolbarProperties.onTogglePlanMode();

    expect(input.setSelectedModelId).toHaveBeenCalledWith("gpt-5.1");
    expect(input.setSelectedReasoningEffort).toHaveBeenCalledWith("low");
    expect(input.setSelectedModeKey).toHaveBeenCalledWith("plan");
    expect(input.applyModeDraft).toHaveBeenCalledWith({
      modeKey: "default",
      modelId: "gpt-5.1",
      reasoningEffort: "medium"
    });
    expect(input.applyModeDraft).toHaveBeenCalledWith({
      modeKey: "default",
      modelId: "gpt-5",
      reasoningEffort: "low"
    });
    expect(input.applyModeDraft).toHaveBeenCalledWith({
      modeKey: "plan",
      modelId: "gpt-5",
      reasoningEffort: "medium"
    });
  });
});
