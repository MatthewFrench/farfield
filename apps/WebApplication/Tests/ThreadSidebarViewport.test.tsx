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
  account: null,
  rateLimits: null,
  apps: null,
  progress: null,
  warning: null,
  tokenUsage: null,
  modelReroute: null,
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

  it("keeps desktop sidebar rendered but hidden when closed", () => {
    renderThreadSidebarViewport({
      viewport: "desktop",
      isOpen: false,
    });

    const desktopSidebar = screen.getByTestId("sidebar-desktop");
    expect(desktopSidebar.getAttribute("aria-hidden")).toBe("true");
    expect(desktopSidebar.style.transform).toBe("translateX(-280px)");
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

  it("preserves desktop sidebar element identity across open and close", () => {
    const renderResult = renderThreadSidebarViewport({
      viewport: "desktop",
      isOpen: false,
    });
    const desktopSidebarBeforeOpen = screen.getByTestId("sidebar-desktop");

    renderResult.rerender(
      <TooltipProvider>
        <ThreadSidebarViewport
          viewport="desktop"
          isOpen={true}
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

    const desktopSidebarAfterOpen = screen.getByTestId("sidebar-desktop");
    expect(desktopSidebarAfterOpen).toBe(desktopSidebarBeforeOpen);

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

    expect(screen.getByTestId("sidebar-desktop")).toBe(desktopSidebarBeforeOpen);
  });

  it("keeps mobile sidebar rendered but hidden when closed", () => {
    renderThreadSidebarViewport({
      viewport: "mobile",
      isOpen: false,
    });

    const mobileSidebar = screen.getByTestId("sidebar-mobile");
    expect(mobileSidebar.getAttribute("aria-hidden")).toBe("true");
    expect(mobileSidebar.style.transform).toBe("translateX(-280px)");
  });

  it("preserves mobile sidebar element identity across open and close", () => {
    const renderResult = renderThreadSidebarViewport({
      viewport: "mobile",
      isOpen: false,
    });
    const mobileSidebarBeforeOpen = screen.getByTestId("sidebar-mobile");

    renderResult.rerender(
      <TooltipProvider>
        <ThreadSidebarViewport
          viewport="mobile"
          isOpen={true}
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

    expect(screen.getByTestId("sidebar-mobile")).toBe(mobileSidebarBeforeOpen);

    renderResult.rerender(
      <TooltipProvider>
        <ThreadSidebarViewport
          viewport="mobile"
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

    expect(screen.getByTestId("sidebar-mobile")).toBe(mobileSidebarBeforeOpen);
  });
});
