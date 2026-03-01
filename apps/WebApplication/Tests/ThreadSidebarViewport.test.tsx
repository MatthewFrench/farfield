import { cleanup, fireEvent, type RenderResult, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import { ThreadSidebarViewport } from "@/Features/Threads/UserInterface/ThreadSidebarViewport";

const BASE_THREAD_LIST_PANE_PROPERTIES: ThreadListPaneProperties = {
  threadListState: "empty",
  threads: [],
  isCoreLoading: false,
  availableAgentIds: [],
  selectedAgentDescriptor: null,
  selectedAgentLabel: "Agent",
  agentsById: {},
  isBusy: false,
  activeProjectGroups: [],
  selectedThreadId: null,
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

const BASE_THREAD_SIDEBAR_RUNTIME_SUMMARY: ThreadSidebarRuntimeSummary = {
  rateLimits: null,
  apps: null,
};

function renderThreadSidebarViewport(input: {
  viewport: "desktop" | "mobile";
  isOpen: boolean;
  onCloseMobileSidebar?: () => void;
}): RenderResult {
  cleanup();
  return render(
    <TooltipProvider>
      <ThreadSidebarViewport
        viewport={input.viewport}
        isOpen={input.isOpen}
        threadListPaneProperties={BASE_THREAD_LIST_PANE_PROPERTIES}
        threadSidebarRuntimeSummary={BASE_THREAD_SIDEBAR_RUNTIME_SUMMARY}
        onHideDesktopSidebar={() => {}}
        onCloseMobileSidebar={input.onCloseMobileSidebar ?? (() => {})}
        allSystemsReady={true}
        hasAnySystemFailure={false}
        commitLabel="abc123"
        agentDescriptors={[
          {
            id: "codex",
            label: "Codex",
            enabled: true,
            connected: true,
          },
        ]}
        codexConfigured={true}
        healthState={{
          appReady: true,
          ipcConnected: true,
          ipcInitialized: true,
          lastError: null,
        }}
      />
    </TooltipProvider>,
  );
}

describe("ThreadSidebarViewport", () => {
  it("renders desktop sidebar when open", () => {
    renderThreadSidebarViewport({
      viewport: "desktop",
      isOpen: true,
    });

    expect(screen.getByTestId("sidebar-desktop")).toBeDefined();
  });

  it("does not render desktop sidebar when closed", () => {
    renderThreadSidebarViewport({
      viewport: "desktop",
      isOpen: false,
    });

    expect(screen.queryByTestId("sidebar-desktop")).toBeNull();
  });

  it("calls mobile close handler", () => {
    const onCloseMobileSidebar = vi.fn();
    renderThreadSidebarViewport({
      viewport: "mobile",
      isOpen: true,
      onCloseMobileSidebar,
    });

    fireEvent.click(screen.getByTestId("sidebar-toggle-close"));
    expect(onCloseMobileSidebar).toHaveBeenCalledTimes(1);
  });

  it("keeps desktop sidebar mounted after it has been opened once", () => {
    const renderResult = renderThreadSidebarViewport({
      viewport: "desktop",
      isOpen: true,
    });
    expect(screen.getByTestId("sidebar-desktop")).toBeDefined();

    renderResult.rerender(
      <TooltipProvider>
        <ThreadSidebarViewport
          viewport="desktop"
          isOpen={false}
          threadListPaneProperties={BASE_THREAD_LIST_PANE_PROPERTIES}
          threadSidebarRuntimeSummary={BASE_THREAD_SIDEBAR_RUNTIME_SUMMARY}
          onHideDesktopSidebar={() => {}}
          onCloseMobileSidebar={() => {}}
          allSystemsReady={true}
          hasAnySystemFailure={false}
          commitLabel="abc123"
          agentDescriptors={[
            {
              id: "codex",
              label: "Codex",
              enabled: true,
              connected: true,
            },
          ]}
          codexConfigured={true}
          healthState={{
            appReady: true,
            ipcConnected: true,
            ipcInitialized: true,
            lastError: null,
          }}
        />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("sidebar-desktop")).toBeDefined();
  });
});
