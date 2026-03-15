import { ChatGptAuthTokensRefreshRequestMethod } from "@farfield/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { type PendingApplyPatchApprovalRequest } from "@/Features/Chat/DomainModel/PendingApplyPatchApprovalRequestSelector";
import { type PendingAuthTokenRefreshRequest } from "@/Features/Chat/DomainModel/PendingAuthTokenRefreshRequestSelector";
import { type PendingCommandExecutionApprovalRequest } from "@/Features/Chat/DomainModel/PendingCommandExecutionApprovalRequestSelector";
import { type PendingExecuteCommandApprovalRequest } from "@/Features/Chat/DomainModel/PendingExecuteCommandApprovalRequestSelector";
import { type PendingFileChangeApprovalRequest } from "@/Features/Chat/DomainModel/PendingFileChangeApprovalRequestSelector";
import { type PendingToolCallRequest } from "@/Features/Chat/DomainModel/PendingToolCallRequestSelector";
import {
  ChatWorkspacePane,
  type ChatWorkspacePaneProps,
} from "@/Features/Chat/UserInterface/ChatWorkspacePane";

const baseChatWorkspacePaneProperties: ChatWorkspacePaneProps = {
  chatSurfaceState: "loading-threads",
  interruptedTurnNotice: null,
  selectedThreadId: null,
  availableAgentIds: ["codex"],
  canCreateNewThreadFromComposer: true,
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
  onSteerMessage: () => {},
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
    runningTerminalCount: 0,
    onTogglePlanMode: () => {},
    onModelChange: () => {},
    onReasoningEffortChange: () => {},
  },
};

function renderChatWorkspacePane(properties?: Partial<ChatWorkspacePaneProps>): void {
  cleanup();
  render(<ChatWorkspacePane {...baseChatWorkspacePaneProperties} {...properties} />);
}

function buildPendingAuthTokenRefreshRequest(): PendingAuthTokenRefreshRequest {
  return {
    method: ChatGptAuthTokensRefreshRequestMethod,
    id: 91,
    completed: false,
    params: {
      reason: "unauthorized",
      previousAccountId: "account-previous",
    },
  };
}

function buildPendingCommandExecutionApprovalRequest(): PendingCommandExecutionApprovalRequest {
  return {
    method: "item/commandExecution/requestApproval",
    id: 92,
    completed: false,
    params: {
      threadId: "thread-1",
      turnId: "turn-92",
      itemId: "item-92",
      command: "git status",
      reason: "Needs read access to inspect state.",
      proposedExecpolicyAmendment: ["git status"],
    },
  };
}

function buildPendingApplyPatchApprovalRequest(): PendingApplyPatchApprovalRequest {
  return {
    method: "applyPatchApproval",
    id: 95,
    completed: false,
    params: {
      callId: "call-95",
      changes: "*** Begin Patch\n*** End Patch",
      grantRoot: "/workspace",
      reason: "Legacy apply patch approval path.",
    },
  };
}

function buildPendingExecuteCommandApprovalRequest(): PendingExecuteCommandApprovalRequest {
  return {
    method: "execCommandApproval",
    id: 96,
    completed: false,
    params: {
      callId: "call-96",
      command: ["git", "status"],
      cwd: "/workspace",
      reason: "Legacy execute command approval path.",
    },
  };
}

function buildPendingFileChangeApprovalRequest(): PendingFileChangeApprovalRequest {
  return {
    method: "item/fileChange/requestApproval",
    id: 93,
    completed: false,
    params: {
      threadId: "thread-1",
      turnId: "turn-93",
      itemId: "item-93",
      reason: "Needs to update source files.",
      grantRoot: "/workspace",
    },
  };
}

function buildPendingToolCallRequest(): PendingToolCallRequest {
  return {
    method: "item/tool/call",
    id: 94,
    completed: false,
    params: {
      threadId: "thread-1",
      turnId: "turn-94",
      callId: "call-94",
      tool: "files.search",
      arguments: {
        query: "README",
      },
    },
  };
}

