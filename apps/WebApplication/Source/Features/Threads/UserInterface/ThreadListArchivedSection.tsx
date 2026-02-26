import { Archive, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import { Button } from "@/Components/UserInterface/Button";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import {
  THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER,
  THREAD_GROUP_NO_PROJECT_TOOLTIP
} from "@/Features/Threads/UserInterface/ThreadListUserInterfaceConstants";

interface ThreadListArchivedSectionProps {
  properties: ThreadListPaneProperties;
}

export function ThreadListArchivedSection({
  properties
}: ThreadListArchivedSectionProps): React.JSX.Element {
  return (
    <div className="space-y-1 pt-1">
      <Button
        type="button"
        data-testid="archived-threads-toggle"
        onClick={() => properties.onToggleArchivedThreads(!properties.isArchivedThreadsOpen)}
        variant="ghost"
        className="h-7 w-full justify-start gap-2 rounded-lg px-2 py-1 text-left text-[12px] tracking-tight font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        {properties.isArchivedThreadsOpen ? (
          <ChevronDown size={13} className="shrink-0" />
        ) : (
          <ChevronRight size={13} className="shrink-0" />
        )}
        <Archive size={13} className="shrink-0" />
        <span className="flex-1 truncate">Archived threads</span>
        {properties.isArchivedThreadsLoading ? (
          <Loader2 size={11} className="animate-spin text-muted-foreground/70" />
        ) : !properties.hasLoadedArchivedThreads && properties.archivedSectionThreadCount === 0 ? (
          <span className="text-[10px] text-muted-foreground/60">—</span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">
            {properties.hasLoadedArchivedThreads && properties.archivedThreadsTruncated
              ? `${String(properties.archivedSectionThreadCount)}+`
              : String(properties.archivedSectionThreadCount)}
          </span>
        )}
      </Button>
      {properties.isArchivedThreadsOpen && (
        <div data-testid="archived-thread-list" className="space-y-1 pl-4">
          {properties.isArchivedThreadsLoading && properties.archivedProjectGroups.length === 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground/70">
              <Loader2 size={11} className="animate-spin" />
              <span>Loading archived threads...</span>
            </div>
          )}
          {!properties.isArchivedThreadsLoading && properties.archivedProjectGroups.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-muted-foreground/70">
              No archived threads
            </div>
          )}
          {properties.archivedProjectGroups.map((group) => {
            const hasSelectedThread = group.threads.some((thread) => thread.id === properties.selectedThreadId);
            const isCollapsed = hasSelectedThread ? false : Boolean(properties.collapsedArchivedProjectGroups[group.key]);
            return (
              <div key={group.key} className="space-y-1">
                <Button
                  type="button"
                  data-testid="archived-project-group-toggle"
                  data-project-key={group.key}
                  onClick={() => properties.onToggleArchivedProjectGroup(group.key, !isCollapsed)}
                  variant="ghost"
                  className="h-7 w-full justify-start gap-2 rounded-lg px-2 py-1 text-left text-[12px] tracking-tight font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  {isCollapsed ? (
                    <ChevronRight size={13} className="shrink-0" />
                  ) : (
                    <ChevronDown size={13} className="shrink-0" />
                  )}
                  <span className="flex-1 truncate" title={group.projectPath ?? THREAD_GROUP_NO_PROJECT_TOOLTIP}>
                    {group.label}
                  </span>
                  {group.isRemoved && (
                    <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                      Removed
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">{String(group.threads.length)}</span>
                </Button>
                {!isCollapsed && (
                  <div className="space-y-1 pl-4">
                    {group.threads.map((thread) => {
                      const isArchivedThread = properties.archivedThreadIds.has(thread.id);
                      const canUnarchive = isArchivedThread
                        && thread.agentId === THREAD_ARCHIVE_MUTATION_SUPPORTED_AGENT_IDENTIFIER;
                      return (
                        <div
                          key={thread.id}
                          data-testid="archived-thread-list-item"
                          className="w-full min-w-0 rounded-xl border border-border/60 bg-muted/20 px-2 py-1.5 text-[12px] text-muted-foreground"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate">
                              {ThreadGroupSelectors.threadLabel(thread)}
                            </span>
                            {thread.updatedAt !== 0 && !Number.isNaN(thread.updatedAt) && (
                              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                                {properties.formatDate(thread.updatedAt)}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex justify-end">
                            {isArchivedThread ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 rounded-full px-2 text-[10px]"
                                disabled={properties.isBusy || !canUnarchive}
                                onClick={() => {
                                  if (canUnarchive) {
                                    properties.onUnarchiveThread(thread.id);
                                  }
                                }}
                                title={canUnarchive ? "Unarchive thread" : "Unarchive is not supported for this agent"}
                              >
                                Unarchive
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60">
                                Project removed
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {properties.archivedThreadsTruncated && (
            <div
              data-testid="archived-thread-list-truncated"
              className="px-2 py-1 text-[10px] text-muted-foreground/70"
            >
              Showing latest archived threads only.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
