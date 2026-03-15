import { Search, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { Input } from "@/Components/UserInterface/Input";
import { ThreadListSearchFilter } from "@/Features/Threads/DomainModel/ThreadListSearchFilter";
import { ThreadListActiveSection } from "@/Features/Threads/UserInterface/ThreadListActiveSection";
import { ThreadListArchivedSection } from "@/Features/Threads/UserInterface/ThreadListArchivedSection";
import { ThreadListEmptyState } from "@/Features/Threads/UserInterface/ThreadListEmptyState";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import { recordGlobalPerformanceInstantEvent } from "@/Shared/Performance/ClientPerformanceFreezeProbeOwner";

export type {
  ThreadListPaneAgentDescriptor,
  ThreadListPaneProperties,
} from "@/Features/Threads/UserInterface/ThreadListPaneContracts";

const THREAD_SEARCH_CLEAR_BUTTON_LABEL = "Clear thread search";
const THREAD_SEARCH_SUMMARY_EMPTY_MESSAGE = "No matching threads";
const THREAD_SEARCH_SUMMARY_SINGLE_MATCH_SUFFIX = "matching thread";
const THREAD_SEARCH_SUMMARY_MULTIPLE_MATCH_SUFFIX = "matching threads";
const THREAD_LIST_PANE_STABLE_RERENDER_SAMPLE_INTERVAL = 50;
const THREAD_LIST_PANE_PROP_CHANGE_SAMPLE_INTERVAL = 10;
let threadListPanePropChangeSampleCounter = 0;

interface ThreadListPaneRenderSnapshot {
  threadCount: number;
  activeProjectGroupCount: number;
  archivedProjectGroupCount: number;
  unreadThreadCount: number;
  runtimeStatusCount: number;
  selectedThreadId: string | null;
  isGenerating: boolean;
  isBusy: boolean;
  isCoreLoading: boolean;
  hasSearchQuery: boolean;
  archivedThreadsOpen: boolean;
}

function readUnreadThreadCount(
  unreadThreadIds: ThreadListPaneProperties["unreadThreadIds"],
): number {
  return Object.keys(unreadThreadIds).length;
}

function readRuntimeStatusCount(
  threadRuntimeStatusByThreadIdentifier: ThreadListPaneProperties["threadRuntimeStatusByThreadIdentifier"],
): number {
  return Object.keys(threadRuntimeStatusByThreadIdentifier).length;
}

function buildThreadListPaneRenderSnapshot(input: {
  properties: ThreadListPaneProperties;
  hasSearchQuery: boolean;
}): ThreadListPaneRenderSnapshot {
  return {
    threadCount: input.properties.threads.length,
    activeProjectGroupCount: input.properties.activeProjectGroups.length,
    archivedProjectGroupCount: input.properties.archivedProjectGroups.length,
    unreadThreadCount: readUnreadThreadCount(input.properties.unreadThreadIds),
    runtimeStatusCount: readRuntimeStatusCount(
      input.properties.threadRuntimeStatusByThreadIdentifier,
    ),
    selectedThreadId: input.properties.selectedThreadId,
    isGenerating: input.properties.isGenerating,
    isBusy: input.properties.isBusy,
    isCoreLoading: input.properties.isCoreLoading,
    hasSearchQuery: input.hasSearchQuery,
    archivedThreadsOpen: input.properties.isArchivedThreadsOpen,
  };
}

function readThreadListPaneChangedFields(
  previousSnapshot: ThreadListPaneRenderSnapshot | null,
  nextSnapshot: ThreadListPaneRenderSnapshot,
): string[] {
  if (previousSnapshot === null) {
    return ["initial-render"];
  }

  const changedFields: string[] = [];
  if (previousSnapshot.threadCount !== nextSnapshot.threadCount) {
    changedFields.push("threadCount");
  }
  if (previousSnapshot.activeProjectGroupCount !== nextSnapshot.activeProjectGroupCount) {
    changedFields.push("activeProjectGroupCount");
  }
  if (previousSnapshot.archivedProjectGroupCount !== nextSnapshot.archivedProjectGroupCount) {
    changedFields.push("archivedProjectGroupCount");
  }
  if (previousSnapshot.unreadThreadCount !== nextSnapshot.unreadThreadCount) {
    changedFields.push("unreadThreadCount");
  }
  if (previousSnapshot.runtimeStatusCount !== nextSnapshot.runtimeStatusCount) {
    changedFields.push("runtimeStatusCount");
  }
  if (previousSnapshot.selectedThreadId !== nextSnapshot.selectedThreadId) {
    changedFields.push("selectedThreadId");
  }
  if (previousSnapshot.isGenerating !== nextSnapshot.isGenerating) {
    changedFields.push("isGenerating");
  }
  if (previousSnapshot.isBusy !== nextSnapshot.isBusy) {
    changedFields.push("isBusy");
  }
  if (previousSnapshot.isCoreLoading !== nextSnapshot.isCoreLoading) {
    changedFields.push("isCoreLoading");
  }
  if (previousSnapshot.hasSearchQuery !== nextSnapshot.hasSearchQuery) {
    changedFields.push("hasSearchQuery");
  }
  if (previousSnapshot.archivedThreadsOpen !== nextSnapshot.archivedThreadsOpen) {
    changedFields.push("archivedThreadsOpen");
  }

  if (changedFields.length === 0) {
    changedFields.push("stable-props-parent-rerender");
  }

  return changedFields;
}

function areThreadListPanePropertiesEqual(
  previousProperties: ThreadListPaneProperties,
  nextProperties: ThreadListPaneProperties,
): boolean {
  const changedFields: string[] = [];
  if (previousProperties.threadListState !== nextProperties.threadListState) {
    changedFields.push("threadListState");
  }
  if (previousProperties.threads !== nextProperties.threads) {
    changedFields.push("threads");
  }
  if (previousProperties.isCoreLoading !== nextProperties.isCoreLoading) {
    changedFields.push("isCoreLoading");
  }
  if (previousProperties.availableAgentIds !== nextProperties.availableAgentIds) {
    changedFields.push("availableAgentIds");
  }
  if (previousProperties.selectedAgentDescriptor !== nextProperties.selectedAgentDescriptor) {
    changedFields.push("selectedAgentDescriptor");
  }
  if (previousProperties.selectedAgentLabel !== nextProperties.selectedAgentLabel) {
    changedFields.push("selectedAgentLabel");
  }
  if (previousProperties.agentsById !== nextProperties.agentsById) {
    changedFields.push("agentsById");
  }
  if (previousProperties.isBusy !== nextProperties.isBusy) {
    changedFields.push("isBusy");
  }
  if (previousProperties.activeProjectGroups !== nextProperties.activeProjectGroups) {
    changedFields.push("activeProjectGroups");
  }
  if (previousProperties.selectedThreadId !== nextProperties.selectedThreadId) {
    changedFields.push("selectedThreadId");
  }
  if (
    previousProperties.collapsedThreadProjectGroups !== nextProperties.collapsedThreadProjectGroups
  ) {
    changedFields.push("collapsedThreadProjectGroups");
  }
  if (previousProperties.unreadThreadIds !== nextProperties.unreadThreadIds) {
    changedFields.push("unreadThreadIds");
  }
  if (
    previousProperties.threadRuntimeStatusByThreadIdentifier !==
    nextProperties.threadRuntimeStatusByThreadIdentifier
  ) {
    changedFields.push("threadRuntimeStatusByThreadIdentifier");
  }
  if (previousProperties.isGenerating !== nextProperties.isGenerating) {
    changedFields.push("isGenerating");
  }
  if (previousProperties.onToggleThreadProjectGroup !== nextProperties.onToggleThreadProjectGroup) {
    changedFields.push("onToggleThreadProjectGroup");
  }
  if (
    previousProperties.onCreateThreadForSingleAgent !== nextProperties.onCreateThreadForSingleAgent
  ) {
    changedFields.push("onCreateThreadForSingleAgent");
  }
  if (previousProperties.onCreateNewThread !== nextProperties.onCreateNewThread) {
    changedFields.push("onCreateNewThread");
  }
  if (previousProperties.onSelectThread !== nextProperties.onSelectThread) {
    changedFields.push("onSelectThread");
  }
  if (previousProperties.onArchiveThread !== nextProperties.onArchiveThread) {
    changedFields.push("onArchiveThread");
  }
  if (previousProperties.onForkThread !== nextProperties.onForkThread) {
    changedFields.push("onForkThread");
  }
  if (previousProperties.onRollbackThread !== nextProperties.onRollbackThread) {
    changedFields.push("onRollbackThread");
  }
  if (previousProperties.onCompactThread !== nextProperties.onCompactThread) {
    changedFields.push("onCompactThread");
  }
  if (
    previousProperties.onCleanThreadBackgroundTerminals !==
    nextProperties.onCleanThreadBackgroundTerminals
  ) {
    changedFields.push("onCleanThreadBackgroundTerminals");
  }
  if (previousProperties.onStartThreadReview !== nextProperties.onStartThreadReview) {
    changedFields.push("onStartThreadReview");
  }
  if (previousProperties.onSetThreadName !== nextProperties.onSetThreadName) {
    changedFields.push("onSetThreadName");
  }
  if (previousProperties.isArchivedThreadsOpen !== nextProperties.isArchivedThreadsOpen) {
    changedFields.push("isArchivedThreadsOpen");
  }
  if (previousProperties.onToggleArchivedThreads !== nextProperties.onToggleArchivedThreads) {
    changedFields.push("onToggleArchivedThreads");
  }
  if (previousProperties.isArchivedThreadsLoading !== nextProperties.isArchivedThreadsLoading) {
    changedFields.push("isArchivedThreadsLoading");
  }
  if (previousProperties.hasLoadedArchivedThreads !== nextProperties.hasLoadedArchivedThreads) {
    changedFields.push("hasLoadedArchivedThreads");
  }
  if (previousProperties.archivedSectionThreadCount !== nextProperties.archivedSectionThreadCount) {
    changedFields.push("archivedSectionThreadCount");
  }
  if (previousProperties.archivedThreadsTruncated !== nextProperties.archivedThreadsTruncated) {
    changedFields.push("archivedThreadsTruncated");
  }
  if (previousProperties.archivedProjectGroups !== nextProperties.archivedProjectGroups) {
    changedFields.push("archivedProjectGroups");
  }
  if (
    previousProperties.collapsedArchivedProjectGroups !==
    nextProperties.collapsedArchivedProjectGroups
  ) {
    changedFields.push("collapsedArchivedProjectGroups");
  }
  if (previousProperties.archivedThreadIds !== nextProperties.archivedThreadIds) {
    changedFields.push("archivedThreadIds");
  }
  if (
    previousProperties.onToggleArchivedProjectGroup !== nextProperties.onToggleArchivedProjectGroup
  ) {
    changedFields.push("onToggleArchivedProjectGroup");
  }
  if (previousProperties.onUnarchiveThread !== nextProperties.onUnarchiveThread) {
    changedFields.push("onUnarchiveThread");
  }
  if (previousProperties.formatDate !== nextProperties.formatDate) {
    changedFields.push("formatDate");
  }
  if (previousProperties.renderAgentFavicon !== nextProperties.renderAgentFavicon) {
    changedFields.push("renderAgentFavicon");
  }

  if (changedFields.length === 0) {
    return true;
  }

  threadListPanePropChangeSampleCounter += 1;
  if (threadListPanePropChangeSampleCounter % THREAD_LIST_PANE_PROP_CHANGE_SAMPLE_INTERVAL === 0) {
    recordGlobalPerformanceInstantEvent("thread-list-pane-props-changed", {
      changedFields,
    });
  }

  return false;
}

function ThreadListPaneComponent(properties: ThreadListPaneProperties): React.JSX.Element {
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const previousRenderSnapshotReference = useRef<ThreadListPaneRenderSnapshot | null>(null);
  const suppressedStableParentRerenderCountReference = useRef(0);

  const normalizedSearchQuery = useMemo(
    () => ThreadListSearchFilter.normalizeQuery(threadSearchQuery),
    [threadSearchQuery],
  );

  const filteredActiveProjectGroups = useMemo(
    () =>
      ThreadListSearchFilter.filterProjectGroups({
        projectGroups: properties.activeProjectGroups,
        query: normalizedSearchQuery,
        readAgentLabel: (thread) => properties.agentsById[thread.agentId]?.label ?? thread.agentId,
      }),
    [normalizedSearchQuery, properties.activeProjectGroups, properties.agentsById],
  );

  const filteredArchivedProjectGroups = useMemo(
    () =>
      ThreadListSearchFilter.filterProjectGroups({
        projectGroups: properties.archivedProjectGroups,
        query: normalizedSearchQuery,
        readAgentLabel: (thread) => properties.agentsById[thread.agentId]?.label ?? thread.agentId,
      }),
    [normalizedSearchQuery, properties.archivedProjectGroups, properties.agentsById],
  );

  const filteredActiveThreads = useMemo<ThreadListPaneProperties["threads"]>(() => {
    return flattenProjectGroupThreads(filteredActiveProjectGroups);
  }, [filteredActiveProjectGroups]);

  const filteredArchivedThreadCount = useMemo(
    () => ThreadListSearchFilter.countThreads(filteredArchivedProjectGroups),
    [filteredArchivedProjectGroups],
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
        archivedSectionThreadCount: filteredArchivedThreadCount,
      }
    : properties;

  useEffect(() => {
    const nextSnapshot = buildThreadListPaneRenderSnapshot({
      properties: sectionProperties,
      hasSearchQuery,
    });
    const changedFields = readThreadListPaneChangedFields(
      previousRenderSnapshotReference.current,
      nextSnapshot,
    );
    previousRenderSnapshotReference.current = nextSnapshot;
    const isStableParentRerender =
      changedFields.length === 1 && changedFields[0] === "stable-props-parent-rerender";
    if (isStableParentRerender) {
      suppressedStableParentRerenderCountReference.current += 1;
      if (
        suppressedStableParentRerenderCountReference.current %
          THREAD_LIST_PANE_STABLE_RERENDER_SAMPLE_INTERVAL !==
        0
      ) {
        return;
      }
    }
    const suppressedStableParentRerenderCount =
      suppressedStableParentRerenderCountReference.current;
    suppressedStableParentRerenderCountReference.current = 0;
    recordGlobalPerformanceInstantEvent("thread-list-pane-committed", {
      activeThreadCount: sectionProperties.threads.length,
      activeProjectGroupCount: sectionProperties.activeProjectGroups.length,
      archivedProjectGroupCount: sectionProperties.archivedProjectGroups.length,
      hasSearchQuery,
      archivedThreadsOpen: sectionProperties.isArchivedThreadsOpen,
      unreadThreadCount: nextSnapshot.unreadThreadCount,
      runtimeStatusCount: nextSnapshot.runtimeStatusCount,
      changedFields,
      suppressedStableParentRerenderCount,
    });
  }, [hasSearchQuery, sectionProperties]);

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
                aria-label={THREAD_SEARCH_CLEAR_BUTTON_LABEL}
                title={THREAD_SEARCH_CLEAR_BUTTON_LABEL}
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
              {buildSearchSummary(filteredMatchCount)}
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

export const ThreadListPane = memo(ThreadListPaneComponent, areThreadListPanePropertiesEqual);
ThreadListPane.displayName = "ThreadListPane";

function flattenProjectGroupThreads(
  projectGroups: ThreadListPaneProperties["activeProjectGroups"],
): ThreadListPaneProperties["threads"] {
  const mappedThreads: ThreadListPaneProperties["threads"] = [];
  for (const projectGroup of projectGroups) {
    mappedThreads.push(...projectGroup.threads);
  }
  return mappedThreads;
}

function buildSearchSummary(matchCount: number): string {
  if (matchCount === 0) {
    return THREAD_SEARCH_SUMMARY_EMPTY_MESSAGE;
  }
  if (matchCount === 1) {
    return `1 ${THREAD_SEARCH_SUMMARY_SINGLE_MATCH_SUFFIX}`;
  }
  return `${String(matchCount)} ${THREAD_SEARCH_SUMMARY_MULTIPLE_MATCH_SUFFIX}`;
}
