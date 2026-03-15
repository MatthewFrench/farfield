import {
  Archive,
  Check,
  Copy,
  Loader2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { memo } from "react";
import { Button } from "@/Components/UserInterface/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/UserInterface/DropdownMenu";
import { Input } from "@/Components/UserInterface/Input";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import { type ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { type ThreadRuntimeStatusSnapshot } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import {
  type ThreadListPaneDateFormatter,
  type ThreadListPaneThreadSelectionHandler,
} from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import { THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER } from "@/Features/Threads/UserInterface/ThreadListUserInterfaceConstants";
import {
  readThreadRuntimeStatusBadgeClasses,
  readThreadRuntimeStatusBadgeLabel,
  readThreadRuntimeStatusBadgeTitle,
} from "@/Features/Threads/UserInterface/ThreadRuntimeStatusBadgeMetadata";

const LOADED_IN_MEMORY_BADGE_LABEL = "Loaded";
const LOADED_IN_MEMORY_BADGE_TITLE = "Loaded in memory";

interface ThreadListActiveThreadRowProps {
  thread: ThreadListItem;
  isSelected: boolean;
  shouldShowUnreadIndicator: boolean;
  threadRuntimeStatus: ThreadRuntimeStatusSnapshot | undefined;
  shouldRenderThreadRuntimeStatusBadge: boolean;
  threadIsGenerating: boolean;
  isRenamingThread: boolean;
  threadNameDraft: string;
  isBusy: boolean;
  formatDate: ThreadListPaneDateFormatter;
  onUpdateThreadNameDraft: (nextDraft: string) => void;
  onSubmitThreadRename: ThreadListPaneThreadSelectionHandler;
  onCancelThreadRename: () => void;
  onBeginThreadRename: (threadId: string, currentLabel: string) => void;
  onSelectThread: ThreadListPaneThreadSelectionHandler;
  onCopyThreadId: ThreadListPaneThreadSelectionHandler;
  onArchiveThread: ThreadListPaneThreadSelectionHandler;
  onForkThread: ThreadListPaneThreadSelectionHandler;
  onRollbackThread: ThreadListPaneThreadSelectionHandler;
  onCompactThread: ThreadListPaneThreadSelectionHandler;
  onCleanThreadBackgroundTerminals: ThreadListPaneThreadSelectionHandler;
  onStartThreadReview: ThreadListPaneThreadSelectionHandler;
}

export const ThreadListActiveThreadRow = memo(function ThreadListActiveThreadRow({
  thread,
  isSelected,
  shouldShowUnreadIndicator,
  threadRuntimeStatus,
  shouldRenderThreadRuntimeStatusBadge,
  threadIsGenerating,
  isRenamingThread,
  threadNameDraft,
  isBusy,
  formatDate,
  onUpdateThreadNameDraft,
  onSubmitThreadRename,
  onCancelThreadRename,
  onBeginThreadRename,
  onSelectThread,
  onCopyThreadId,
  onArchiveThread,
  onForkThread,
  onRollbackThread,
  onCompactThread,
  onCleanThreadBackgroundTerminals,
  onStartThreadReview,
}: ThreadListActiveThreadRowProps): React.JSX.Element {
  const canArchive = thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
  const canRollback = thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
  const canCompact = thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
  const canCleanBackgroundTerminals =
    thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
  const canStartReview = thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;

  return (
    <div data-testid={`thread-list-row-${thread.id}`} className="flex items-stretch gap-1">
      {isRenamingThread ? (
        <div
          className={`min-w-0 flex-1 h-auto flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-left text-[13px] tracking-tight font-normal ${
            isSelected ? "bg-muted/90 text-foreground shadow-sm" : "bg-muted/60 text-foreground"
          }`}
        >
          <Input
            value={threadNameDraft}
            onChange={(event) => {
              onUpdateThreadNameDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitThreadRename(thread.id);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelThreadRename();
              }
            }}
            className="h-7 text-[12px]"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => {
              onSubmitThreadRename(thread.id);
            }}
            title="Save name"
          >
            <Check size={12} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => {
              onCancelThreadRename();
            }}
            title="Cancel rename"
          >
            <X size={12} />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          data-testid="thread-list-item"
          data-thread-id={thread.id}
          onClick={() => onSelectThread(thread.id)}
          variant="ghost"
          className={`relative min-w-0 flex-1 h-auto flex items-start gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] tracking-tight font-normal whitespace-normal transition-colors ${
            isSelected
              ? "bg-muted/90 text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          }`}
        >
          {shouldShowUnreadIndicator && (
            <span
              data-testid={`thread-unread-indicator-${thread.id}`}
              aria-label="Unread message"
              title="Unread message"
              className="absolute left-1 top-[11px] h-2 w-2 rounded-full bg-sky-500"
            />
          )}
          <span className={`min-w-0 flex-1 leading-4 ${shouldShowUnreadIndicator ? "pl-3.5" : ""}`}>
            <span className="line-clamp-2 break-words">
              {ThreadGroupSelectors.threadLabel(thread)}
            </span>
          </span>
          <span className="shrink-0 flex items-center gap-1.5 pt-0.5">
            {shouldRenderThreadRuntimeStatusBadge && threadRuntimeStatus !== undefined && (
              <span
                data-testid={`thread-runtime-status-badge-${thread.id}`}
                title={readThreadRuntimeStatusBadgeTitle(threadRuntimeStatus)}
                className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${readThreadRuntimeStatusBadgeClasses(
                  threadRuntimeStatus,
                )}`}
              >
                {readThreadRuntimeStatusBadgeLabel(threadRuntimeStatus)}
              </span>
            )}
            {thread.isLoadedInMemory === true && (
              <span
                data-testid={`thread-loaded-indicator-${thread.id}`}
                aria-label={LOADED_IN_MEMORY_BADGE_TITLE}
                title={LOADED_IN_MEMORY_BADGE_TITLE}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-emerald-700"
              >
                {LOADED_IN_MEMORY_BADGE_LABEL}
              </span>
            )}
            {threadIsGenerating && (
              <Loader2
                data-testid={`thread-generating-indicator-${thread.id}`}
                size={11}
                className="animate-spin text-muted-foreground/70"
              />
            )}
          </span>
        </Button>
      )}
      <div
        data-testid={`thread-row-meta-${thread.id}`}
        className="flex min-h-[34px] w-11 shrink-0 flex-col items-end justify-start gap-1 py-1"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              data-testid="thread-row-menu-trigger"
              data-thread-id={thread.id}
              variant="ghost"
              size="icon"
              className={`h-6 w-6 rounded-md ${
                isSelected
                  ? "bg-muted/90 text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
              disabled={isBusy || isRenamingThread}
            >
              <MoreHorizontal size={13} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6}>
            <DropdownMenuItem
              onSelect={() => {
                onBeginThreadRename(
                  thread.id,
                  (thread.displayName ?? ThreadGroupSelectors.threadLabel(thread)).trim(),
                );
              }}
              disabled={isBusy}
            >
              <Pencil size={13} />
              Rename thread
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onCopyThreadId(thread.id);
              }}
              disabled={isBusy}
            >
              <Copy size={13} />
              Copy thread ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (canStartReview) {
                  onStartThreadReview(thread.id);
                }
              }}
              disabled={isBusy || !canStartReview}
            >
              <Search size={13} />
              Start code review
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (canCompact) {
                  onCompactThread(thread.id);
                }
              }}
              disabled={isBusy || !canCompact}
            >
              <Minimize2 size={13} />
              Compact context
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (canCleanBackgroundTerminals) {
                  onCleanThreadBackgroundTerminals(thread.id);
                }
              }}
              disabled={isBusy || !canCleanBackgroundTerminals}
            >
              <Trash2 size={13} />
              Clean background terminals
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onForkThread(thread.id);
              }}
              disabled={isBusy}
            >
              <Copy size={13} />
              Fork thread
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (canRollback) {
                  onRollbackThread(thread.id);
                }
              }}
              disabled={isBusy || !canRollback}
            >
              <Undo2 size={13} />
              Undo last turn
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (canArchive) {
                  onArchiveThread(thread.id);
                }
              }}
              disabled={isBusy || !canArchive}
            >
              <Archive size={13} />
              Archive thread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {thread.updatedAt !== 0 && !Number.isNaN(thread.updatedAt) ? (
          <span
            data-testid={`thread-row-time-${thread.id}`}
            className="whitespace-nowrap text-right text-[9px] leading-none text-muted-foreground/50 sm:text-[10px]"
          >
            {formatDate(thread.updatedAt)}
          </span>
        ) : (
          <span className="h-2.5" aria-hidden="true" />
        )}
      </div>
    </div>
  );
});

ThreadListActiveThreadRow.displayName = "ThreadListActiveThreadRow";
