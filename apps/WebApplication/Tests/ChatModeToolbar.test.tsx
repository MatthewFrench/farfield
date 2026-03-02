import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChatModeToolbar,
  type ChatModeToolbarProps,
} from "@/Features/Chat/UserInterface/ChatModeToolbar";

const APP_DEFAULT_VALUE = "__app_default__";
const DEFAULT_THREAD_ID = "thread-1";
const EXPECTED_PENDING_LABEL = "3 pending";

const baseChatModeToolbarProperties: ChatModeToolbarProps = {
  canSetCollaborationMode: true,
  canListCollaborationModes: true,
  canListModels: true,
  hasPlanModeOption: true,
  isPlanModeEnabled: false,
  selectedThreadId: DEFAULT_THREAD_ID,
  appDefaultValue: APP_DEFAULT_VALUE,
  appDefaultModel: "gpt-5.3-codex",
  appDefaultReasoningEffort: "medium",
  selectedModelId: "",
  selectedReasoningEffort: "",
  selectedModeKey: "default",
  modelOptionsWithoutAssumedDefault: [{ id: "gpt-4.1-mini", label: "GPT-4.1 mini" }],
  effortOptionsWithoutAssumedDefault: ["low", "high"],
  isModeSyncing: false,
  pendingRequestCount: 0,
  runtimeUsageSummaryLines: null,
  onTogglePlanMode: () => {},
  onModelChange: () => {},
  onReasoningEffortChange: () => {},
};

function renderChatModeToolbar(properties: ChatModeToolbarProps): void {
  cleanup();
  render(<ChatModeToolbar {...properties} />);
}

interface ChatModeToolbarPropertyOverrides {
  canSetCollaborationMode?: boolean;
  canListCollaborationModes?: boolean;
  canListModels?: boolean;
  hasPlanModeOption?: boolean;
  isPlanModeEnabled?: boolean;
  selectedThreadId?: string | null;
  appDefaultValue?: string;
  appDefaultModel?: string;
  appDefaultReasoningEffort?: string;
  selectedModelId?: string;
  selectedReasoningEffort?: string;
  selectedModeKey?: string;
  modelOptionsWithoutAssumedDefault?: Array<{ id: string; label: string }>;
  effortOptionsWithoutAssumedDefault?: string[];
  isModeSyncing?: boolean;
  pendingRequestCount?: number;
  runtimeUsageSummaryLines?: Array<{ label: string; leftPercent: number }> | null;
  onTogglePlanMode?: () => void;
  onModelChange?: (nextModelId: string) => void;
  onReasoningEffortChange?: (nextReasoningEffort: string) => void;
}

function buildChatModeToolbarProperties(
  overrides?: ChatModeToolbarPropertyOverrides,
): ChatModeToolbarProps {
  return {
    ...baseChatModeToolbarProperties,
    ...overrides,
  };
}

describe("ChatModeToolbar", () => {
  it("hides mode controls when collaboration mode changes are unavailable", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        canSetCollaborationMode: false,
      }),
    );

    expect(screen.queryByTestId("chat-mode-toolbar-plan-button")).toBeNull();
    expect(screen.queryByTestId("chat-mode-toolbar-model-select")).toBeNull();
    expect(screen.queryByTestId("chat-mode-toolbar-reasoning-effort-select")).toBeNull();
    expect(screen.queryByTestId("chat-mode-toolbar-mode-syncing")).toBeNull();
  });

  it("runs plan toggle action when plan control is clicked", () => {
    const onTogglePlanMode = vi.fn();

    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        onTogglePlanMode,
      }),
    );

    fireEvent.click(screen.getByTestId("chat-mode-toolbar-plan-button"));
    expect(onTogglePlanMode).toHaveBeenCalledTimes(1);
  });

  it("shows pending request count when pending items exist", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        pendingRequestCount: 3,
      }),
    );

    expect(screen.getByTestId("chat-mode-toolbar-pending-count").textContent).toBe(
      EXPECTED_PENDING_LABEL,
    );
  });

  it("does not show pending request count when no items are pending", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        pendingRequestCount: 0,
      }),
    );

    expect(screen.queryByTestId("chat-mode-toolbar-pending-count")).toBeNull();
  });

  it("shows runtime usage summary when available", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        runtimeUsageSummaryLines: [
          { label: "5h", leftPercent: 58 },
          { label: "Weekly", leftPercent: 73 },
        ],
      }),
    );

    expect(screen.getByTestId("chat-mode-toolbar-runtime-usage-summary").textContent).toContain(
      "5h left 58%",
    );
    expect(screen.getByTestId("chat-mode-toolbar-runtime-usage-summary").textContent).toContain(
      "Weekly left 73%",
    );
  });

  it("hides runtime usage summary when unavailable", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        runtimeUsageSummaryLines: null,
      }),
    );

    expect(screen.queryByTestId("chat-mode-toolbar-runtime-usage-summary")).toBeNull();
  });

  it("disables model and reasoning controls when no thread is selected", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        selectedThreadId: null,
      }),
    );

    expect(screen.getByTestId("chat-mode-toolbar-model-select").hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen.getByTestId("chat-mode-toolbar-reasoning-effort-select").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("disables mode setting controls when selected mode key is empty", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        selectedModeKey: "",
      }),
    );

    expect(screen.getByTestId("chat-mode-toolbar-model-select").hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen.getByTestId("chat-mode-toolbar-reasoning-effort-select").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("disables plan button when plan mode option is unavailable", () => {
    renderChatModeToolbar(
      buildChatModeToolbarProperties({
        hasPlanModeOption: false,
      }),
    );

    expect(screen.getByTestId("chat-mode-toolbar-plan-button").hasAttribute("disabled")).toBe(true);
  });
});
