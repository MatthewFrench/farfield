import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChatModeToolbar,
  type ChatModeToolbarProps
} from "@/Features/Chat/UserInterface/ChatModeToolbar";

const baseChatModeToolbarProperties: ChatModeToolbarProps = {
  canSetCollaborationMode: true,
  canListCollaborationModes: true,
  canListModels: true,
  hasPlanModeOption: true,
  isPlanModeEnabled: false,
  selectedThreadId: "thread-1",
  appDefaultValue: "__app_default__",
  appDefaultModel: "gpt-5.3-codex",
  appDefaultReasoningEffort: "medium",
  selectedModelId: "",
  selectedReasoningEffort: "",
  selectedModeKey: "default",
  modelOptionsWithoutAssumedDefault: [
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" }
  ],
  effortOptionsWithoutAssumedDefault: ["low", "high"],
  isModeSyncing: false,
  pendingRequestCount: 0,
  onTogglePlanMode: () => {},
  onModelChange: () => {},
  onReasoningEffortChange: () => {}
};

function renderChatModeToolbar(properties: ChatModeToolbarProps): void {
  cleanup();
  render(<ChatModeToolbar {...properties} />);
}

describe("ChatModeToolbar", () => {
  it("hides mode controls when collaboration mode changes are unavailable", () => {
    renderChatModeToolbar({
      ...baseChatModeToolbarProperties,
      canSetCollaborationMode: false
    });

    expect(screen.queryByTestId("chat-mode-toolbar-plan-button")).toBeNull();
    expect(screen.queryByTestId("chat-mode-toolbar-model-select")).toBeNull();
    expect(screen.queryByTestId("chat-mode-toolbar-reasoning-effort-select")).toBeNull();
  });

  it("runs plan toggle action when plan control is clicked", () => {
    const onTogglePlanMode = vi.fn();

    renderChatModeToolbar({
      ...baseChatModeToolbarProperties,
      onTogglePlanMode
    });

    fireEvent.click(screen.getByTestId("chat-mode-toolbar-plan-button"));
    expect(onTogglePlanMode).toHaveBeenCalledTimes(1);
  });

  it("shows pending request count when pending items exist", () => {
    renderChatModeToolbar({
      ...baseChatModeToolbarProperties,
      pendingRequestCount: 3
    });

    expect(screen.getByTestId("chat-mode-toolbar-pending-count").textContent).toBe("3 pending");
  });

  it("disables model and reasoning controls when no thread is selected", () => {
    renderChatModeToolbar({
      ...baseChatModeToolbarProperties,
      selectedThreadId: null
    });

    expect(screen.getByTestId("chat-mode-toolbar-model-select").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("chat-mode-toolbar-reasoning-effort-select").hasAttribute("disabled")).toBe(true);
  });
});
