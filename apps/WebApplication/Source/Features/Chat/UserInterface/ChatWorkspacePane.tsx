import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Loader2 } from "lucide-react";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import {
  type FlattenedConversationItem
} from "@/Features/Chat/DomainModel/ConversationItemFlattener";
import { type PendingUserInputRequest } from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { ConversationItem } from "@/Components/ConversationItem";
import { ChatComposer } from "@/Components/ChatComposer";
import { PendingRequestCard } from "@/Components/PendingRequestCard";
import { Button } from "@/Components/UserInterface/Button";
import { ChatModeToolbar, type ChatModeToolbarProps } from "./ChatModeToolbar";

type ChatSurfaceState = "loading-threads" | "loading-thread" | "no-messages" | "no-thread" | "ready";

interface ChatEmptyStateDescriptor {
  testId: string;
  message: string;
  showLoadingIndicator: boolean;
}

function readChatEmptyStateDescriptor(
  chatSurfaceState: ChatSurfaceState,
  canCreateNewThread: boolean
): ChatEmptyStateDescriptor {
  if (chatSurfaceState === "loading-threads") {
    return {
      testId: "chat-empty-loading-threads",
      message: "Loading threads...",
      showLoadingIndicator: true
    };
  }

  if (chatSurfaceState === "loading-thread") {
    return {
      testId: "chat-empty-loading-thread",
      message: "Loading thread...",
      showLoadingIndicator: true
    };
  }

  if (chatSurfaceState === "no-messages") {
    return {
      testId: "chat-empty-no-messages",
      message: "No messages yet",
      showLoadingIndicator: false
    };
  }

  if (chatSurfaceState === "no-thread") {
    return {
      testId: "chat-empty-no-thread",
      message: canCreateNewThread ? "Start typing to create a new thread" : "Select a thread from the sidebar",
      showLoadingIndicator: false
    };
  }

  throw new Error("ChatWorkspacePane received an empty-state render with chatSurfaceState set to 'ready'.");
}

export interface ChatWorkspacePaneProps {
  chatSurfaceState: ChatSurfaceState;
  selectedThreadId: string | null;
  isCoreLoading: boolean;
  isSelectedThreadLoading: boolean;
  availableAgentIds: readonly AgentId[];
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
  canSubmitUserInputForActiveAgent: boolean;
  answerDraft: Record<string, { option: string; freeform: string }>;
  onAnswerDraftChange: (questionId: string, field: "option" | "freeform", value: string) => void;
  onSubmitPendingRequest: () => void;
  onSkipPendingRequest: () => void;
  isBusy: boolean;
  isGenerating: boolean;
  activeAgentLabel: string;
  selectedAgentLabel: string;
  onInterrupt: () => void | Promise<void>;
  onSendMessage: (text: string) => void | Promise<void>;
  chatModeToolbarProperties: ChatModeToolbarProps;
}

export function ChatWorkspacePane({
  chatSurfaceState,
  selectedThreadId,
  availableAgentIds,
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
  canSubmitUserInputForActiveAgent,
  answerDraft,
  onAnswerDraftChange,
  onSubmitPendingRequest,
  onSkipPendingRequest,
  isBusy,
  isGenerating,
  activeAgentLabel,
  selectedAgentLabel,
  onInterrupt,
  onSendMessage,
  chatModeToolbarProperties
}: ChatWorkspacePaneProps): React.JSX.Element {
  const emptyStateDescriptor = turnCount === 0
    ? readChatEmptyStateDescriptor(chatSurfaceState, availableAgentIds.length > 0)
    : null;

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
            key={selectedThreadId ?? "__no_thread__"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="w-full px-4 md:px-6 lg:px-8 pt-8 pb-6"
          >
            {turnCount === 0 ? (
              <div data-testid="chat-empty-state" className="text-center py-20 text-sm text-muted-foreground">
                {emptyStateDescriptor?.showLoadingIndicator
                  ? (
                    <span data-testid={emptyStateDescriptor.testId} className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {emptyStateDescriptor.message}
                    </span>
                  )
                  : <span data-testid={emptyStateDescriptor?.testId}>{emptyStateDescriptor?.message}</span>}
              </div>
            ) : (
              <div
                ref={chatContentRef}
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-atomic="false"
                aria-label="Conversation updates"
                className="space-y-0"
              >
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
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {!isChatAtBottom && turnCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
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
        style={{ paddingBottom: "calc(var(--composer-bottom-spacing) + var(--composer-safe-bottom-inset))" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-transparent via-background/85 to-background"
        />
        <div className="relative w-full px-0 md:px-2 lg:px-4 space-y-2">
          <AnimatePresence>
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
                transition={{ duration: 0.15 }}
                className="px-1 flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Loader2 size={11} className="animate-spin" />
                <span className="reasoning-shimmer font-medium">Thinking…</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-2">
            <ChatComposer
              canSend={Boolean(selectedThreadId) || availableAgentIds.length > 0}
              isBusy={isBusy}
              isGenerating={isGenerating}
              placeholder={
                selectedThreadId
                  ? `Message ${activeAgentLabel}…`
                  : `Message ${selectedAgentLabel}…`
              }
              onInterrupt={onInterrupt}
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
