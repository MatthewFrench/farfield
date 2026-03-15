import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadDisplayNamePreferenceStore } from "../Source/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";
import {
  type ThreadMutationCreateThreadResponse,
  ThreadMutationServerClient,
} from "../Source/Features/Threads/DataAccess/ThreadMutationServerClient";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { PendingThreadMaterializationCoordinator } from "../Source/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import { ThreadComposerProjectContextStateOwner } from "../Source/Features/Threads/StateManagement/ThreadComposerProjectContextStateOwner";
import { ThreadDisplayNameStateOwner } from "../Source/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "../Source/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadMutationActionCoordinator } from "../Source/Features/Threads/StateManagement/ThreadMutationActionCoordinator";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";
import {
  type ThreadActionHandlers,
  type UseThreadActionHandlersInput,
  useThreadActionHandlers,
} from "../Source/Features/Threads/StateManagement/UseThreadActionHandlers";

const THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS = 60_000;
const THREAD_QUERY_CACHE_MAXIMUM_ENTRIES = 25;

interface ThreadActionHandlersHarnessProperties {
  input: UseThreadActionHandlersInput;
  onHandlersReady: (handlers: ThreadActionHandlers) => void;
}

function ThreadActionHandlersHarness({
  input,
  onHandlersReady,
}: ThreadActionHandlersHarnessProperties): React.JSX.Element {
  const handlers = useThreadActionHandlers(input);

  useEffect(() => {
    onHandlersReady(handlers);
  }, [handlers, onHandlersReady]);

  return <></>;
}

function createThreadListStateController(): ThreadListStateController {
  return new ThreadListStateController({
    threadServerClient: new ThreadServerClient(),
    threadQueryCache: new ThreadQueryCache(
      THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS,
      THREAD_QUERY_CACHE_MAXIMUM_ENTRIES,
    ),
    threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
    threadListStateStore: new ThreadListStateStore(),
    threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
  });
}

function createThreadDisplayNameStateOwner(): ThreadDisplayNameStateOwner {
  return new ThreadDisplayNameStateOwner({
    threadDisplayNamePreferenceStore: new ThreadDisplayNamePreferenceStore(
      "use-thread-action-handlers-test",
    ),
  });
}

describe("useThreadActionHandlers", () => {
  afterEach(() => {
    cleanup();
  });

  it("forces an explicit active-thread refresh before hydrating a newly created thread", async () => {
    const threadListStateController = createThreadListStateController();
    const prepareActiveThreadQueryForExplicitRefreshSpy = vi
      .spyOn(threadListStateController, "prepareActiveThreadQueryForExplicitRefresh")
      .mockResolvedValue(undefined);
    const loadCoreDataTracked = vi.fn(async (): Promise<void> => {});
    const loadSelectedThreadTracked = vi.fn(async (_threadId: string): Promise<void> => {});
    const threadMutationServerClient: ThreadMutationServerClient = {
      createThread: vi.fn(
        async (): Promise<ThreadMutationCreateThreadResponse> => ({
          threadId: "thread-created",
          agentId: "codex",
        }),
      ),
      archiveThread: vi.fn(async () => {}),
      forkThread: vi.fn(async () => ({
        threadId: "thread-forked",
        sourceThreadId: "thread-source",
      })),
      forkThreadFromMessage: vi.fn(async () => ({
        threadId: "thread-forked-from-message",
        sourceThreadId: "thread-source",
        sourceMessageId: "message-1",
      })),
      setThreadName: vi.fn(async () => {}),
      rollbackThread: vi.fn(async () => {}),
      compactThread: vi.fn(async () => {}),
      cleanThreadBackgroundTerminals: vi.fn(async () => {}),
      startThreadReview: vi.fn(async () => ({
        reviewThreadId: "thread-review",
        reviewTurnId: "turn-review",
      })),
      unarchiveThread: vi.fn(async () => {}),
    };
    const selectedThreadIdReference: UseThreadActionHandlersInput["selectedThreadIdRef"] = {
      current: null,
    };
    const pendingThreadCoordinator = new PendingThreadMaterializationCoordinator();
    const threadComposerProjectContextStateOwner = new ThreadComposerProjectContextStateOwner();
    const handlersReference: { current: ThreadActionHandlers | null } = {
      current: null,
    };

    const input: UseThreadActionHandlersInput = {
      availableAgentIds: ["codex"],
      threads: [],
      buildActionRequestOptions: (actionName) => ({
        actionId: `action-${actionName}`,
        requestOptions: {
          actionId: `action-${actionName}`,
          actionName,
        },
      }),
      setIsBusy: vi.fn(),
      setError: vi.fn(),
      setSuccessBannerDetails: vi.fn(),
      setSelectedThreadId: vi.fn(),
      setMobileSidebarOpen: vi.fn(),
      selectedThreadIdRef: selectedThreadIdReference,
      pendingThreadMaterializationCoordinator: pendingThreadCoordinator,
      threadMutationActionCoordinator: new ThreadMutationActionCoordinator(),
      threadMutationServerClient,
      threadComposerProjectContextStateOwner,
      threadDisplayNameStateOwner: createThreadDisplayNameStateOwner(),
      threadListStateController,
      loadCoreDataTracked,
      loadSelectedThreadTracked,
      reportTrackedUserInterfaceError: vi.fn(async () => {}),
    };

    render(
      <ThreadActionHandlersHarness
        input={input}
        onHandlersReady={(handlers) => {
          handlersReference.current = handlers;
        }}
      />,
    );

    await waitFor(() => {
      expect(handlersReference.current).not.toBeNull();
    });

    const handlers = handlersReference.current;
    if (handlers === null) {
      throw new Error("Expected thread action handlers to be available");
    }

    await act(async () => {
      await handlers.createNewThread("/tmp/project", "codex");
    });

    expect(threadMutationServerClient.createThread).toHaveBeenCalledWith(
      {
        cwd: "/tmp/project",
        agentId: "codex",
      },
      {
        actionId: "action-create-thread",
        actionName: "create-thread",
      },
    );
    expect(prepareActiveThreadQueryForExplicitRefreshSpy).toHaveBeenCalledTimes(1);
    expect(loadCoreDataTracked).toHaveBeenCalledTimes(1);
    expect(loadSelectedThreadTracked).toHaveBeenCalledWith("thread-created");
    expect(pendingThreadCoordinator.isPending("thread-created")).toBe(true);
    expect(threadComposerProjectContextStateOwner.readCurrentProjectPath()).toBe("/tmp/project");
    expect(selectedThreadIdReference.current).toBe("thread-created");
    expect(prepareActiveThreadQueryForExplicitRefreshSpy.mock.invocationCallOrder[0]).toBeLessThan(
      loadCoreDataTracked.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(loadCoreDataTracked.mock.invocationCallOrder[0]).toBeLessThan(
      loadSelectedThreadTracked.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });
});
