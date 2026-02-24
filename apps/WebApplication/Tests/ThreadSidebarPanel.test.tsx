import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPane";
import { ThreadSidebarPanel } from "@/Features/Threads/UserInterface/ThreadSidebarPanel";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";

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
  isGenerating: false,
  onToggleThreadProjectGroup: () => {},
  onCreateThreadForSingleAgent: () => {},
  onCreateNewThread: () => {},
  onSelectThread: () => {},
  onArchiveThread: () => {},
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
  renderAgentFavicon: () => null
};

function renderThreadSidebarPanel(input: {
  viewport: "desktop" | "mobile";
  onHideDesktopSidebar?: () => void;
  onCloseMobileSidebar?: () => void;
}): void {
  cleanup();
  render(
    <TooltipProvider>
      <ThreadSidebarPanel
        viewport={input.viewport}
        threadListPaneProperties={BASE_THREAD_LIST_PANE_PROPERTIES}
        onHideDesktopSidebar={input.onHideDesktopSidebar ?? (() => {})}
        onCloseMobileSidebar={input.onCloseMobileSidebar ?? (() => {})}
        allSystemsReady={true}
        hasAnySystemFailure={false}
        commitLabel="abc123"
        agentDescriptors={[
          {
            id: "codex",
            label: "Codex",
            enabled: true,
            connected: true
          }
        ]}
        codexConfigured={true}
        healthState={{
          appReady: true,
          ipcConnected: true,
          ipcInitialized: true,
          lastError: null
        }}
      />
    </TooltipProvider>
  );
}

describe("ThreadSidebarPanel", () => {
  it("calls desktop close handler", () => {
    const onHideDesktopSidebar = vi.fn();
    renderThreadSidebarPanel({
      viewport: "desktop",
      onHideDesktopSidebar
    });

    const closeButton = screen.getByRole("button", { name: "Hide sidebar" });
    fireEvent.click(closeButton);
    expect(onHideDesktopSidebar).toHaveBeenCalledTimes(1);
  });

  it("calls mobile close handler", () => {
    const onCloseMobileSidebar = vi.fn();
    renderThreadSidebarPanel({
      viewport: "mobile",
      onCloseMobileSidebar
    });

    const closeButton = screen.getByRole("button", { name: "Close sidebar" });
    fireEvent.click(closeButton);
    expect(onCloseMobileSidebar).toHaveBeenCalledTimes(1);
  });
});
