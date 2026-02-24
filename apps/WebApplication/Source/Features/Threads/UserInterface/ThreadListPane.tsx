import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { Input } from "@/Components/UserInterface/Input";
import { ThreadListSearchFilter } from "@/Features/Threads/DomainModel/ThreadListSearchFilter";
import { ThreadListActiveSection } from "@/Features/Threads/UserInterface/ThreadListActiveSection";
import { ThreadListArchivedSection } from "@/Features/Threads/UserInterface/ThreadListArchivedSection";
import { ThreadListEmptyState } from "@/Features/Threads/UserInterface/ThreadListEmptyState";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";

export type {
  ThreadListPaneAgentDescriptor,
  ThreadListPaneProperties
} from "@/Features/Threads/UserInterface/ThreadListPaneContracts";

export function ThreadListPane(properties: ThreadListPaneProperties): React.JSX.Element {
  const [threadSearchQuery, setThreadSearchQuery] = useState("");

  const normalizedSearchQuery = useMemo(
    () => ThreadListSearchFilter.normalizeQuery(threadSearchQuery),
    [threadSearchQuery]
  );

  const readAgentLabel = (agentId: ThreadListPaneProperties["availableAgentIds"][number]): string => {
    return properties.agentsById[agentId]?.label ?? agentId;
  };

  const filteredActiveProjectGroups = useMemo(
    () =>
      ThreadListSearchFilter.filterProjectGroups({
        projectGroups: properties.activeProjectGroups,
        query: normalizedSearchQuery,
        readAgentLabel: (thread) => readAgentLabel(thread.agentId)
      }),
    [normalizedSearchQuery, properties.activeProjectGroups, properties.agentsById]
  );

  const filteredArchivedProjectGroups = useMemo(
    () =>
      ThreadListSearchFilter.filterProjectGroups({
        projectGroups: properties.archivedProjectGroups,
        query: normalizedSearchQuery,
        readAgentLabel: (thread) => readAgentLabel(thread.agentId)
      }),
    [normalizedSearchQuery, properties.archivedProjectGroups, properties.agentsById]
  );

  const filteredActiveThreads = useMemo<ThreadListPaneProperties["threads"]>(() => {
    const mappedThreads: ThreadListPaneProperties["threads"] = [];
    for (const projectGroup of filteredActiveProjectGroups) {
      mappedThreads.push(...projectGroup.threads);
    }
    return mappedThreads;
  }, [filteredActiveProjectGroups]);

  const filteredArchivedThreadCount = useMemo(
    () => ThreadListSearchFilter.countThreads(filteredArchivedProjectGroups),
    [filteredArchivedProjectGroups]
  );

  const hasSearchQuery = normalizedSearchQuery.length > 0;
  const filteredMatchCount = filteredActiveThreads.length + filteredArchivedThreadCount;
  const hasFilteredMatches = filteredMatchCount > 0;

  const sectionProperties = hasSearchQuery
    ? {
      ...properties,
      threads: filteredActiveThreads,
      activeProjectGroups: filteredActiveProjectGroups,
      archivedProjectGroups: filteredArchivedProjectGroups,
      archivedSectionThreadCount: filteredArchivedThreadCount
    }
    : properties;

  return (
    <div className="relative flex-1 min-h-0">
      <div
        data-testid="thread-list-status"
        data-state={properties.threadListState}
        className="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain py-2 pl-2 pr-0"
      >
        <ThreadListEmptyState properties={properties} />
        <div className="space-y-1 px-2 pb-2">
          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              type="search"
              data-testid="thread-list-search-input"
              aria-label="Search threads"
              placeholder="Search threads or projects"
              value={threadSearchQuery}
              onChange={(event) => {
                setThreadSearchQuery(event.currentTarget.value);
              }}
              className="h-8 rounded-lg border-border/70 bg-muted/20 pl-7 pr-7 text-[12px] md:text-[12px]"
            />
            {threadSearchQuery.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setThreadSearchQuery("");
                }}
                data-testid="thread-list-search-clear"
                aria-label="Clear thread search"
                title="Clear thread search"
              >
                <X size={12} aria-hidden="true" />
              </Button>
            )}
          </div>
          {hasSearchQuery && (
            <div
              data-testid="thread-list-search-summary"
              className={`px-0.5 text-[10px] ${
                hasFilteredMatches ? "text-muted-foreground/80" : "text-muted-foreground/65"
              }`}
            >
              {hasFilteredMatches
                ? `${String(filteredMatchCount)} matching threads`
                : "No matching threads"}
            </div>
          )}
        </div>
        <div className="space-y-2 pr-2">
          <ThreadListActiveSection properties={sectionProperties} />
          <ThreadListArchivedSection properties={sectionProperties} />
        </div>
      </div>
    </div>
  );
}
