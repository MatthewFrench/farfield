import { cleanup, render } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationRouteStateMapper } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";
import {
  type UseApplicationRefreshEffectsInput,
  useApplicationRefreshEffects,
} from "../Source/Application/StateManagement/UseApplicationRefreshEffects";
import { DebugIssueStateResolver } from "../Source/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { LastViewedThreadPreferenceStore } from "../Source/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "../Source/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

const THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS = 30_000;
const THREAD_QUERY_CACHE_MAXIMUM_ENTRY_COUNT = 100;
const DISCONNECTED_CORE_REFRESH_INTERVAL_MILLISECONDS = 60_000;
const CONNECTED_CORE_REFRESH_MINIMUM_INTERVAL_MILLISECONDS = 300_000;
const CONNECTED_REFRESH_SUPPRESSION_OFFSET_MILLISECONDS = 1;
const TEST_LAST_VIEWED_THREAD_STORAGE_KEY = "test.last-viewed-thread.preference";
const LAST_VIEWED_THREAD_WRITE_OPERATION = "last-viewed-thread:write";
const LAST_VIEWED_THREAD_CLEAR_OPERATION = "last-viewed-thread:clear";

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
    threadQueryCache: new ThreadQueryCache(
      THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS,
      THREAD_QUERY_CACHE_MAXIMUM_ENTRY_COUNT,
    ),
    threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
    threadListStateStore: new ThreadListStateStore(),
    threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
  });
}

function createDispatchSpy<ValueType>(): Dispatch<SetStateAction<ValueType>> {
  return vi.fn();
}

function createBaseInput(): UseApplicationRefreshEffectsInput {
  return {
    selectedThreadId: null,
    activeTab: "chat",
    settingsWorkspaceSection: "notifications",
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
    setSettingsWorkspaceSection: createDispatchSpy<"notifications" | "debug">(),
    setSelectedDebugIssueId: createDispatchSpy<string>(),
    threadListStateController: createThreadListStateController(),
    lastViewedThreadPreferenceStore: new LastViewedThreadPreferenceStore(
      TEST_LAST_VIEWED_THREAD_STORAGE_KEY,
    ),
    debugIssueStateResolver: new DebugIssueStateResolver(),
    applicationRouteStateMapper: new ApplicationRouteStateMapper(),
    loadCoreDataTracked: vi.fn(async (): Promise<void> => {}),
    loadArchivedThreads: vi.fn(async (): Promise<void> => {}),
    refreshCoreDataAndSelectedThread: vi.fn(async (): Promise<void> => {}),
    refreshSelectedThreadIncrementalIfPresent: vi.fn(async (): Promise<void> => {}),
    isGenerating: false,
    refreshPushClientState: vi.fn(async (): Promise<void> => {}),
    ensureFreshPushSettingsDiagnostics: vi.fn(async (): Promise<void> => {}),
    handleRuntimeRequestError: vi.fn(),
    coreRefreshIntervalMs: DISCONNECTED_CORE_REFRESH_INTERVAL_MILLISECONDS,
    coreRefreshConnectedMinIntervalMs: CONNECTED_CORE_REFRESH_MINIMUM_INTERVAL_MILLISECONDS,
  };
}

