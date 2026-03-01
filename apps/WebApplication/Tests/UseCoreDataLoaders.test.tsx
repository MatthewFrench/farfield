import { act, cleanup, render } from "@testing-library/react";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoreDataRefreshConcurrencyCoordinator } from "../Source/Application/StateManagement/CoreDataRefreshConcurrencyCoordinator";
import {
  STARTUP_CRITICAL_THREADS_OPERATION,
  STARTUP_DEFERRED_AGENTS_OPERATION,
  STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION,
  STARTUP_DEFERRED_HEALTH_OPERATION,
} from "../Source/Application/StateManagement/CoreDataStartupRequestProfile";
import {
  type CoreDataCapabilitySnapshot,
  type CoreDataLoaders,
  type UseCoreDataLoadersInput,
  useCoreDataLoaders,
} from "../Source/Application/StateManagement/UseCoreDataLoaders";
import {
  type CapabilityAgentsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityHealthResponse,
  type CapabilityModelsResponse,
  CapabilityServerClient,
} from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";
import { CapabilitySnapshotCache } from "../Source/Features/Capabilities/DataAccess/CapabilitySnapshotCache";
import { DebugServerClient } from "../Source/Features/Debugging/DataAccess/DebugServerClient";
import { DebugWorkspaceDataReader } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import type { ThreadListResponse } from "../Source/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import {
  type LoadActiveThreadStateResult,
  ThreadListStateController,
} from "../Source/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";
import type { AgentId, ApiRequestOptions } from "../Source/Shared/Contracts/ApiContracts";

const THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS = 60_000;
const THREAD_QUERY_CACHE_MAXIMUM_ENTRIES = 10;
const CAPABILITY_SNAPSHOT_REFRESH_INTERVAL_MILLISECONDS = 60_000;
const HEALTH_RESPONSE: CapabilityHealthResponse = {
  ok: true,
  state: {
    appReady: true,
    ipcConnected: true,
    ipcInitialized: true,
    lastError: null,
    historyCount: 0,
    threadOwnerCount: 0,
  },
};
const AGENTS_RESPONSE: CapabilityAgentsResponse = {
  ok: true,
  agents: [
    {
      id: "codex",
      label: "Codex",
      enabled: true,
      connected: true,
      capabilities: {
        canListModels: true,
        canListCollaborationModes: true,
        canReadConfigRequirements: true,
        canListExperimentalFeatures: true,
        canListMcpServerStatuses: true,
        canListApps: true,
        canListSkills: true,
        canReadAccount: true,
        canReadAccountRateLimits: true,
        canSearchFuzzyFiles: true,
        canExecuteCommand: true,
        canStartAccountLogin: true,
        canCancelAccountLogin: true,
        canLogoutAccount: true,
        canReloadMcpServerConfig: true,
        canStartMcpServerOauthLogin: true,
        canWriteConfigValue: true,
        canWriteSkillsConfig: true,
        canDetectExternalAgentConfig: true,
        canImportExternalAgentConfig: true,
        canStartThreadRealtime: true,
        canAppendThreadRealtimeAudio: true,
        canAppendThreadRealtimeText: true,
        canStopThreadRealtime: true,
        canStartWindowsSandboxSetup: true,
        canSetCollaborationMode: true,
        canSubmitUserInput: true,
        canReadLiveState: true,
        canReadStreamEvents: true,

        canReadNotificationEvents: true,
      },
      projectDirectories: [],
    },
  ],
  defaultAgentId: "codex",
};
const COLLABORATION_MODES_RESPONSE: CapabilityCollaborationModesResponse = {
  data: [
    {
      name: "Balanced",
      mode: "default",
      model: "gpt-5",
      reasoning_effort: "medium",
    },
  ],
};
const MODELS_RESPONSE: CapabilityModelsResponse = {
  data: [
    {
      id: "gpt-5",
      model: "gpt-5",
      displayName: "GPT-5",
      description: "General model",
      hidden: false,
      isDefault: true,
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: [
        {
          reasoningEffort: "medium",
          description: "Balanced reasoning",
        },
      ],
      inputModalities: ["text", "image"],
      supportsPersonality: false,
    },
  ],
  nextCursor: null,
};
const CONFIG_DEFAULTS_RESPONSE: CapabilityConfigDefaultsResponse = {
  ok: true,
  agentId: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
};
const THREADS: ThreadListResponse["data"] = [
  {
    id: "thread-1",
    preview: "",
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    agentId: "codex",
  },
];
const ACTIVE_THREAD_STATE: LoadActiveThreadStateResult = {
  didChangeThreads: true,
  nextThreads: THREADS,
  nextUnreadThreadIdentifiers: {},
  loadedFromCache: false,
};
interface CoreDataLoadersHarnessProperties {
  input: UseCoreDataLoadersInput;
  onSnapshot: (snapshot: CoreDataLoaders) => void;
}
interface ControlledPromise<Value> {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
}
interface CoreDataLoadersTestHarness {
  input: UseCoreDataLoadersInput;
  capabilityServerClient: CapabilityServerClient;
  threadListStateController: ThreadListStateController;
  setHealthMock: Dispatch<SetStateAction<CapabilityHealthResponse | null>>;
  actionLog: string[];
}
function createNoopStateSetter<Value>(): Dispatch<SetStateAction<Value>> {
  return (_value) => {};
}

