import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/UserInterface/DropdownMenu";
import { Input } from "@/Components/UserInterface/Input";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import {
  DEFAULT_THREAD_PROJECT_DIRECTORY,
  THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER,
  THREAD_GROUP_NO_PROJECT_TOOLTIP,
} from "@/Features/Threads/UserInterface/ThreadListUserInterfaceConstants";

interface ThreadListActiveSectionProps {
  properties: ThreadListPaneProperties;
}

export function ThreadListActiveSection({
  properties,
}: ThreadListActiveSectionProps): React.JSX.Element {
  const [renamedThreadIdentifier, setRenamedThreadIdentifier] = useState<string | null>(null);
  const [threadNameDraft, setThreadNameDraft] = useState("");

  function beginThreadRename(threadId: string, currentLabel: string): void {
    setRenamedThreadIdentifier(threadId);
    setThreadNameDraft(currentLabel);
  }

  function cancelThreadRename(): void {
    setRenamedThreadIdentifier(null);
    setThreadNameDraft("");
  }

  function submitThreadRename(threadId: string): void {
    properties.onSetThreadName(threadId, threadNameDraft);
    cancelThreadRename();
  }

  return (
    <div className="space-y-1">
      <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/60 flex items-center justify-between">
        <span>Threads</span>
        <span>{String(properties.threads.length)}</span>
      </div>
      {properties.activeProjectGroups.length > 0 && (
        <div className="space-y-2">
          {properties.activeProjectGroups.map((group) => {
            const hasSelectedThread = group.threads.some(
              (thread) => thread.id === properties.selectedThreadId,
            );
            const isCollapsed = hasSelectedThread
              ? false
              : Boolean(properties.collapsedThreadProjectGroups[group.key]);
            const groupProjectPath =
              group.projectPath ??
              properties.selectedAgentDescriptor?.projectDirectories[0] ??
              DEFAULT_THREAD_PROJECT_DIRECTORY;
            const groupPreferredAgentId =
              group.threads.find((thread) => properties.availableAgentIds.includes(thread.agentId))
                ?.agentId ??
              properties.availableAgentIds[0] ??
              null;
            return (
              <div key={group.key} className="space-y-1">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    data-testid="thread-project-group-toggle"
                    data-project-key={group.key}
                    onClick={() => properties.onToggleThreadProjectGroup(group.key, !isCollapsed)}
                    variant="ghost"
                    className="h-7 flex-1 justify-start gap-2 rounded-lg px-2 py-1 text-left text-[12px] tracking-tight font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={13} className="shrink-0" />
                    ) : (
                      <ChevronDown size={13} className="shrink-0" />
                    )}
                    <span
                      className="flex-1 truncate"
                      title={group.projectPath ?? THREAD_GROUP_NO_PROJECT_TOOLTIP}
                    >
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {String(group.threads.length)}
                    </span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        data-testid="thread-project-group-menu-trigger"
                        data-project-key={group.key}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        disabled={properties.isBusy || groupPreferredAgentId === null}
                      >
                        <MoreHorizontal size={13} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6}>
                      <DropdownMenuItem
                        onSelect={() => {
                          if (groupPreferredAgentId !== null) {
                            properties.onCreateNewThread(groupProjectPath, groupPreferredAgentId);
                          }
                        }}
                        disabled={properties.isBusy || groupPreferredAgentId === null}
                      >
                        <Plus size={13} />
                        New thread
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {!isCollapsed && (
                  <div className="space-y-1 pl-4">
                    {group.threads.map((thread) => {
                      const isSelected = thread.id === properties.selectedThreadId;
                      const hasUnread =
                        properties.unreadThreadIds[thread.id] === true && !isSelected;
                      const threadIsGenerating = isSelected && properties.isGenerating;
                      const canArchive =
                        thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
                      const canRollback =
                        thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
                      const canCompact =
                        thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
                      const canCleanBackgroundTerminals =
                        thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
                      const canStartReview =
                        thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
                      const isRenamingThread = renamedThreadIdentifier === thread.id;
                      return (
                        <div
                          key={thread.id}
                          className="flex items-stretch gap-1 [content-visibility:auto] [contain-intrinsic-size:40px]"
                        >
                          {isRenamingThread ? (
                            <div
                              className={`min-w-0 flex-1 h-auto flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-left text-[13px] tracking-tight font-normal ${
                                isSelected
                                  ? "bg-muted/90 text-foreground shadow-sm"
                                  : "bg-muted/60 text-foreground"
                              }`}
                            >
                              <Input
                                value={threadNameDraft}
                                onChange={(event) => {
                                  setThreadNameDraft(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    submitThreadRename(thread.id);
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelThreadRename();
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
                                  submitThreadRename(thread.id);
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
                                  cancelThreadRename();
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
                              onClick={() => properties.onSelectThread(thread.id)}
                              variant="ghost"
                              className={`min-w-0 flex-1 h-auto flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] tracking-tight font-normal transition-colors ${
                                isSelected
                                  ? "bg-muted/90 text-foreground shadow-sm"
                                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate leading-5">
                                {ThreadGroupSelectors.threadLabel(thread)}
                              </span>
                              <span className="shrink-0 flex items-center gap-1.5">
                                {hasUnread && (
                                  <span
                                    data-testid={`thread-unread-indicator-${thread.id}`}
                                    aria-label="Unread message"
                                    title="Unread message"
                                    className="h-2 w-2 rounded-full bg-sky-500"
                                  />
                                )}
                                {threadIsGenerating && (
                                  <Loader2
                                    size={11}
                                    className="animate-spin text-muted-foreground/70"
                                  />
                                )}
                                {thread.updatedAt !== 0 && !Number.isNaN(thread.updatedAt) && (
                                  <span className="text-[10px] text-muted-foreground/50">
                                    {properties.formatDate(thread.updatedAt)}
                                  </span>
                                )}
                              </span>
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                data-testid="thread-row-menu-trigger"
                                data-thread-id={thread.id}
                                variant="ghost"
                                size="icon"
                                className={`h-auto min-h-[34px] w-7 shrink-0 rounded-lg ${
                                  isSelected
                                    ? "bg-muted/90 text-foreground hover:bg-muted"
                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                }`}
                                disabled={properties.isBusy || isRenamingThread}
                              >
                                <MoreHorizontal size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={6}>
                              <DropdownMenuItem
                                onSelect={() => {
                                  beginThreadRename(
                                    thread.id,
                                    ThreadGroupSelectors.threadLabel(thread),
                                  );
                                }}
                                disabled={properties.isBusy}
                              >
                                <Pencil size={13} />
                                Rename thread
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (canStartReview) {
                                    properties.onStartThreadReview(thread.id);
                                  }
                                }}
                                disabled={properties.isBusy || !canStartReview}
                              >
                                <Search size={13} />
                                Start code review
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (canCompact) {
                                    properties.onCompactThread(thread.id);
                                  }
                                }}
                                disabled={properties.isBusy || !canCompact}
                              >
                                <Minimize2 size={13} />
                                Compact context
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (canCleanBackgroundTerminals) {
                                    properties.onCleanThreadBackgroundTerminals(thread.id);
                                  }
                                }}
                                disabled={properties.isBusy || !canCleanBackgroundTerminals}
                              >
                                <Trash2 size={13} />
                                Clean background terminals
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  properties.onForkThread(thread.id);
                                }}
                                disabled={properties.isBusy}
                              >
                                <Copy size={13} />
                                Fork thread
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (canRollback) {
                                    properties.onRollbackThread(thread.id);
                                  }
                                }}
                                disabled={properties.isBusy || !canRollback}
                              >
                                <Undo2 size={13} />
                                Undo last turn
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (canArchive) {
                                    properties.onArchiveThread(thread.id);
                                  }
                                }}
                                disabled={properties.isBusy || !canArchive}
                              >
                                <Archive size={13} />
                                Archive thread
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