describe("useApplicationRefreshEffects", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it("refreshes push diagnostics when notifications settings become active", async () => {
    const input = createBaseInput();
    input.activeTab = "debug";
    input.settingsWorkspaceSection = "notifications";

    render(<Harness input={input} />);
    await Promise.resolve();

    expect(input.ensureFreshPushSettingsDiagnostics).toHaveBeenCalledTimes(1);
  });

  it("routes notifications diagnostics refresh failures to runtime request error ownership", async () => {
    const expectedError = new Error("push-diagnostics-refresh-failed");
    const input = createBaseInput();
    input.activeTab = "debug";
    input.settingsWorkspaceSection = "notifications";
    input.ensureFreshPushSettingsDiagnostics = vi.fn(async (): Promise<void> => {
      throw expectedError;
    });

    render(<Harness input={input} />);
    await Promise.resolve();

    expect(input.handleRuntimeRequestError).toHaveBeenCalledWith(expectedError);
  });

  it("stores the selected thread identifier for future startup restoration", () => {
    const input = createBaseInput();
    input.selectedThreadId = "thread-persist";
    const writeLastViewedThreadIdentifierSpy = vi
      .spyOn(input.lastViewedThreadPreferenceStore, "writeLastViewedThreadIdentifier")
      .mockImplementation(() => {});

    render(<Harness input={input} />);

    expect(writeLastViewedThreadIdentifierSpy).toHaveBeenCalledWith("thread-persist");
  });

  it("does not clear the persisted thread identifier on initial no-selection render", () => {
    const input = createBaseInput();
    const clearLastViewedThreadIdentifierSpy = vi
      .spyOn(input.lastViewedThreadPreferenceStore, "clearLastViewedThreadIdentifier")
      .mockImplementation(() => {});

    render(<Harness input={input} />);

    expect(clearLastViewedThreadIdentifierSpy).not.toHaveBeenCalled();
  });

  it("clears the persisted thread identifier when selection transitions to no thread", () => {
    const input = createBaseInput();
    input.selectedThreadId = "thread-to-clear";
    const writeLastViewedThreadIdentifierSpy = vi
      .spyOn(input.lastViewedThreadPreferenceStore, "writeLastViewedThreadIdentifier")
      .mockImplementation(() => {});
    const clearLastViewedThreadIdentifierSpy = vi
      .spyOn(input.lastViewedThreadPreferenceStore, "clearLastViewedThreadIdentifier")
      .mockImplementation(() => {});

    const { rerender } = render(<Harness input={input} />);
    const nextInput: UseApplicationRefreshEffectsInput = {
      ...input,
      selectedThreadId: null,
    };
    rerender(<Harness input={nextInput} />);

    expect(writeLastViewedThreadIdentifierSpy).toHaveBeenCalledWith("thread-to-clear");
    expect(clearLastViewedThreadIdentifierSpy).toHaveBeenCalledTimes(1);
  });

  it("reports persistence write failures through runtime request error ownership", () => {
    const expectedStorageError = new Error("write-failed");
    const input = createBaseInput();
    const handleRuntimeRequestError = vi.fn();
    input.handleRuntimeRequestError = handleRuntimeRequestError;
    input.selectedThreadId = "thread-persist";
    vi.spyOn(
      input.lastViewedThreadPreferenceStore,
      "writeLastViewedThreadIdentifier",
    ).mockImplementation(() => {
      throw expectedStorageError;
    });

    render(<Harness input={input} />);

    expect(handleRuntimeRequestError).toHaveBeenCalledTimes(1);
    const runtimeError = handleRuntimeRequestError.mock.calls[0]?.[0];
    expect(String(runtimeError)).toContain(LAST_VIEWED_THREAD_WRITE_OPERATION);
    expect(String(runtimeError)).toContain("write-failed");
  });

  it("reports persistence clear failures through runtime request error ownership", () => {
    const expectedStorageError = new Error("clear-failed");
    const input = createBaseInput();
    const handleRuntimeRequestError = vi.fn();
    input.handleRuntimeRequestError = handleRuntimeRequestError;
    input.selectedThreadId = "thread-to-clear";
    vi.spyOn(
      input.lastViewedThreadPreferenceStore,
      "writeLastViewedThreadIdentifier",
    ).mockImplementation(() => {});
    vi.spyOn(
      input.lastViewedThreadPreferenceStore,
      "clearLastViewedThreadIdentifier",
    ).mockImplementation(() => {
      throw expectedStorageError;
    });

    const { rerender } = render(<Harness input={input} />);
    const nextInput: UseApplicationRefreshEffectsInput = {
      ...input,
      selectedThreadId: null,
    };
    rerender(<Harness input={nextInput} />);

    expect(handleRuntimeRequestError).toHaveBeenCalledTimes(1);
    const runtimeError = handleRuntimeRequestError.mock.calls[0]?.[0];
    expect(String(runtimeError)).toContain(LAST_VIEWED_THREAD_CLEAR_OPERATION);
    expect(String(runtimeError)).toContain("clear-failed");
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

  it("refreshes core data on disconnected watchdog cadence when the document is visible", async () => {
    vi.useFakeTimers();
    const input = createBaseInput();

    render(<Harness input={input} />);
    await vi.advanceTimersByTimeAsync(DISCONNECTED_CORE_REFRESH_INTERVAL_MILLISECONDS);

    expect(input.loadCoreDataTracked).toHaveBeenCalledTimes(1);
  });

  it("requires an elapsed connected watchdog interval before refreshing core data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const input = createBaseInput();
    input.eventsConnectedRef.current = true;
    input.lastCoreRefreshAtRef.current = CONNECTED_REFRESH_SUPPRESSION_OFFSET_MILLISECONDS;

    render(<Harness input={input} />);

    await vi.advanceTimersByTimeAsync(CONNECTED_CORE_REFRESH_MINIMUM_INTERVAL_MILLISECONDS);
    expect(input.loadCoreDataTracked).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(CONNECTED_CORE_REFRESH_MINIMUM_INTERVAL_MILLISECONDS);
    expect(input.loadCoreDataTracked).toHaveBeenCalledTimes(1);
  });

  it("runs selected-thread incremental watchdog refreshes while generation is in progress", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const input = createBaseInput();
    input.selectedThreadId = "thread-live";
    input.isGenerating = true;
    input.eventsConnectedRef.current = true;
    input.lastCoreRefreshAtRef.current = CONNECTED_REFRESH_SUPPRESSION_OFFSET_MILLISECONDS;

    render(<Harness input={input} />);
    await vi.advanceTimersByTimeAsync(DISCONNECTED_CORE_REFRESH_INTERVAL_MILLISECONDS);

    expect(input.refreshSelectedThreadIncrementalIfPresent).toHaveBeenCalledTimes(1);
    expect(input.loadCoreDataTracked).toHaveBeenCalledTimes(0);
  });

  it("routes selected-thread incremental watchdog refresh failures to runtime request error ownership", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const expectedError = new Error("selected-thread-incremental-refresh-failed");
    const input = createBaseInput();
    input.selectedThreadId = "thread-live";
    input.isGenerating = true;
    input.eventsConnectedRef.current = true;
    input.lastCoreRefreshAtRef.current = CONNECTED_REFRESH_SUPPRESSION_OFFSET_MILLISECONDS;
    input.refreshSelectedThreadIncrementalIfPresent = vi.fn(async (): Promise<void> => {
      throw expectedError;
    });

    render(<Harness input={input} />);
    await vi.advanceTimersByTimeAsync(DISCONNECTED_CORE_REFRESH_INTERVAL_MILLISECONDS);

    expect(input.handleRuntimeRequestError).toHaveBeenCalledWith(expectedError);
  });

  it("skips watchdog refreshes while hidden and resumes after visibility returns", async () => {
    vi.useFakeTimers();
    const input = createBaseInput();
    const visibilityStateGet = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");

    render(<Harness input={input} />);
    await vi.advanceTimersByTimeAsync(DISCONNECTED_CORE_REFRESH_INTERVAL_MILLISECONDS);
    expect(input.loadCoreDataTracked).toHaveBeenCalledTimes(0);

    visibilityStateGet.mockReturnValue("visible");
    await vi.advanceTimersByTimeAsync(DISCONNECTED_CORE_REFRESH_INTERVAL_MILLISECONDS);
    expect(input.loadCoreDataTracked).toHaveBeenCalledTimes(1);
  });
});
