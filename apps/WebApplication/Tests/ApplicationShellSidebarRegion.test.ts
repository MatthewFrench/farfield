import { describe, expect, it } from "vitest";
import { areApplicationShellSidebarRegionMemoSnapshotsEqual } from "@/Application/UserInterface/ApplicationShellSidebarRegion";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPane";

function createThreadListPanePropertiesIdentity(identifier: string): ThreadListPaneProperties {
  return {
    threadListState: "ready",
    threads: [],
    isCoreLoading: false,
    availableAgentIds: ["codex"],
    selectedAgentDescriptor: {
      label: "Codex",
      projectDirectories: [],
    },
    selectedAgentLabel: "Codex",
    agentsById: {
      codex: {
        label: "Codex",
        projectDirectories: [],
      },
    },
    isBusy: false,
    activeProjectGroups: [],
    selectedThreadId: identifier,
    collapsedThreadProjectGroups: {},
    unreadThreadIds: {},
    threadRuntimeStatusByThreadIdentifier: {},
    isGenerating: false,
    onToggleThreadProjectGroup: () => {},
    onCreateThreadForSingleAgent: () => {},
    onCreateNewThread: () => {},
    onSelectThread: () => {},
    onArchiveThread: () => {},
    onForkThread: () => {},
    onRollbackThread: () => {},
    onCompactThread: () => {},
    onCleanThreadBackgroundTerminals: () => {},
    onStartThreadReview: () => {},
    onSetThreadName: () => {},
    isArchivedThreadsOpen: false,
    onToggleArchivedThreads: () => {},
    isArchivedThreadsLoading: false,
    hasLoadedArchivedThreads: true,
    archivedSectionThreadCount: 0,
    archivedThreadsTruncated: false,
    archivedProjectGroups: [],
    collapsedArchivedProjectGroups: {},
    archivedThreadIds: new Set<string>(),
    onToggleArchivedProjectGroup: () => {},
    onUnarchiveThread: () => {},
    formatDate: () => "",
    renderAgentFavicon: () => null,
  };
}

function createMemoSnapshot(input?: {
  isMobileLayout?: boolean;
  mobileSidebarOpen?: boolean;
  desktopSidebarOpen?: boolean;
  threadListPaneProperties?: ThreadListPaneProperties;
  threadSidebarRuntimeSummary?: ThreadSidebarRuntimeSummary;
}): ApplicationShellSidebarRegionMemoSnapshot {
  return {
    isMobileLayout: input?.isMobileLayout ?? true,
    mobileSidebarOpen: input?.mobileSidebarOpen ?? false,
    desktopSidebarOpen: input?.desktopSidebarOpen ?? true,
    threadListPaneProperties:
      input?.threadListPaneProperties ?? createThreadListPanePropertiesIdentity("thread-1"),
    allSystemsReady: true,
    hasAnySystemFailure: false,
    commitLabel: "commit",
    agentDescriptors: [],
    codexConfigured: true,
    threadSidebarHealthState: null,
    threadSidebarRuntimeSummary: input?.threadSidebarRuntimeSummary ?? {
      account: null,
      rateLimits: null,
      apps: null,
      progress: null,
      warning: null,
      tokenUsage: null,
      modelReroute: null,
    },
  };
}

describe("ApplicationShellSidebarRegion", () => {
  it("ignores hidden mobile sidebar data churn until the sidebar is opened", () => {
    const previousSnapshot = createMemoSnapshot({
      isMobileLayout: true,
      mobileSidebarOpen: false,
      threadListPaneProperties: createThreadListPanePropertiesIdentity("thread-1"),
    });
    const nextSnapshot = createMemoSnapshot({
      isMobileLayout: true,
      mobileSidebarOpen: false,
      desktopSidebarOpen: previousSnapshot.desktopSidebarOpen,
      threadListPaneProperties: createThreadListPanePropertiesIdentity("thread-2"),
      threadSidebarRuntimeSummary: {
        account: null,
        rateLimits: null,
        apps: null,
        progress: null,
        warning: null,
        tokenUsage: null,
        modelReroute: null,
      },
    });

    expect(areApplicationShellSidebarRegionMemoSnapshotsEqual(previousSnapshot, nextSnapshot)).toBe(
      true,
    );
  });

  it("still reacts to hidden mobile sidebar readiness transitions", () => {
    const previousSnapshot = createMemoSnapshot({
      isMobileLayout: true,
      mobileSidebarOpen: false,
      threadListPaneProperties: {
        ...createThreadListPanePropertiesIdentity("thread-1"),
        threadListState: "loading",
        isCoreLoading: true,
      },
    });
    const nextSnapshot = createMemoSnapshot({
      isMobileLayout: true,
      mobileSidebarOpen: false,
      desktopSidebarOpen: previousSnapshot.desktopSidebarOpen,
      threadListPaneProperties: {
        ...previousSnapshot.threadListPaneProperties,
        threadListState: "ready",
        isCoreLoading: false,
      },
    });

    expect(areApplicationShellSidebarRegionMemoSnapshotsEqual(previousSnapshot, nextSnapshot)).toBe(
      false,
    );
  });

  it("reacts to sidebar data changes when the mobile sidebar is visible", () => {
    const previousSnapshot = createMemoSnapshot({
      isMobileLayout: true,
      mobileSidebarOpen: true,
      threadListPaneProperties: createThreadListPanePropertiesIdentity("thread-1"),
    });
    const nextSnapshot = createMemoSnapshot({
      isMobileLayout: true,
      mobileSidebarOpen: true,
      desktopSidebarOpen: previousSnapshot.desktopSidebarOpen,
      threadListPaneProperties: createThreadListPanePropertiesIdentity("thread-2"),
    });

    expect(areApplicationShellSidebarRegionMemoSnapshotsEqual(previousSnapshot, nextSnapshot)).toBe(
      false,
    );
  });
});
interface ApplicationShellSidebarRegionMemoSnapshot {
  isMobileLayout: boolean;
  mobileSidebarOpen: boolean;
  desktopSidebarOpen: boolean;
  threadListPaneProperties: ThreadListPaneProperties;
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
  commitLabel: string;
  agentDescriptors: [];
  codexConfigured: boolean;
  threadSidebarHealthState: null;
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
}
