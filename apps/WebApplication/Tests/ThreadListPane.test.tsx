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

function createThreadListPaneProperties(
  overrides: Partial<ThreadListPaneProperties> = {},
): ThreadListPaneProperties {
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
    ...overrides,
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

  it("renders runtime status badges for thread rows", () => {
    cleanup();
    render(
      <ThreadListPane
        {...createThreadListPaneProperties({
          threadRuntimeStatusByThreadIdentifier: {
            thread_active_one: {
              sequence: 22,
              statusType: "active",
              activeFlags: ["waitingOnApproval"],
              receivedAtMilliseconds: 8_450,
            },
          },
        })}
      />,
    );

    expect(screen.getByTestId("thread-runtime-status-badge-thread_active_one").textContent).toBe(
      "Awaiting approval",
    );
    expect(screen.queryByTestId("thread-runtime-status-badge-thread_active_two")).toBeNull();
  });

  it("shows a generating spinner for non-selected rows with active runtime status", () => {
    cleanup();
    render(
      <ThreadListPane
        {...createThreadListPaneProperties({
          selectedThreadId: "thread_active_one",
          isGenerating: false,
          threadRuntimeStatusByThreadIdentifier: {
            thread_active_two: {
              sequence: 25,
              statusType: "active",
              activeFlags: [],
              receivedAtMilliseconds: 8_500,
            },
          },
        })}
      />,
    );

    expect(screen.queryByTestId("thread-generating-indicator-thread_active_two")).not.toBeNull();
  });

  it("suppresses unread marker while a thread runtime status is still active", () => {
    cleanup();
    render(
      <ThreadListPane
        {...createThreadListPaneProperties({
          unreadThreadIds: {
            thread_active_two: true,
          },
          threadRuntimeStatusByThreadIdentifier: {
            thread_active_two: {
              sequence: 25,
              statusType: "active",
              activeFlags: [],
              receivedAtMilliseconds: 8_500,
            },
          },
        })}
      />,
    );

    expect(screen.queryByTestId("thread-unread-indicator-thread_active_two")).toBeNull();
    expect(screen.queryByTestId("thread-generating-indicator-thread_active_two")).not.toBeNull();
  });

  it("prefers last user message text for active thread row titles", () => {
    cleanup();
    const firstActiveThread = ACTIVE_THREAD_ITEMS[0];
    const firstActiveProjectGroup = ACTIVE_PROJECT_GROUPS[0];
    if (firstActiveThread === undefined || firstActiveProjectGroup === undefined) {
      throw new Error("Thread list test fixtures must include at least one active thread group.");
    }
    const threadWithLatestUserMessage: ThreadListItem = {
      ...firstActiveThread,
      id: "thread_with_latest_user_message",
      preview: "Initial thread preview",
      lastUserMessage: "Latest user request to refactor dashboard filters",
    };
    render(
      <ThreadListPane
        {...createThreadListPaneProperties({
          threads: [threadWithLatestUserMessage],
          activeProjectGroups: [
            {
              ...firstActiveProjectGroup,
              key: "project:/Users/example/latest-user-message",
              projectPath: "/Users/example/latest-user-message",
              label: "latest-user-message",
              threads: [threadWithLatestUserMessage],
            },
          ],
        })}
      />,
    );

    expect(screen.queryByText("Latest user request to refactor dashboard filters")).not.toBeNull();
    expect(screen.queryByText("Initial thread preview")).toBeNull();
  });

  it("falls back to metadata thread name when last user message is unavailable", () => {
    cleanup();
    const firstActiveThread = ACTIVE_THREAD_ITEMS[0];
    const firstActiveProjectGroup = ACTIVE_PROJECT_GROUPS[0];
    if (firstActiveThread === undefined || firstActiveProjectGroup === undefined) {
      throw new Error("Thread list test fixtures must include at least one active thread group.");
    }
    const threadWithMetadataName: ThreadListItem = {
      ...firstActiveThread,
      id: "thread_with_metadata_name",
      preview: "Preview fallback should not render",
      displayName: "Metadata-provided thread name",
      lastUserMessage: undefined,
    };
    render(
      <ThreadListPane
        {...createThreadListPaneProperties({
          threads: [threadWithMetadataName],
          activeProjectGroups: [
            {
              ...firstActiveProjectGroup,
              key: "project:/Users/example/metadata-name",
              projectPath: "/Users/example/metadata-name",
              label: "metadata-name",
              threads: [threadWithMetadataName],
            },
          ],
        })}
      />,
    );

    expect(screen.queryByText("Metadata-provided thread name")).not.toBeNull();
    expect(screen.queryByText("Preview fallback should not render")).toBeNull();
  });

  it("renders thread row labels with a two-line clamp style", () => {
    cleanup();
    render(<ThreadListPane {...createThreadListPaneProperties()} />);

    const firstThreadRow = screen.getAllByTestId("thread-list-item")[0];
    if (firstThreadRow === undefined) {
      throw new Error("Expected at least one thread list row for wrapping assertions.");
    }
    const firstThreadLabel = screen.getByText("Payment bug investigation");
    expect(firstThreadRow.className).toContain("whitespace-normal");
    expect(firstThreadLabel.className).toContain("line-clamp-2");
  });

  it("renders row action menu above no-wrap time metadata", () => {
    cleanup();
    render(
      <ThreadListPane
        {...createThreadListPaneProperties({
          isArchivedThreadsOpen: false,
          formatDate: () => "1d ago",
        })}
      />,
    );

    const menuTriggerForFirstThread = screen
      .getAllByTestId("thread-row-menu-trigger")
      .find((element) => element.getAttribute("data-thread-id") === "thread_active_one");
    if (menuTriggerForFirstThread === undefined) {
      throw new Error("Expected menu trigger for first active thread.");
    }
    const firstThreadTime = screen.getByTestId("thread-row-time-thread_active_one");

    expect(firstThreadTime.className).toContain("whitespace-nowrap");
    expect(
      menuTriggerForFirstThread.compareDocumentPosition(firstThreadTime) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });
});
