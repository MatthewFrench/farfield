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
  account: null,
  rateLimits: null,
  apps: null,
  progress: null,
  warning: null,
  tokenUsage: null,
  modelReroute: null,
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

    expect(screen.getByTestId("sidebar-runtime-account-summary").textContent).toBe("Account n/a");
    expect(screen.getByTestId("sidebar-runtime-rate-limit-summary").textContent).toBe("Usage n/a");
    expect(screen.getByTestId("sidebar-runtime-app-summary").textContent).toBe("Apps n/a");
    expect(screen.getByTestId("sidebar-runtime-progress-summary").textContent).toBe("Progress n/a");
    expect(screen.getByTestId("sidebar-runtime-token-usage-summary").textContent).toBe(
      "Tokens n/a",
    );
  });

  it("renders projected runtime summary labels when data is available", () => {
    renderThreadSidebarPanel({
      viewport: "desktop",
      threadSidebarRuntimeSummary: {
        account: {
          mode: "chatgpt",
          planType: "pro",
          email: "dev@example.com",
          requiresOpenaiAuth: false,
          refreshedAtMilliseconds: 1_700_000_000_100,
        },
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
        progress: {
          method: "thread/started",
          threadId: "thread-1",
          turnId: null,
          preview: "Thread one",
          modelProvider: "openai",
          sequence: 17,
          receivedAtMilliseconds: 1_700_000_000_550,
          refreshedAtMilliseconds: 1_700_000_000_560,
        },
        warning: null,
        tokenUsage: {
          threadId: "thread-1",
          turnId: "turn-1",
          totalTokens: 42_000,
          lastTotalTokens: 10_000,
          modelContextWindow: 200_000,
          usedPercent: 21,
          sequence: 18,
          receivedAtMilliseconds: 1_700_000_000_600,
          refreshedAtMilliseconds: 1_700_000_000_700,
        },
        modelReroute: null,
      },
    });

    expect(screen.getByTestId("sidebar-runtime-account-summary").textContent).toBe("Account pro");
    expect(screen.getByTestId("sidebar-runtime-rate-limit-summary").textContent).toBe(
      "Usage 42% · pro",
    );
    expect(screen.getByTestId("sidebar-runtime-app-summary").textContent).toBe("Apps 3");
    expect(screen.getByTestId("sidebar-runtime-progress-summary").textContent).toBe(
      "Progress started",
    );
    expect(screen.getByTestId("sidebar-runtime-token-usage-summary").textContent).toBe(
      "Tokens 21%",
    );
  });

  it("renders compacted progress label when latest progress event is compaction", () => {
    renderThreadSidebarPanel({
      viewport: "desktop",
      threadSidebarRuntimeSummary: {
        account: null,
        rateLimits: null,
        apps: null,
        progress: {
          method: "thread/compacted",
          threadId: "thread-1",
          turnId: "turn-3",
          preview: null,
          modelProvider: null,
          sequence: 19,
          receivedAtMilliseconds: 1_700_000_000_800,
          refreshedAtMilliseconds: 1_700_000_000_900,
        },
        warning: null,
        tokenUsage: null,
        modelReroute: null,
      },
    });

    expect(screen.getByTestId("sidebar-runtime-progress-summary").textContent).toBe(
      "Progress compacted",
    );
  });

  it("renders turn-completed progress label when latest progress event is turn completion", () => {
    renderThreadSidebarPanel({
      viewport: "desktop",
      threadSidebarRuntimeSummary: {
        account: null,
        rateLimits: null,
        apps: null,
        progress: {
          method: "turn/completed",
          threadId: "thread-1",
          turnId: "turn-4",
          preview: null,
          modelProvider: null,
          sequence: 20,
          receivedAtMilliseconds: 1_700_000_000_950,
          refreshedAtMilliseconds: 1_700_000_000_990,
        },
        warning: null,
        tokenUsage: null,
        modelReroute: null,
      },
    });

    expect(screen.getByTestId("sidebar-runtime-progress-summary").textContent).toBe(
      "Progress turn completed",
    );
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
