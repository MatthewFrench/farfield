import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type ThreadListItem,
  type ThreadProjectGroup,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListPane } from "@/Features/Threads/UserInterface/ThreadListPane";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";

const ACTIVE_THREAD_ITEMS: ThreadListItem[] = [
  {
    id: "thread_active_one",
    preview: "Payment bug investigation",
    createdAt: 1_735_600_000_001,
    updatedAt: 1_735_600_000_101,
    cwd: "/Users/example/alpha",
    path: "/Users/example/alpha",
    agentId: "codex",
  },
  {
    id: "thread_active_two",
    preview: "Landing page cleanup",
    createdAt: 1_735_600_000_002,
    updatedAt: 1_735_600_000_102,
    cwd: "/Users/example/beta",
    path: "/Users/example/beta",
    agentId: "codex",
  },
];

const ARCHIVED_THREAD_ITEMS: ThreadListItem[] = [
  {
    id: "thread_archived_one",
    preview: "Archived regression follow-up",
    createdAt: 1_735_500_000_001,
    updatedAt: 1_735_500_000_101,
    cwd: "/Users/example/archive",
    path: "/Users/example/archive",
    agentId: "codex",
  },
];

const ACTIVE_PROJECT_GROUPS: ThreadProjectGroup[] = [
  {
    key: "project:/Users/example/alpha",
    label: "alpha",
    projectPath: "/Users/example/alpha",
    projectCreatedAt: 1_735_600_000_001,
    latestUpdatedAt: 1_735_600_000_102,
    threads: ACTIVE_THREAD_ITEMS,
    isRemoved: false,
  },
];

const ARCHIVED_PROJECT_GROUPS: ThreadProjectGroup[] = [
  {
    key: "project:/Users/example/archive",
    label: "archive",
    projectPath: "/Users/example/archive",
    projectCreatedAt: 1_735_500_000_001,
    latestUpdatedAt: 1_735_500_000_101,
    threads: ARCHIVED_THREAD_ITEMS,
    isRemoved: false,
  },
];

function createThreadListPaneProperties(): ThreadListPaneProperties {
  return {
    threadListState: "ready",
    threads: ACTIVE_THREAD_ITEMS,
    isCoreLoading: false,
    availableAgentIds: ["codex"],
    selectedAgentDescriptor: {
      label: "Codex",
      projectDirectories: ["/Users/example/alpha"],
    },
    selectedAgentLabel: "Codex",
    agentsById: {
      codex: {
        label: "Codex",
        projectDirectories: ["/Users/example/alpha"],
      },
    },
    isBusy: false,
    activeProjectGroups: ACTIVE_PROJECT_GROUPS,
    selectedThreadId: null,
    collapsedThreadProjectGroups: {},
    unreadThreadIds: {},
    isGenerating: false,
    onToggleThreadProjectGroup: () => {},
    onCreateThreadForSingleAgent: () => {},
    onCreateNewThread: () => {},
    onSelectThread: () => {},
    onArchiveThread: () => {},
    isArchivedThreadsOpen: true,
    onToggleArchivedThreads: () => {},
    isArchivedThreadsLoading: false,
    hasLoadedArchivedThreads: true,
    archivedSectionThreadCount: 1,
    archivedThreadsTruncated: false,
    archivedProjectGroups: ARCHIVED_PROJECT_GROUPS,
    collapsedArchivedProjectGroups: {},
    archivedThreadIds: new Set<string>(["thread_archived_one"]),
    onToggleArchivedProjectGroup: () => {},
    onUnarchiveThread: () => {},
    formatDate: () => "",
    renderAgentFavicon: () => null,
  };
}

describe("ThreadListPane", () => {
  it("filters active and archived thread rows when search query changes", () => {
    cleanup();
    render(<ThreadListPane {...createThreadListPaneProperties()} />);

    expect(screen.queryByText("Payment bug investigation")).not.toBeNull();
    expect(screen.queryByText("Landing page cleanup")).not.toBeNull();
    expect(screen.queryByText("Archived regression follow-up")).not.toBeNull();

    fireEvent.change(screen.getByTestId("thread-list-search-input"), {
      target: { value: "archived" },
    });

    expect(screen.queryByText("Payment bug investigation")).toBeNull();
    expect(screen.queryByText("Landing page cleanup")).toBeNull();
    expect(screen.queryByText("Archived regression follow-up")).not.toBeNull();
    expect(screen.getByTestId("thread-list-search-summary").textContent).toContain(
      "1 matching thread",
    );
  });

  it("restores complete list after clearing search input", () => {
    cleanup();
    render(<ThreadListPane {...createThreadListPaneProperties()} />);

    fireEvent.change(screen.getByTestId("thread-list-search-input"), {
      target: { value: "payment" },
    });

    expect(screen.queryByText("Landing page cleanup")).toBeNull();

    fireEvent.click(screen.getByTestId("thread-list-search-clear"));

    expect(screen.queryByText("Payment bug investigation")).not.toBeNull();
    expect(screen.queryByText("Landing page cleanup")).not.toBeNull();
    expect(screen.queryByText("Archived regression follow-up")).not.toBeNull();
  });

  it("shows a no-match summary when search query returns no threads", () => {
    cleanup();
    render(<ThreadListPane {...createThreadListPaneProperties()} />);

    fireEvent.change(screen.getByTestId("thread-list-search-input"), {
      target: { value: "no-results-here" },
    });

    expect(screen.queryByText("Payment bug investigation")).toBeNull();
    expect(screen.queryByText("Landing page cleanup")).toBeNull();
    expect(screen.queryByText("Archived regression follow-up")).toBeNull();
    expect(screen.getByTestId("thread-list-search-summary").textContent).toContain(
      "No matching threads",
    );
  });
});