function createControlledPromise<Value>(): ControlledPromise<Value> {
  let resolvePromise: ((value: Value | PromiseLike<Value>) => void) | null = null;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => {
      if (!resolvePromise) {
        throw new Error("Expected controlled promise resolver to be initialized");
      }
      resolvePromise(value);
    },
  };
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

function createActionRequestBuilder(actionLog: string[]): (actionName: string) => {
  actionId: string;
  requestOptions: ApiRequestOptions;
} {
  let actionSequence = 0;
  return (actionName: string) => {
    actionSequence += 1;
    const actionId = `action-${String(actionSequence)}`;
    actionLog.push(actionName);
    return {
      actionId,
      requestOptions: {
        actionId,
        actionName,
      },
    };
  };
}

function createHarness(activeTab: "chat" | "debug" = "chat"): CoreDataLoadersTestHarness {
  const actionLog: string[] = [];
  const capabilityServerClient = new CapabilityServerClient();
  const debugServerClient = new DebugServerClient();
  const threadListStateController = createThreadListStateController();
  const debugWorkspaceDataReader = new DebugWorkspaceDataReader(debugServerClient);
  const setHealthMock = vi.fn<(value: SetStateAction<CapabilityHealthResponse | null>) => void>();

  const input: UseCoreDataLoadersInput = {
    debugHistoryLimit: 120,
    debugErrorListLimit: 120,
    threadListLimit: 50,
    threadListMaxPages: 1,
    archivedThreadListMaxPages: 1,
    capabilityServerClient,
    capabilitySnapshotCache: new CapabilitySnapshotCache<CoreDataCapabilitySnapshot>(
      CAPABILITY_SNAPSHOT_REFRESH_INTERVAL_MILLISECONDS,
    ),
    threadListStateController,
    debugServerClient,
    debugWorkspaceDataReader,
    debugWorkspaceStateStore: new DebugWorkspaceStateStore(),
    coreDataRefreshConcurrencyCoordinator: new CoreDataRefreshConcurrencyCoordinator(),
    selectedThreadIdRef: { current: "thread-1" },
    activeTabRef: { current: activeTab },
    unreadThreadIdsRef: { current: {} },
    debugErrorsSignatureRef: { current: [] },
    modesSignatureRef: { current: [] },
    modelsSignatureRef: { current: [] },
    hasHydratedAgentSelectionRef: { current: false },
    isArchivedThreadsOpenRef: { current: false },
    hasLoadedArchivedThreadsRef: { current: false },
    lastCoreRefreshAtRef: { current: 0 },
    setHealth: setHealthMock,
    setThreads: createNoopStateSetter(),
    setUnreadThreadIds: createNoopStateSetter(),
    setModes: createNoopStateSetter(),
    setModels: createNoopStateSetter(),
    setConfigDefaults: createNoopStateSetter(),
    setTraceStatus: createNoopStateSetter(),
    setHistory: createNoopStateSetter(),
    setDebugErrors: createNoopStateSetter(),
    setDebugErrorSessionId: createNoopStateSetter(),
    setDebugErrorSessionLogPath: createNoopStateSetter(),
    setAgentDescriptors: createNoopStateSetter(),
    setSelectedAgentId: createNoopStateSetter<AgentId>(),
    setSelectedThreadId: createNoopStateSetter(),
    setSelectedModeKey: createNoopStateSetter(),
    setIsArchivedThreadsLoading: createNoopStateSetter(),
    setArchivedThreads: createNoopStateSetter(),
    setArchivedThreadsTruncated: createNoopStateSetter(),
    setHasLoadedArchivedThreads: createNoopStateSetter(),
    ensureApiSessionBootstrapped: vi.fn(async () => true),
    buildActionRequestOptions: createActionRequestBuilder(actionLog),
    readInitialModeKey: (modes) => modes[0]?.mode ?? "default",
    handleRuntimeRequestError: vi.fn(),
  };

  return {
    input,
    capabilityServerClient,
    threadListStateController,
    setHealthMock,
    actionLog,
  };
}