describe("ChatWorkspacePane", () => {
  it("renders loading-threads empty state when no thread is selected", () => {
    renderChatWorkspacePane();
    expect(screen.getByTestId("chat-empty-loading-threads")).toBeDefined();
  });

  it("renders no-thread empty state from chatSurfaceState", () => {
    renderChatWorkspacePane({
      chatSurfaceState: "no-thread",
      selectedThreadId: null,
      turnCount: 0,
    });

    expect(screen.getByTestId("chat-empty-no-thread").textContent).toBe(
      "Start typing to create a new thread",
    );
    expect(screen.queryByTestId("chat-empty-loading-threads")).toBeNull();
  });

  it("renders no-thread sidebar selection guidance when no agent is available for new-thread creation", () => {
    renderChatWorkspacePane({
      chatSurfaceState: "no-thread",
      selectedThreadId: null,
      availableAgentIds: [],
      turnCount: 0,
    });

    expect(screen.getByTestId("chat-empty-no-thread").textContent).toBe(
      "Select a thread from the sidebar",
    );
  });

  it("renders project-selection guidance when chat cannot resolve a project for new-thread creation", () => {
    renderChatWorkspacePane({
      chatSurfaceState: "no-thread",
      selectedThreadId: null,
      availableAgentIds: ["codex"],
      canCreateNewThreadFromComposer: false,
      turnCount: 0,
    });

    expect(screen.getByTestId("chat-empty-no-thread").textContent).toBe(
      "Choose a project from the sidebar to start a new thread",
    );
    expect(screen.getByPlaceholderText("Choose a project to start a new thread...")).toBeDefined();
  });

  it("renders clearer empty-thread guidance when a selected thread has no messages", () => {
    renderChatWorkspacePane({
      chatSurfaceState: "no-messages",
      selectedThreadId: "thread-empty",
      turnCount: 0,
    });

    expect(screen.getByTestId("chat-empty-no-messages").textContent).toContain(
      "This thread has no messages yet.",
    );
    expect(screen.getByTestId("chat-empty-no-messages").textContent).toContain(
      "Send the first message to get started.",
    );
  });

  it("renders an interrupted-turn notice above conversation content", () => {
    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      interruptedTurnNotice: {
        title: "Turn Interrupted",
        message:
          "This turn ended before the agent produced a response. Send another message to retry.",
      },
      turnCount: 1,
      visibleConversationItems: [],
    });

    expect(screen.getByTestId("chat-interrupted-turn-notice").textContent).toContain(
      "Turn Interrupted",
    );
    expect(screen.getByTestId("chat-interrupted-turn-notice").textContent).toContain(
      "This turn ended before the agent produced a response. Send another message to retry.",
    );
  });

  it("fails fast when an empty-state render is requested while the surface state is ready", () => {
    expect(() => {
      renderChatWorkspacePane({
        chatSurfaceState: "ready",
        selectedThreadId: null,
        turnCount: 0,
      });
    }).toThrowError(
      "ChatWorkspacePane received an empty-state render with chatSurfaceState set to 'ready'.",
    );
  });

  it("invokes show older messages callback when hidden messages are available", () => {
    const onShowOlderMessages = vi.fn();

    renderChatWorkspacePane({
      turnCount: 5,
      hasHiddenChatItems: true,
      firstVisibleChatItemIndex: 3,
      onShowOlderMessages,
      chatSurfaceState: "ready",
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
      chatSurfaceState: "ready",
    });

    fireEvent.click(screen.getByRole("button", { name: "Jump to latest message" }));
    expect(onJumpToBottom).toHaveBeenCalledTimes(1);
  });

  it("marks conversation entries as an assistive-technology live log", () => {
    renderChatWorkspacePane({
      turnCount: 1,
      chatSurfaceState: "ready",
      visibleConversationItems: [],
    });

    expect(screen.getByRole("log", { name: "Conversation updates" })).toBeDefined();
  });

  it("routes per-message fork actions through the provided handler", () => {
    const onForkFromMessage = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      selectedThreadId: "thread-1",
      turnCount: 1,
      onForkFromMessage,
      visibleConversationItems: [
        {
          key: "message-1",
          item: {
            id: "message-1",
            type: "userMessage",
            content: [
              {
                type: "text",
                text: "Branch here",
              },
            ],
          },
          isLast: true,
          turnIsInProgress: false,
          spacingTop: 0,
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Fork from here" }));
    expect(onForkFromMessage).toHaveBeenCalledWith("message-1");
  });

  it("uses the selected-agent placeholder when no thread is selected", () => {
    renderChatWorkspacePane({
      selectedThreadId: null,
      selectedAgentLabel: "OpenCode",
    });

    expect(screen.getByPlaceholderText("Message OpenCode…")).toBeDefined();
  });

  it("uses the active-agent placeholder when a thread is selected", () => {
    renderChatWorkspacePane({
      selectedThreadId: "thread-001",
      activeAgentLabel: "OpenCode",
    });

    expect(screen.getByPlaceholderText("Message OpenCode…")).toBeDefined();
  });

  it("renders auth-token refresh card when there is an active request and submit capability", () => {
    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeAuthTokenRefreshRequest: buildPendingAuthTokenRefreshRequest(),
      onSubmitAuthTokenRefreshRequest: () => {},
    });

    expect(screen.getByText("Auth token refresh request")).toBeDefined();
    expect(screen.getByText(/Codex requested token refresh because of:/)).toBeDefined();
    expect(screen.getByText("Previous account hint:")).toBeDefined();
  });

  it("submits auth-token refresh values from the request card", () => {
    const onSubmitAuthTokenRefreshRequest = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeAuthTokenRefreshRequest: buildPendingAuthTokenRefreshRequest(),
      onSubmitAuthTokenRefreshRequest,
      isBusy: false,
    });

    fireEvent.change(screen.getByLabelText("Access token"), {
      target: { value: "  token-new  " },
    });
    fireEvent.change(screen.getByLabelText("ChatGPT account identifier"), {
      target: { value: " account-new " },
    });
    fireEvent.change(screen.getByLabelText("Plan type (optional)"), {
      target: { value: " pro " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit refresh token" }));

    expect(onSubmitAuthTokenRefreshRequest).toHaveBeenCalledWith("token-new", "account-new", "pro");
  });

  it("submits command approval decisions from the command approval card", () => {
    const onSubmitCommandExecutionApprovalRequest = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeCommandExecutionApprovalRequest: buildPendingCommandExecutionApprovalRequest(),
      onSubmitCommandExecutionApprovalRequest,
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve for session" }));

    expect(onSubmitCommandExecutionApprovalRequest).toHaveBeenCalledWith("acceptForSession");
  });

  it("submits file-change approval decisions from the file-change approval card", () => {
    const onSubmitFileChangeApprovalRequest = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeFileChangeApprovalRequest: buildPendingFileChangeApprovalRequest(),
      onSubmitFileChangeApprovalRequest,
    });

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(onSubmitFileChangeApprovalRequest).toHaveBeenCalledWith("decline");
  });

  it("submits apply-patch approval decisions from the deprecated apply-patch approval card", () => {
    const onSubmitApplyPatchApprovalRequest = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeApplyPatchApprovalRequest: buildPendingApplyPatchApprovalRequest(),
      onSubmitApplyPatchApprovalRequest,
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve for session" }));

    expect(onSubmitApplyPatchApprovalRequest).toHaveBeenCalledWith("approved_for_session");
  });

  it("submits apply-patch execpolicy-amendment decisions from the deprecated apply-patch approval card", () => {
    const onSubmitApplyPatchApprovalRequest = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeApplyPatchApprovalRequest: buildPendingApplyPatchApprovalRequest(),
      onSubmitApplyPatchApprovalRequest,
    });

    fireEvent.change(screen.getByLabelText("Execpolicy amendment commands (one per line)"), {
      target: { value: " git status \n git diff --stat " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve with execpolicy amendment" }));

    expect(onSubmitApplyPatchApprovalRequest).toHaveBeenCalledWith({
      approved_execpolicy_amendment: {
        proposed_execpolicy_amendment: ["git status", "git diff --stat"],
      },
    });
  });

  it("submits execute-command approval decisions from the deprecated execute-command approval card", () => {
    const onSubmitExecuteCommandApprovalRequest = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeExecuteCommandApprovalRequest: buildPendingExecuteCommandApprovalRequest(),
      onSubmitExecuteCommandApprovalRequest,
    });

    fireEvent.click(screen.getByRole("button", { name: "Deny" }));

    expect(onSubmitExecuteCommandApprovalRequest).toHaveBeenCalledWith("denied");
  });

  it("submits execute-command execpolicy-amendment decisions from the deprecated execute-command approval card", () => {
    const onSubmitExecuteCommandApprovalRequest = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeExecuteCommandApprovalRequest: buildPendingExecuteCommandApprovalRequest(),
      onSubmitExecuteCommandApprovalRequest,
    });

    fireEvent.change(screen.getByLabelText("Execpolicy amendment commands (one per line)"), {
      target: { value: " git status \n npm test " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve with execpolicy amendment" }));

    expect(onSubmitExecuteCommandApprovalRequest).toHaveBeenCalledWith({
      approved_execpolicy_amendment: {
        proposed_execpolicy_amendment: ["git status", "npm test"],
      },
    });
  });

  it("submits tool-call responses from the tool-call request card", () => {
    const onSubmitToolCallRequestResponse = vi.fn();

    renderChatWorkspacePane({
      chatSurfaceState: "ready",
      turnCount: 1,
      canSubmitUserInputForActiveAgent: true,
      activeToolCallRequest: buildPendingToolCallRequest(),
      onSubmitToolCallRequestResponse,
      isBusy: false,
    });

    fireEvent.change(screen.getByLabelText("Response text"), {
      target: { value: "  done  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit success" }));

    expect(onSubmitToolCallRequestResponse).toHaveBeenCalledWith({
      success: true,
      contentItems: [
        {
          type: "inputText",
          text: "done",
        },
      ],
    });
  });
});
