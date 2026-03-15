import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ThreadListItem,
  type ThreadProjectGroup,
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type UseThreadListPanePropertiesInput,
  useThreadListPaneProperties,
} from "@/Features/Threads/StateManagement/UseThreadListPaneProperties";
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
    hasUnreadTurn: null,
    isLoadedInMemory: true,
    isProjectRemoved: false,
  },
];

const ACTIVE_PROJECT_GROUPS: ThreadProjectGroup[] = [
  {
    key: "project:/Users/example/alpha",
    label: "alpha",
    projectPath: "/Users/example/alpha",
    projectCreatedAt: 1_735_600_000_001,
    latestUpdatedAt: 1_735_600_000_101,
    threads: ACTIVE_THREAD_ITEMS,
    isRemoved: false,
  },
];

function createInput(): UseThreadListPanePropertiesInput {
  return {
    threadListState: "ready" as ThreadListPaneProperties["threadListState"],
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
    setCollapsedThreadProjectGroups: vi.fn(),
    createThreadForSingleAgent: vi.fn(),
    createNewThread: vi.fn(),
    setSelectedThreadId: vi.fn(),
    selectedThreadIdRef: { current: null },
    setIsSelectedThreadLoading: vi.fn(),
    applyCachedSelectedThreadSnapshot: vi.fn(() => false),
    setMobileSidebarOpen: vi.fn(),
    archiveThread: vi.fn(),
    forkThread: vi.fn(),
    rollbackThread: vi.fn(),
    compactThread: vi.fn(),
    cleanThreadBackgroundTerminals: vi.fn(),
    startThreadReview: vi.fn(),
    setThreadName: vi.fn(),
    isArchivedThreadsOpen: false,
    setIsArchivedThreadsOpen: vi.fn(),
    isArchivedThreadsLoading: false,
    hasLoadedArchivedThreads: false,
    archivedSectionThreadCount: 0,
    archivedThreadsTruncated: false,
    archivedProjectGroups: [],
    collapsedArchivedProjectGroups: {},
    archivedThreadIds: new Set<string>(),
    setCollapsedArchivedProjectGroups: vi.fn(),
    unarchiveThread: vi.fn(),
    formatDate: vi.fn(() => ""),
    renderAgentFavicon: vi.fn(() => null),
  };
}

describe("UseThreadListPaneProperties", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies the thread id through the pane properties owner callback", () => {
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });

    const { result } = renderHook(() => useThreadListPaneProperties(createInput()));

    result.current.onCopyThreadId("thread_active_one");

    expect(writeText).toHaveBeenCalledWith("thread_active_one");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });
});