function CoreDataLoadersHarness(properties: CoreDataLoadersHarnessProperties): React.JSX.Element {
  const loaders = useCoreDataLoaders(properties.input);
  useEffect(() => {
    properties.onSnapshot(loaders);
  }, [loaders, properties.onSnapshot]);
  return <></>;
}

async function renderHarness(input: UseCoreDataLoadersInput): Promise<CoreDataLoaders> {
  const snapshotReference: { current: CoreDataLoaders | null } = {
    current: null,
  };

  render(
    <CoreDataLoadersHarness
      input={input}
      onSnapshot={(snapshot) => {
        snapshotReference.current = snapshot;
      }}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });

  const snapshot = snapshotReference.current;
  if (!snapshot) {
    throw new Error("Expected core data loaders snapshot to be captured");
  }
  return snapshot;
}

describe("useCoreDataLoaders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
  });

  it("runs deferred startup reads on the next turn after critical thread state is loaded", async () => {
    const harness = createHarness("chat");
    const loadActiveThreadStateSpy = vi
      .spyOn(harness.threadListStateController, "loadActiveThreadState")
      .mockResolvedValue(ACTIVE_THREAD_STATE);
    const readHealthStatusSpy = vi
      .spyOn(harness.capabilityServerClient, "readHealthStatus")
      .mockResolvedValue(HEALTH_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "listAgents").mockResolvedValue(AGENTS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "listCollaborationModes").mockResolvedValue(
      COLLABORATION_MODES_RESPONSE,
    );
    vi.spyOn(harness.capabilityServerClient, "listModels").mockResolvedValue(MODELS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "readConfigDefaults").mockResolvedValue(
      CONFIG_DEFAULTS_RESPONSE,
    );

    const loaders = await renderHarness(harness.input);

    await act(async () => {
      await loaders.loadCoreData();
    });

    expect(loadActiveThreadStateSpy).toHaveBeenCalledTimes(1);
    expect(readHealthStatusSpy).toHaveBeenCalledTimes(0);
    expect(harness.actionLog[0]).toBe(STARTUP_CRITICAL_THREADS_OPERATION);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(readHealthStatusSpy).toHaveBeenCalledTimes(1);
    expect(harness.actionLog).toContain(STARTUP_DEFERRED_HEALTH_OPERATION);
    expect(harness.actionLog).toContain(STARTUP_DEFERRED_AGENTS_OPERATION);
    expect(harness.actionLog).not.toContain(STARTUP_DEFERRED_DEBUG_HISTORY_OPERATION);
  });

  it("drops stale deferred startup completions when a newer startup sequence starts", async () => {
    const harness = createHarness("chat");
    const firstDeferredHealth = createControlledPromise<CapabilityHealthResponse>();
    const queuedHealthResponses: Array<Promise<CapabilityHealthResponse>> = [
      firstDeferredHealth.promise,
      Promise.resolve(HEALTH_RESPONSE),
    ];
    vi.spyOn(harness.threadListStateController, "loadActiveThreadState").mockResolvedValue(
      ACTIVE_THREAD_STATE,
    );
    const readHealthStatusSpy = vi
      .spyOn(harness.capabilityServerClient, "readHealthStatus")
      .mockImplementation(async () => {
        const nextResponse = queuedHealthResponses.shift();
        if (!nextResponse) {
          throw new Error("Expected a queued health response");
        }
        return nextResponse;
      });
    vi.spyOn(harness.capabilityServerClient, "listAgents").mockResolvedValue(AGENTS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "listCollaborationModes").mockResolvedValue(
      COLLABORATION_MODES_RESPONSE,
    );
    vi.spyOn(harness.capabilityServerClient, "listModels").mockResolvedValue(MODELS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "readConfigDefaults").mockResolvedValue(
      CONFIG_DEFAULTS_RESPONSE,
    );

    const loaders = await renderHarness(harness.input);

    await act(async () => {
      await loaders.loadCoreData();
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      await loaders.loadCoreData();
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(readHealthStatusSpy).toHaveBeenCalledTimes(2);
    expect(harness.setHealthMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstDeferredHealth.resolve(HEALTH_RESPONSE);
      await Promise.resolve();
    });

    expect(harness.setHealthMock).toHaveBeenCalledTimes(1);
  });

  it("skips archived-thread refresh during tracked core refresh before archived surface is loaded", async () => {
    const harness = createHarness("chat");
    const loadActiveThreadStateSpy = vi
      .spyOn(harness.threadListStateController, "loadActiveThreadState")
      .mockResolvedValue(ACTIVE_THREAD_STATE);
    const loadArchivedThreadStateSpy = vi
      .spyOn(harness.threadListStateController, "loadArchivedThreadState")
      .mockResolvedValue({
        didChangeArchivedThreads: true,
        nextArchivedThreads: THREADS,
        isTruncated: false,
        loadedFromCache: false,
      });
    vi.spyOn(harness.capabilityServerClient, "readHealthStatus").mockResolvedValue(HEALTH_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "listAgents").mockResolvedValue(AGENTS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "listCollaborationModes").mockResolvedValue(
      COLLABORATION_MODES_RESPONSE,
    );
    vi.spyOn(harness.capabilityServerClient, "listModels").mockResolvedValue(MODELS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "readConfigDefaults").mockResolvedValue(
      CONFIG_DEFAULTS_RESPONSE,
    );

    const loaders = await renderHarness(harness.input);

    await act(async () => {
      await loaders.loadCoreDataTracked();
    });

    expect(loadActiveThreadStateSpy).toHaveBeenCalledTimes(1);
    expect(loadArchivedThreadStateSpy).toHaveBeenCalledTimes(0);
    expect(harness.input.lastCoreRefreshAtRef.current).toBeGreaterThan(0);
  });

  it("refreshes archived threads during tracked core refresh after archived surface is loaded", async () => {
    const harness = createHarness("chat");
    harness.input.hasLoadedArchivedThreadsRef.current = true;
    const loadActiveThreadStateSpy = vi
      .spyOn(harness.threadListStateController, "loadActiveThreadState")
      .mockResolvedValue(ACTIVE_THREAD_STATE);
    const loadArchivedThreadStateSpy = vi
      .spyOn(harness.threadListStateController, "loadArchivedThreadState")
      .mockResolvedValue({
        didChangeArchivedThreads: true,
        nextArchivedThreads: THREADS,
        isTruncated: false,
        loadedFromCache: false,
      });
    vi.spyOn(harness.capabilityServerClient, "readHealthStatus").mockResolvedValue(HEALTH_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "listAgents").mockResolvedValue(AGENTS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "listCollaborationModes").mockResolvedValue(
      COLLABORATION_MODES_RESPONSE,
    );
    vi.spyOn(harness.capabilityServerClient, "listModels").mockResolvedValue(MODELS_RESPONSE);
    vi.spyOn(harness.capabilityServerClient, "readConfigDefaults").mockResolvedValue(
      CONFIG_DEFAULTS_RESPONSE,
    );

    const loaders = await renderHarness(harness.input);

    await act(async () => {
      await loaders.loadCoreDataTracked();
    });

    expect(loadActiveThreadStateSpy).toHaveBeenCalledTimes(1);
    expect(loadArchivedThreadStateSpy).toHaveBeenCalledTimes(1);
    expect(harness.input.lastCoreRefreshAtRef.current).toBeGreaterThan(0);
  });
});
