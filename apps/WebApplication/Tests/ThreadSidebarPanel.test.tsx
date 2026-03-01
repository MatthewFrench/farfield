import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";
import { type ThreadSidebarRuntimeSummary } from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import { ThreadSidebarPanel } from "@/Features/Threads/UserInterface/ThreadSidebarPanel";

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

function renderThreadSidebarPanel(input: {
  viewport: "desktop" | "mobile";
  onHideDesktopSidebar?: () => void;
  onCloseMobileSidebar?: () => void;
  allSystemsReady?: boolean;
  hasAnySystemFailure?: boolean;
  threadSidebarRuntimeSummary?: ThreadSidebarRuntimeSummary;
}): void {
  cleanup();
  render(
    <TooltipProvider>
      <ThreadSidebarPanel
        viewport={input.viewport}
        threadListPaneProperties={BASE_THREAD_LIST_PANE_PROPERTIES}
        threadSidebarRuntimeSummary={
          input.threadSidebarRuntimeSummary ?? BASE_THREAD_SIDEBAR_RUNTIME_SUMMARY
        }
        onHideDesktopSidebar={input.onHideDesktopSidebar ?? (() => {})}
        onCloseMobileSidebar={input.onCloseMobileSidebar ?? (() => {})}
        allSystemsReady={input.allSystemsReady ?? true}
        hasAnySystemFailure={input.hasAnySystemFailure ?? false}
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

describe("ThreadSidebarPanel", () => {
  it("renders n-a runtime summary labels before notification projection reads complete", () => {
    renderThreadSidebarPanel({
      viewport: "desktop",
    });

    expect(screen.getByTestId("sidebar-runtime-rate-limit-summary").textContent).toBe("Usage n/a");
    expect(screen.getByTestId("sidebar-runtime-app-summary").textContent).toBe("Apps n/a");
  });

  it("renders projected runtime summary labels when data is available", () => {
    renderThreadSidebarPanel({
      viewport: "desktop",
      threadSidebarRuntimeSummary: {
        rateLimits: {
          limitId: "codex",
          planType: "pro",
          usedPercent: 42,
          refreshedAtMilliseconds: 1_700_000_000_000,
        },
        apps: {
          appCount: 3,
          refreshedAtMilliseconds: 1_700_000_000_500,
        },
      },
    });

    expect(screen.getByTestId("sidebar-runtime-rate-limit-summary").textContent).toBe(
      "Usage 42% · pro",
    );
    expect(screen.getByTestId("sidebar-runtime-app-summary").textContent).toBe("Apps 3");
  });

  it("calls desktop close handler", () => {
    const onHideDesktopSidebar = vi.fn();
    renderThreadSidebarPanel({
      viewport: "desktop",
      onHideDesktopSidebar,
    });

    const closeButton = screen.getByRole("button", { name: "Hide sidebar" });
    fireEvent.click(closeButton);
    expect(onHideDesktopSidebar).toHaveBeenCalledTimes(1);
  });

  it("calls mobile close handler", () => {
    const onCloseMobileSidebar = vi.fn();
    renderThreadSidebarPanel({
      viewport: "mobile",
      onCloseMobileSidebar,
    });

    const closeButton = screen.getByRole("button", { name: "Close sidebar" });
    fireEvent.click(closeButton);
    expect(onCloseMobileSidebar).toHaveBeenCalledTimes(1);
  });

  it("renders ready health indicator state when all systems are healthy", () => {
    renderThreadSidebarPanel({
      viewport: "desktop",
      allSystemsReady: true,
      hasAnySystemFailure: false,
    });

    expect(screen.getByTestId("sidebar-health-indicator").getAttribute("data-state")).toBe("ready");
  });

  it("renders failure health indicator state when a system failure is present", () => {
    renderThreadSidebarPanel({
      viewport: "desktop",
      allSystemsReady: false,
      hasAnySystemFailure: true,
    });

    expect(screen.getByTestId("sidebar-health-indicator").getAttribute("data-state")).toBe(
      "failure",
    );
  });
});
