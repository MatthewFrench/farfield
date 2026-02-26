import { cleanup, render } from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { ApplicationRouteStateMapper } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";
import {
  useApplicationRefreshEffects,
  type UseApplicationRefreshEffectsInput
} from "../Source/Application/StateManagement/UseApplicationRefreshEffects";
import { DebugIssueStateResolver } from "../Source/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "../Source/Features/Threads/StateManagement/ThreadListStateController";

interface HarnessProperties {
  input: UseApplicationRefreshEffectsInput;
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  useApplicationRefreshEffects(properties.input);
  return <div data-testid="application-refresh-effects-harness" />;
}

function createThreadListStateController(): ThreadListStateController {
  return new ThreadListStateController({
    threadServerClient: new ThreadServerClient(),
    threadQueryCache: new ThreadQueryCache(30_000, 100),
    threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
    threadListStateStore: new ThreadListStateStore(),
    threadListPresentationStateResolver: new ThreadListPresentationStateResolver()
  });
}

function createDispatchSpy<ValueType>(): Dispatch<SetStateAction<ValueType>> {
  return vi.fn();
}

function createBaseInput(): UseApplicationRefreshEffectsInput {
  return {
    selectedThreadId: null,
    activeTab: "chat",
    unreadThreadIds: {},
    isArchivedThreadsOpen: false,
    hasLoadedArchivedThreads: false,
    filteredDebugIssues: [],
    selectedDebugIssueId: "",
    selectedThreadIdRef: { current: null },
    activeTabRef: { current: "chat" },
    unreadThreadIdsRef: { current: {} },
    isArchivedThreadsOpenRef: { current: false },
    hasLoadedArchivedThreadsRef: { current: false },
    coreRefreshIntervalRef: { current: null },
    eventsConnectedRef: { current: false },
    lastCoreRefreshAtRef: { current: 0 },
    setUnreadThreadIds: createDispatchSpy<Record<string, true>>(),
    setSelectedThreadId: createDispatchSpy<string | null>(),
    setActiveTab: createDispatchSpy<"chat" | "debug">(),
    setSelectedDebugIssueId: createDispatchSpy<string>(),
    threadListStateController: createThreadListStateController(),
    debugIssueStateResolver: new DebugIssueStateResolver(),
    applicationRouteStateMapper: new ApplicationRouteStateMapper(),
    loadCoreDataTracked: vi.fn(async (): Promise<void> => {}),
    loadArchivedThreads: vi.fn(async (): Promise<void> => {}),
    refreshCoreDataAndSelectedThread: vi.fn(async (): Promise<void> => {}),
    refreshPushClientState: vi.fn(async (): Promise<void> => {}),
    handleRuntimeRequestError: vi.fn(),
    coreRefreshIntervalMs: 60_000,
    coreRefreshConnectedMinIntervalMs: 300_000
  };
}

describe("useApplicationRefreshEffects", () => {
  afterEach(() => {
    cleanup();
  });

  it("routes push-client refresh failures to runtime request error ownership", async () => {
    const expectedError = new Error("push-refresh-failed");
    const input = createBaseInput();
    input.refreshPushClientState = vi.fn(async (): Promise<void> => {
      throw expectedError;
    });

    render(<Harness input={input} />);
    await Promise.resolve();

    expect(input.handleRuntimeRequestError).toHaveBeenCalledWith(expectedError);
  });

  it("routes archived-thread load failures to runtime request error ownership", async () => {
    const expectedError = new Error("archived-load-failed");
    const input = createBaseInput();
    input.isArchivedThreadsOpen = true;
    input.loadArchivedThreads = vi.fn(async (): Promise<void> => {
      throw expectedError;
    });

    render(<Harness input={input} />);
    await Promise.resolve();

    expect(input.loadArchivedThreads).toHaveBeenCalledTimes(1);
    expect(input.handleRuntimeRequestError).toHaveBeenCalledWith(expectedError);
  });
});
