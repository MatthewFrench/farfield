import { ChevronDown, ChevronRight, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/UserInterface/DropdownMenu";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import { ThreadListActiveThreadRow } from "@/Features/Threads/UserInterface/ThreadListActiveThreadRow";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import {
  DEFAULT_THREAD_PROJECT_DIRECTORY,
  THREAD_GROUP_NO_PROJECT_TOOLTIP,
} from "@/Features/Threads/UserInterface/ThreadListUserInterfaceConstants";
import { recordGlobalPerformanceInstantEvent } from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";

interface ThreadListActiveSectionProps {
  properties: ThreadListPaneProperties;
}

function readShouldShowUnreadIndicator(input: {
  hasUnread: boolean;
  threadRuntimeStatus:
    | ThreadListPaneProperties["threadRuntimeStatusByThreadIdentifier"][string]
    | undefined;
}): boolean {
  if (!input.hasUnread) {
    return false;
  }
  return input.threadRuntimeStatus?.statusType !== "active";
}

function readUnreadThreadCount(unreadThreadIds: Record<string, true>): number {
  return Object.keys(unreadThreadIds).length;
}

function readRuntimeStatusCount(
  threadRuntimeStatusByThreadIdentifier: ThreadListPaneProperties["threadRuntimeStatusByThreadIdentifier"],
): number {
  return Object.keys(threadRuntimeStatusByThreadIdentifier).length;
}

export function ThreadListActiveSection({
  properties,
}: ThreadListActiveSectionProps): React.JSX.Element {
  const [renamedThreadIdentifier, setRenamedThreadIdentifier] = useState<string | null>(null);
  const [threadNameDraft, setThreadNameDraft] = useState("");

  const beginThreadRename = useCallback((threadId: string, currentLabel: string): void => {
    setRenamedThreadIdentifier(threadId);
    setThreadNameDraft(currentLabel);
  }, []);

  const cancelThreadRename = useCallback((): void => {
    setRenamedThreadIdentifier(null);
    setThreadNameDraft("");
  }, []);

  const submitThreadRename = useCallback(
    (threadId: string): void => {
      properties.onSetThreadName(threadId, threadNameDraft);
      cancelThreadRename();
    },
    [cancelThreadRename, properties, threadNameDraft],
  );

  useEffect(() => {
    recordGlobalPerformanceInstantEvent("thread-list-active-section-committed", {
      activeThreadCount: properties.threads.length,
      unreadThreadCount: readUnreadThreadCount(properties.unreadThreadIds),
      runtimeStatusCount: readRuntimeStatusCount(properties.threadRuntimeStatusByThreadIdentifier),
      isGenerating: properties.isGenerating,
      selectedThreadId: properties.selectedThreadId,
    });
  }, [
    properties.isGenerating,
    properties.selectedThreadId,
    properties.threadRuntimeStatusByThreadIdentifier,
    properties.threads.length,
    properties.unreadThreadIds,
  ]);

  return (
    <div className="space-y-1">
      <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/60 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span>Threads</span>
          {properties.isCoreLoading && (
            <span
              data-testid="thread-list-refresh-indicator"
              className="flex items-center gap-1 text-[9px] normal-case tracking-normal text-muted-foreground/70"
            >
              <Loader2 size={10} className="animate-spin" />
              Refreshing
            </span>
          )}
        </span>
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
                      const threadRuntimeStatus =
                        properties.threadRuntimeStatusByThreadIdentifier[thread.id];
                      const shouldShowUnreadIndicator = readShouldShowUnreadIndicator({
                        hasUnread,
                        threadRuntimeStatus,
                      });
                      const shouldRenderThreadRuntimeStatusBadge =
                        threadRuntimeStatus !== undefined &&
                        threadRuntimeStatus.statusType !== "notLoaded";
                      const threadIsGenerating =
                        threadRuntimeStatus?.statusType === "active" ||
                        (isSelected && properties.isGenerating);
                      const isRenamingThread = renamedThreadIdentifier === thread.id;
                      return (
                        <ThreadListActiveThreadRow
                          key={thread.id}
                          thread={thread}
                          isSelected={isSelected}
                          shouldShowUnreadIndicator={shouldShowUnreadIndicator}
                          threadRuntimeStatus={threadRuntimeStatus}
                          shouldRenderThreadRuntimeStatusBadge={
                            shouldRenderThreadRuntimeStatusBadge
                          }
                          threadIsGenerating={threadIsGenerating}
                          isRenamingThread={isRenamingThread}
                          threadNameDraft={threadNameDraft}
                          isBusy={properties.isBusy}
                          formatDate={properties.formatDate}
                          onUpdateThreadNameDraft={setThreadNameDraft}
                          onSubmitThreadRename={submitThreadRename}
                          onCancelThreadRename={cancelThreadRename}
                          onBeginThreadRename={beginThreadRename}
                          onSelectThread={properties.onSelectThread}
                          onCopyThreadId={properties.onCopyThreadId}
                          onArchiveThread={properties.onArchiveThread}
                          onForkThread={properties.onForkThread}
                          onRollbackThread={properties.onRollbackThread}
                          onCompactThread={properties.onCompactThread}
                          onCleanThreadBackgroundTerminals={
                            properties.onCleanThreadBackgroundTerminals
                          }
                          onStartThreadReview={properties.onStartThreadReview}
                        />
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
