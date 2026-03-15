import {
  type CommandExecutionApprovalResponsePayload,
  type DeprecatedApprovalReviewDecision,
  type FileChangeApprovalResponsePayload,
  type ToolCallResponsePayload,
} from "@farfield/protocol";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Loader2 } from "lucide-react";
import { ChatComposer } from "@/Components/ChatComposer";
import { ConversationItem } from "@/Components/ConversationItem";
import { PendingApplyPatchApprovalRequestCard } from "@/Components/PendingApplyPatchApprovalRequestCard";
import { PendingAuthTokenRefreshRequestCard } from "@/Components/PendingAuthTokenRefreshRequestCard";
import { PendingCommandExecutionApprovalRequestCard } from "@/Components/PendingCommandExecutionApprovalRequestCard";
import { PendingExecuteCommandApprovalRequestCard } from "@/Components/PendingExecuteCommandApprovalRequestCard";
import { PendingFileChangeApprovalRequestCard } from "@/Components/PendingFileChangeApprovalRequestCard";
import { PendingRequestCard } from "@/Components/PendingRequestCard";
import { PendingToolCallRequestCard } from "@/Components/PendingToolCallRequestCard";
import { Button } from "@/Components/UserInterface/Button";
import { type FlattenedConversationItem } from "@/Features/Chat/DomainModel/ConversationItemFlattener";
import { type InterruptedTurnNotice } from "@/Features/Chat/DomainModel/InterruptedTurnNoticeDerivation";
import { type PendingApplyPatchApprovalRequest } from "@/Features/Chat/DomainModel/PendingApplyPatchApprovalRequestSelector";
import { type PendingAuthTokenRefreshRequest } from "@/Features/Chat/DomainModel/PendingAuthTokenRefreshRequestSelector";
import { type PendingCommandExecutionApprovalRequest } from "@/Features/Chat/DomainModel/PendingCommandExecutionApprovalRequestSelector";
import { type PendingExecuteCommandApprovalRequest } from "@/Features/Chat/DomainModel/PendingExecuteCommandApprovalRequestSelector";
import { type PendingFileChangeApprovalRequest } from "@/Features/Chat/DomainModel/PendingFileChangeApprovalRequestSelector";
import { type PendingToolCallRequest } from "@/Features/Chat/DomainModel/PendingToolCallRequestSelector";
import { type PendingUserInputAnswerDraftByQuestionId } from "@/Features/Chat/DomainModel/PendingUserInputAnswerBuilder";
import { type PendingUserInputRequest } from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { ChatModeToolbar, type ChatModeToolbarProps } from "./ChatModeToolbar";

export type ChatSurfaceState =
  | "loading-threads"
  | "loading-thread"
  | "no-messages"
  | "no-thread"
  | "ready";
type PendingRequestDraftField = "option" | "freeform";

const NO_THREAD_MOTION_KEY = "__no_thread__";
const THREAD_FADE_TRANSITION_DURATION_SECONDS = 0.14;
const JUMP_TO_BOTTOM_TRANSITION_DURATION_SECONDS = 0.18;
const THINKING_BANNER_TRANSITION_DURATION_SECONDS = 0.15;
const CHAT_LOG_ARIA_LABEL = "Conversation updates";

interface ChatEmptyStateDescriptor {
  testId: string;
  message: string;
  detail?: string;
  showLoadingIndicator: boolean;
}

function readChatEmptyStateDescriptor(
  chatSurfaceState: ChatSurfaceState,
  availableAgentIds: readonly AgentId[],
  canCreateNewThreadFromComposer: boolean,
): ChatEmptyStateDescriptor {
  switch (chatSurfaceState) {
    case "loading-threads":
      return {
        testId: "chat-empty-loading-threads",
        message: "Loading threads...",
        showLoadingIndicator: true,
      };
    case "loading-thread":
      return {
        testId: "chat-empty-loading-thread",
        message: "Loading thread...",
        showLoadingIndicator: true,
      };
    case "no-messages":
      return {
        testId: "chat-empty-no-messages",
        message: "This thread has no messages yet.",
        detail: "Send the first message to get started.",
        showLoadingIndicator: false,
      };
    case "no-thread":
      return {
        testId: "chat-empty-no-thread",
        message:
          availableAgentIds.length === 0
            ? "Select a thread from the sidebar"
            : canCreateNewThreadFromComposer
              ? "Start typing to create a new thread"
              : "Choose a project from the sidebar to start a new thread",
        showLoadingIndicator: false,
      };
    case "ready":
      // Empty-state rendering should never happen once the surface is marked ready.
      throw new Error(
        "ChatWorkspacePane received an empty-state render with chatSurfaceState set to 'ready'.",
      );
  }
}

