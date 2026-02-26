import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChatWorkspacePane,
  type ChatWorkspacePaneProps
} from "@/Features/Chat/UserInterface/ChatWorkspacePane";

const baseChatWorkspacePaneProperties: ChatWorkspacePaneProps = {
  chatSurfaceState: "loading-threads",
  selectedThreadId: null,
  isCoreLoading: true,
  isSelectedThreadLoading: false,
  availableAgentIds: ["codex"],
  turnCount: 0,
  scrollRef: createRef<HTMLDivElement>(),
  chatContentRef: createRef<HTMLDivElement>(),
  visibleConversationItems: [],
  hasHiddenChatItems: false,
  firstVisibleChatItemIndex: 0,
  onShowOlderMessages: () => {},
  isChatAtBottom: true,
  onJumpToBottom: () => {},
  activeRequest: null,
  canSubmitUserInputForActiveAgent: false,
  answerDraft: {},
  onAnswerDraftChange: () => {},
  onSubmitPendingRequest: () => {},
  onSkipPendingRequest: () => {},
  isBusy: false,
  isGenerating: false,
  activeAgentLabel: "Codex",
  selectedAgentLabel: "Codex",
  onInterrupt: () => {},
  onSendMessage: () => {},
  chatModeToolbarProperties: {
    canSetCollaborationMode: false,
    canListCollaborationModes: false,
    canListModels: false,
    hasPlanModeOption: false,
    isPlanModeEnabled: false,
    selectedThreadId: null,
    appDefaultValue: "__app_default__",
    appDefaultModel: "gpt-5.3-codex",
    appDefaultReasoningEffort: "medium",
    selectedModelId: "",
    selectedReasoningEffort: "",
    selectedModeKey: "",
    modelOptionsWithoutAssumedDefault: [],
    effortOptionsWithoutAssumedDefault: [],
    isModeSyncing: false,
    pendingRequestCount: 0,
    onTogglePlanMode: () => {},
    onModelChange: () => {},
    onReasoningEffortChange: () => {}
  }
};

function renderChatWorkspacePane(properties?: Partial<ChatWorkspacePaneProps>): void {
  cleanup();
  render(
    <ChatWorkspacePane
      {...baseChatWorkspacePaneProperties}
      {...properties}
    />
  );
}

describe("ChatWorkspacePane", () => {
  it("renders loading-threads empty state when no thread is selected", () => {
    renderChatWorkspacePane();
    expect(screen.getByTestId("chat-empty-loading-threads")).toBeDefined();
  });

  it("renders no-thread empty state from chatSurfaceState even when loading flags are true", () => {
    renderChatWorkspacePane({
      chatSurfaceState: "no-thread",
      isCoreLoading: true,
      isSelectedThreadLoading: true,
      selectedThreadId: null,
      turnCount: 0
    });

    expect(screen.getByTestId("chat-empty-no-thread").textContent).toBe("Start typing to create a new thread");
    expect(screen.queryByTestId("chat-empty-loading-threads")).toBeNull();
  });

  it("invokes show older messages callback when hidden messages are available", () => {
    const onShowOlderMessages = vi.fn();

    renderChatWorkspacePane({
      turnCount: 5,
      hasHiddenChatItems: true,
      firstVisibleChatItemIndex: 3,
      onShowOlderMessages,
      chatSurfaceState: "ready"
    });

    fireEvent.click(screen.getByRole("button", { name: "Show older messages (3)" }));
    expect(onShowOlderMessages).toHaveBeenCalledTimes(1);
  });

  it("invokes jump-to-bottom callback when jump button is pressed", () => {
    const onJumpToBottom = vi.fn();

    renderChatWorkspacePane({
      turnCount: 2,
      isChatAtBottom: false,
      onJumpToBottom,
      chatSurfaceState: "ready"
    });

    fireEvent.click(screen.getByRole("button", { name: "Jump to latest message" }));
    expect(onJumpToBottom).toHaveBeenCalledTimes(1);
  });

  it("marks conversation entries as an assistive-technology live log", () => {
    renderChatWorkspacePane({
      turnCount: 1,
      chatSurfaceState: "ready",
      visibleConversationItems: []
    });

    expect(screen.getByRole("log", { name: "Conversation updates" })).toBeDefined();
  });
});