function readCanSendMessage(selectedThreadId: string | null, canCreateNewThread: boolean): boolean {
  return selectedThreadId !== null || canCreateNewThread;
}

function readComposerPlaceholder(
  selectedThreadId: string | null,
  activeAgentLabel: string,
  selectedAgentLabel: string,
  canCreateNewThreadFromComposer: boolean,
): string {
  if (selectedThreadId === null && !canCreateNewThreadFromComposer) {
    return "Choose a project to start a new thread...";
  }
  return selectedThreadId !== null && selectedThreadId.length > 0
    ? `Message ${activeAgentLabel}…`
    : `Message ${selectedAgentLabel}…`;
}

export interface ChatWorkspacePaneProps {
  chatSurfaceState: ChatSurfaceState;
  interruptedTurnNotice: InterruptedTurnNotice | null;
  selectedThreadId: string | null;
  availableAgentIds: readonly AgentId[];
  canCreateNewThreadFromComposer: boolean;
  turnCount: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  chatContentRef: React.RefObject<HTMLDivElement | null>;
  visibleConversationItems: readonly FlattenedConversationItem[];
  hasHiddenChatItems: boolean;
  firstVisibleChatItemIndex: number;
  onShowOlderMessages: () => void;
  isChatAtBottom: boolean;
  onJumpToBottom: () => void;
  activeRequest: PendingUserInputRequest | null;
  activeAuthTokenRefreshRequest?: PendingAuthTokenRefreshRequest | null;
  activeApplyPatchApprovalRequest?: PendingApplyPatchApprovalRequest | null;
  activeCommandExecutionApprovalRequest?: PendingCommandExecutionApprovalRequest | null;
  activeExecuteCommandApprovalRequest?: PendingExecuteCommandApprovalRequest | null;
  activeFileChangeApprovalRequest?: PendingFileChangeApprovalRequest | null;
  activeToolCallRequest?: PendingToolCallRequest | null;
  canSubmitUserInputForActiveAgent: boolean;
  answerDraft: PendingUserInputAnswerDraftByQuestionId;
  onAnswerDraftChange: (questionId: string, field: PendingRequestDraftField, value: string) => void;
  onSubmitPendingRequest: () => void;
  onSkipPendingRequest: () => void;
  onSubmitAuthTokenRefreshRequest?: (
    accessToken: string,
    chatgptAccountId: string,
    chatgptPlanType: string | null,
  ) => void;
  onSubmitApplyPatchApprovalRequest?: (decision: DeprecatedApprovalReviewDecision) => void;
  onSubmitCommandExecutionApprovalRequest?: (
    decision: CommandExecutionApprovalResponsePayload["decision"],
  ) => void;
  onSubmitExecuteCommandApprovalRequest?: (decision: DeprecatedApprovalReviewDecision) => void;
  onSubmitFileChangeApprovalRequest?: (
    decision: FileChangeApprovalResponsePayload["decision"],
  ) => void;
  onSubmitToolCallRequestResponse?: (payload: ToolCallResponsePayload) => void;
  isBusy: boolean;
  isGenerating: boolean;
  activeAgentLabel: string;
  selectedAgentLabel: string;
  onInterrupt: () => void | Promise<void>;
  onForkFromMessage?: (messageId: string) => void;
  onSteerMessage: (text: string) => void | Promise<void>;
  onSendMessage: (text: string) => void | Promise<void>;
  chatModeToolbarProperties: ChatModeToolbarProps;
}

export function ChatWorkspacePane({
  chatSurfaceState,
  interruptedTurnNotice,
  selectedThreadId,
  availableAgentIds,
  canCreateNewThreadFromComposer,
  turnCount,
  scrollRef,
  chatContentRef,
  visibleConversationItems,
  hasHiddenChatItems,
  firstVisibleChatItemIndex,
  onShowOlderMessages,
  isChatAtBottom,
  onJumpToBottom,
  activeRequest,
  activeAuthTokenRefreshRequest,
  activeApplyPatchApprovalRequest,
  activeCommandExecutionApprovalRequest,
  activeExecuteCommandApprovalRequest,
  activeFileChangeApprovalRequest,
  activeToolCallRequest,
  canSubmitUserInputForActiveAgent,
  answerDraft,
  onAnswerDraftChange,
  onSubmitPendingRequest,
  onSkipPendingRequest,
  onSubmitAuthTokenRefreshRequest,
  onSubmitApplyPatchApprovalRequest,
  onSubmitCommandExecutionApprovalRequest,
  onSubmitExecuteCommandApprovalRequest,
  onSubmitFileChangeApprovalRequest,
  onSubmitToolCallRequestResponse,
  isBusy,
  isGenerating,
  activeAgentLabel,
  selectedAgentLabel,
  onInterrupt,
  onForkFromMessage,
  onSteerMessage,
  onSendMessage,
  chatModeToolbarProperties,
}: ChatWorkspacePaneProps): React.JSX.Element {
  const shouldRenderEmptyState = turnCount === 0;
  const canSendMessage = readCanSendMessage(selectedThreadId, canCreateNewThreadFromComposer);
  const composerPlaceholder = readComposerPlaceholder(
    selectedThreadId,
    activeAgentLabel,
    selectedAgentLabel,
    canCreateNewThreadFromComposer,
  );
  const emptyStateDescriptor = shouldRenderEmptyState
    ? readChatEmptyStateDescriptor(
        chatSurfaceState,
        availableAgentIds,
        canCreateNewThreadFromComposer,
      )
    : null;
  const shouldShowEmptyStateLoadingIndicator =
    emptyStateDescriptor !== null && emptyStateDescriptor.showLoadingIndicator === true;
  const loadingEmptyStateDescriptor = shouldShowEmptyStateLoadingIndicator
    ? emptyStateDescriptor
    : null;
  const shouldRenderJumpToBottomButton = !isChatAtBottom && turnCount > 0;

  return (
    <div
      data-testid="chat-surface"
      data-state={chatSurfaceState}
      aria-busy={isBusy || isGenerating}
      className="relative flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-4 z-10 h-[5.5rem] bg-gradient-to-b from-background from-52% via-background/78 via-82% to-transparent to-100%"
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-y-contain">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={selectedThreadId ?? NO_THREAD_MOTION_KEY}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: THREAD_FADE_TRANSITION_DURATION_SECONDS,
              ease: "easeOut",
            }}
            className="w-full px-4 md:px-6 lg:px-8 pt-8 pb-6"
          >
            {shouldRenderEmptyState ? (
              <div
                data-testid="chat-empty-state"
                className="text-center py-20 text-sm text-muted-foreground"
              >
                {loadingEmptyStateDescriptor !== null ? (
                  <span
                    data-testid={loadingEmptyStateDescriptor.testId}
                    className="inline-flex items-center gap-2"
                  >
                    <Loader2 size={14} className="animate-spin" />
                    {loadingEmptyStateDescriptor.message}
                  </span>
                ) : (
                  <span
                    data-testid={emptyStateDescriptor?.testId}
                    className="inline-flex flex-col items-center gap-1"
                  >
                    <span>{emptyStateDescriptor?.message}</span>
                    {emptyStateDescriptor?.detail !== undefined ? (
                      <span className="text-xs text-muted-foreground/80">
                        {emptyStateDescriptor.detail}
                      </span>
                    ) : null}
                  </span>
                )}
              </div>
            ) : (
              <div
                ref={chatContentRef}
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-atomic="false"
                aria-label={CHAT_LOG_ARIA_LABEL}
                className="space-y-0"
              >
                {interruptedTurnNotice !== null && (
                  <div
                    data-testid="chat-interrupted-turn-notice"
                    className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left"
                  >
                    <div className="text-sm font-medium text-foreground">
                      {interruptedTurnNotice.title}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {interruptedTurnNotice.message}
                    </p>
                  </div>
                )}
                {hasHiddenChatItems && (
                  <div className="flex justify-center pb-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={onShowOlderMessages}
                    >
                      Show older messages ({firstVisibleChatItemIndex})
                    </Button>
                  </div>
                )}
                {visibleConversationItems.map((entry) => (
                  <div key={entry.key} style={{ paddingTop: `${entry.spacingTop}px` }}>
                    <ConversationItem
                      item={entry.item}
                      isLast={entry.isLast}
                      turnIsInProgress={entry.turnIsInProgress}
                      previousItemType={entry.previousItemType}
                      nextItemType={entry.nextItemType}
                      onForkFromMessage={onForkFromMessage}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {shouldRenderJumpToBottomButton && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{
              duration: JUMP_TO_BOTTOM_TRANSITION_DURATION_SECONDS,
            }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[7.25rem] md:bottom-[7.75rem] z-20"
          >
            <Button
              type="button"
              data-testid="chat-jump-to-bottom-button"
              onClick={onJumpToBottom}
              aria-label="Jump to latest message"
              title="Jump to latest message"
              size="icon"
              className="h-10 w-10 rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-muted"
            >
              <ArrowDown size={16} aria-hidden="true" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="relative z-10 -mt-6 px-4 pt-6 shrink-0"
        style={{
          paddingBottom: "calc(var(--composer-bottom-spacing) + var(--composer-safe-bottom-inset))",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-transparent via-background/85 to-background"
        />
        <div className="relative w-full px-0 md:px-2 lg:px-4 space-y-2">
          <AnimatePresence>
            {activeApplyPatchApprovalRequest &&
            canSubmitUserInputForActiveAgent &&
            onSubmitApplyPatchApprovalRequest ? (
              <PendingApplyPatchApprovalRequestCard
                request={activeApplyPatchApprovalRequest}
                onSubmitDecision={onSubmitApplyPatchApprovalRequest}
                isBusy={isBusy}
              />
            ) : null}
            {activeCommandExecutionApprovalRequest &&
            canSubmitUserInputForActiveAgent &&
            onSubmitCommandExecutionApprovalRequest ? (
              <PendingCommandExecutionApprovalRequestCard
                request={activeCommandExecutionApprovalRequest}
                onSubmitDecision={onSubmitCommandExecutionApprovalRequest}
                isBusy={isBusy}
              />
            ) : null}
            {activeExecuteCommandApprovalRequest &&
            canSubmitUserInputForActiveAgent &&
            onSubmitExecuteCommandApprovalRequest ? (
              <PendingExecuteCommandApprovalRequestCard
                request={activeExecuteCommandApprovalRequest}
                onSubmitDecision={onSubmitExecuteCommandApprovalRequest}
                isBusy={isBusy}
              />
            ) : null}
            {activeFileChangeApprovalRequest &&
            canSubmitUserInputForActiveAgent &&
            onSubmitFileChangeApprovalRequest ? (
              <PendingFileChangeApprovalRequestCard
                request={activeFileChangeApprovalRequest}
                onSubmitDecision={onSubmitFileChangeApprovalRequest}
                isBusy={isBusy}
              />
            ) : null}
            {activeToolCallRequest &&
            canSubmitUserInputForActiveAgent &&
            onSubmitToolCallRequestResponse ? (
              <PendingToolCallRequestCard
                request={activeToolCallRequest}
                onSubmitResponse={onSubmitToolCallRequestResponse}
                isBusy={isBusy}
              />
            ) : null}
            {activeAuthTokenRefreshRequest &&
            canSubmitUserInputForActiveAgent &&
            onSubmitAuthTokenRefreshRequest ? (
              <PendingAuthTokenRefreshRequestCard
                request={activeAuthTokenRefreshRequest}
                onSubmit={onSubmitAuthTokenRefreshRequest}
                isBusy={isBusy}
              />
            ) : null}
            {activeRequest && canSubmitUserInputForActiveAgent && (
              <PendingRequestCard
                request={activeRequest}
                answerDraft={answerDraft}
                onDraftChange={onAnswerDraftChange}
                onSubmit={onSubmitPendingRequest}
                onSkip={onSkipPendingRequest}
                isBusy={isBusy}
              />
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{
                  duration: THINKING_BANNER_TRANSITION_DURATION_SECONDS,
                }}
                className="px-1 flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Loader2 size={11} className="animate-spin" />
                <span className="reasoning-shimmer font-medium">Thinking…</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-2">
            <ChatComposer
              canSend={canSendMessage}
              isBusy={isBusy}
              isGenerating={isGenerating}
              placeholder={composerPlaceholder}
              onInterrupt={onInterrupt}
              onSteer={onSteerMessage}
              onSend={onSendMessage}
            />

            <ChatModeToolbar {...chatModeToolbarProperties} />
          </div>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {isGenerating ? `${activeAgentLabel} is thinking.` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
