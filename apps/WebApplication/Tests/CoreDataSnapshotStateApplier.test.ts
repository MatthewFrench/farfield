import { describe, expect, it, vi } from "vitest";
import type { SetStateAction } from "react";
import { applyCoreDataSnapshotState, type ApplyCoreDataSnapshotStateInput } from "../Source/Application/StateManagement/CoreDataSnapshotStateApplier";
import type {
  CapabilityCollaborationModesResponse,
  CapabilityConfigDefaultsResponse,
  CapabilityModelsResponse
} from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";
import type { DebugWorkspaceDataSnapshot } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "../Source/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
type DebugHistory = DebugWorkspaceDataSnapshot["history"];
type DebugErrorCollection = DebugWorkspaceDataSnapshot["debugErrors"];
type CapabilityModeDescriptor = CapabilityCollaborationModesResponse["data"][number];

const DEFAULT_MODE_KEY = "default";
const DEFAULT_MODE_NAME = "Balanced";
const DEFAULT_MODEL_ID = "gpt-5";
const THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS = 60_000;
const THREAD_QUERY_CACHE_MAXIMUM_ENTRIES = 10;

function createThreadListStateController(): ThreadListStateController {
  return new ThreadListStateController({
    threadServerClient: new ThreadServerClient(),
    threadQueryCache: new ThreadQueryCache(
      THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS,
      THREAD_QUERY_CACHE_MAXIMUM_ENTRIES
    ),
    threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
    threadListStateStore: new ThreadListStateStore(),
    threadListPresentationStateResolver: new ThreadListPresentationStateResolver()
  });
}

function createModelDescriptor(
  displayName: string,
  modelIdentifier = DEFAULT_MODEL_ID
): CapabilityModelsResponse["data"][number] {
  return {
    id: modelIdentifier,
    model: modelIdentifier,
    displayName,
    description: "default model",
    hidden: false,
    isDefault: true,
    defaultReasoningEffort: "medium",
    inputModalities: ["text", "image"],
    supportedReasoningEfforts: [
      {
        reasoningEffort: "low",
        description: "low effort"
      },
      {
        reasoningEffort: "medium",
        description: "medium effort"
      }
    ],
    supportsPersonality: false
  };
}

function createCapabilitiesSnapshot(
  modeReasoningEffort: ReasoningEffort,
  modelDisplayName: string,
  modelIdentifier = DEFAULT_MODEL_ID
): {
  modes: CapabilityCollaborationModesResponse;
  models: CapabilityModelsResponse;
  defaults: CapabilityConfigDefaultsResponse | null;
  fetchedAt: number;
} {
  const modeDescriptor: CapabilityModeDescriptor = {
    name: DEFAULT_MODE_NAME,
    mode: DEFAULT_MODE_KEY,
    model: DEFAULT_MODEL_ID,
    reasoning_effort: modeReasoningEffort
  };
  return createCapabilitiesSnapshotFromMode(modeDescriptor, modelDisplayName, modelIdentifier);
}

function createCapabilitiesSnapshotFromMode(
  modeDescriptor: CapabilityModeDescriptor,
  modelDisplayName: string,
  modelIdentifier = DEFAULT_MODEL_ID
): {
  modes: CapabilityCollaborationModesResponse;
  models: CapabilityModelsResponse;
  defaults: CapabilityConfigDefaultsResponse | null;
  fetchedAt: number;
} {
  return {
    modes: {
      data: [modeDescriptor]
    },
    models: {
      data: [createModelDescriptor(modelDisplayName, modelIdentifier)],
      nextCursor: null
    },
    defaults: null,
    fetchedAt: Date.now()
  };
}

function createDebugHistoryEntry(entryId: string): DebugHistory[number] {
  return {
    id: entryId,
    at: "2026-02-26T00:00:00.000Z",
    source: "app",
    direction: "in",
    payload: {},
    meta: {}
  };
}

function createDebugHistoryCollection(entryCount: number): DebugHistory {
  return Array.from({ length: entryCount }, (_value, index) =>
    createDebugHistoryEntry(`history-${String(index)}`)
  );
}

function createDebugErrorEntry(input: {
  errorId: string;
  message: string;
  recordedAt: string;
}): DebugErrorCollection[number] {
  return {
    errorId: input.errorId,
    sessionId: "session-1",
    origin: "client",
    source: "farfield-web",
    operation: "debug-read",
    message: input.message,
    severity: "error",
    name: null,
    stack: null,
    requestId: null,
    threadId: null,
    url: null,
    occurredAt: input.recordedAt,
    recordedAt: input.recordedAt,
    details: {}
  };
}

function createDebugWorkspaceSnapshot(input: {
  history: DebugHistory;
  debugErrors?: DebugErrorCollection;
  debugErrorsSignature?: string[];
  debugErrorSessionId?: string;
  debugErrorSessionLogPath?: string;
}): DebugWorkspaceDataSnapshot {
  return {
    history: input.history,
    debugErrors: input.debugErrors ?? [],
    debugErrorSessionId: input.debugErrorSessionId ?? "session-1",
    debugErrorSessionLogPath: input.debugErrorSessionLogPath ?? "/tmp/session-1.ndjson",
    debugErrorsSignature: input.debugErrorsSignature ?? []
  };
}

function createHarness() {
  const setModesMock = vi.fn();
  const setModelsMock = vi.fn();
  const setHistoryMock = vi.fn<(value: SetStateAction<DebugHistory>) => void>();
  const setDebugErrorsMock = vi.fn();
  const input: ApplyCoreDataSnapshotStateInput = {
    debugWorkspaceStateStore: new DebugWorkspaceStateStore(),
    threadListStateController: createThreadListStateController(),
    debugErrorsSignatureRef: { current: [] },
    modesSignatureRef: { current: [] },
    modelsSignatureRef: { current: [] },
    hasHydratedAgentSelectionRef: { current: false },
    setHealth: vi.fn(),
    setThreads: vi.fn(),
    setUnreadThreadIds: vi.fn(),
    setModes: setModesMock,
    setModels: setModelsMock,
    setConfigDefaults: vi.fn(),
    setTraceStatus: vi.fn(),
    setHistory: setHistoryMock,
    setDebugErrors: setDebugErrorsMock,
    setDebugErrorSessionId: vi.fn(),
    setDebugErrorSessionLogPath: vi.fn(),
    setAgentDescriptors: vi.fn(),
    setSelectedAgentId: vi.fn(),
    setSelectedThreadId: vi.fn(),
    setSelectedModeKey: vi.fn(),
    readInitialModeKey: () => DEFAULT_MODE_KEY
  };

  return {
    input,
    setModesMock,
    setModelsMock,
    setHistoryMock,
    setDebugErrorsMock
  };
}

describe("CoreDataSnapshotStateApplier", () => {
  it("updates modes when reasoning effort changes", () => {
    const harness = createHarness();

    harness.input.nextCapabilities = createCapabilitiesSnapshot("medium", "GPT-5");
    applyCoreDataSnapshotState(harness.input);

    harness.setModesMock.mockClear();
    harness.setModelsMock.mockClear();

    const changedSnapshot = createCapabilitiesSnapshot("high", "GPT-5");
    harness.input.nextCapabilities = changedSnapshot;
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setModesMock).toHaveBeenCalledTimes(1);
    expect(harness.setModesMock).toHaveBeenCalledWith(changedSnapshot.modes.data);
    expect(harness.setModelsMock).not.toHaveBeenCalled();
    expect(harness.input.modesSignatureRef.current).toEqual([
      "default|Balanced|high"
    ]);
  });

  it("does not update modes or models when signatures are unchanged", () => {
    const harness = createHarness();

    harness.input.nextCapabilities = createCapabilitiesSnapshot("medium", "GPT-5");
    applyCoreDataSnapshotState(harness.input);

    harness.setModesMock.mockClear();
    harness.setModelsMock.mockClear();

    harness.input.nextCapabilities = createCapabilitiesSnapshot("medium", "GPT-5");
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setModesMock).not.toHaveBeenCalled();
    expect(harness.setModelsMock).not.toHaveBeenCalled();
    expect(harness.input.modesSignatureRef.current).toEqual([
      "default|Balanced|medium"
    ]);
    expect(harness.input.modelsSignatureRef.current).toEqual([
      "gpt-5|GPT-5"
    ]);
  });

  it("updates models when model display name changes", () => {
    const harness = createHarness();

    harness.input.nextCapabilities = createCapabilitiesSnapshot("medium", "GPT-5");
    applyCoreDataSnapshotState(harness.input);

    harness.setModesMock.mockClear();
    harness.setModelsMock.mockClear();

    const changedSnapshot = createCapabilitiesSnapshot("medium", "GPT-5 Turbo");
    harness.input.nextCapabilities = changedSnapshot;
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setModelsMock).toHaveBeenCalledTimes(1);
    expect(harness.setModelsMock).toHaveBeenCalledWith(changedSnapshot.models.data);
    expect(harness.setModesMock).not.toHaveBeenCalled();
    expect(harness.input.modelsSignatureRef.current).toEqual([
      "gpt-5|GPT-5 Turbo"
    ]);
  });

  it("updates models when model identifier changes", () => {
    const harness = createHarness();

    harness.input.nextCapabilities = createCapabilitiesSnapshot("medium", "GPT-5");
    applyCoreDataSnapshotState(harness.input);

    harness.setModesMock.mockClear();
    harness.setModelsMock.mockClear();

    const changedSnapshot = createCapabilitiesSnapshot("medium", "GPT-5", "gpt-5-pro");
    harness.input.nextCapabilities = changedSnapshot;
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setModelsMock).toHaveBeenCalledTimes(1);
    expect(harness.setModelsMock).toHaveBeenCalledWith(changedSnapshot.models.data);
    expect(harness.setModesMock).not.toHaveBeenCalled();
    expect(harness.input.modelsSignatureRef.current).toEqual([
      "gpt-5-pro|GPT-5"
    ]);
  });

  it("normalizes null and omitted mode signature segments to the same signature", () => {
    const harness = createHarness();
    const nullSegmentMode: CapabilityModeDescriptor = {
      name: DEFAULT_MODE_NAME,
      mode: null,
      model: DEFAULT_MODEL_ID,
      reasoning_effort: null
    };

    harness.input.nextCapabilities = createCapabilitiesSnapshotFromMode(nullSegmentMode, "GPT-5");
    applyCoreDataSnapshotState(harness.input);

    harness.setModesMock.mockClear();
    harness.setModelsMock.mockClear();

    const omittedSegmentMode: CapabilityModeDescriptor = {
      name: DEFAULT_MODE_NAME,
      model: DEFAULT_MODEL_ID
    };
    harness.input.nextCapabilities = createCapabilitiesSnapshotFromMode(omittedSegmentMode, "GPT-5");
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setModesMock).not.toHaveBeenCalled();
    expect(harness.setModelsMock).not.toHaveBeenCalled();
    expect(harness.input.modesSignatureRef.current).toEqual([
      "|Balanced|"
    ]);
  });

  it("does not apply debug errors when debug-error signature is unchanged", () => {
    const harness = createHarness();
    const firstDebugError = createDebugErrorEntry({
      errorId: "error-1",
      message: "first failure",
      recordedAt: "2026-02-26T00:00:01.000Z"
    });
    const signature = ["error-1|2026-02-26T00:00:01.000Z|first failure"];

    harness.input.debugWorkspaceData = createDebugWorkspaceSnapshot({
      history: [],
      debugErrors: [firstDebugError],
      debugErrorsSignature: signature
    });
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setDebugErrorsMock).toHaveBeenCalledTimes(1);
    expect(harness.setDebugErrorsMock).toHaveBeenCalledWith([firstDebugError]);
    harness.setDebugErrorsMock.mockClear();

    const replacedDebugError = createDebugErrorEntry({
      errorId: "error-1",
      message: "second failure with reused signature",
      recordedAt: "2026-02-26T00:00:02.000Z"
    });
    harness.input.debugWorkspaceData = createDebugWorkspaceSnapshot({
      history: [],
      debugErrors: [replacedDebugError],
      debugErrorsSignature: signature
    });
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setDebugErrorsMock).not.toHaveBeenCalled();
    expect(harness.input.debugErrorsSignatureRef.current).toEqual(signature);
  });

  it("applies debug errors when debug-error signature changes", () => {
    const harness = createHarness();
    const firstDebugError = createDebugErrorEntry({
      errorId: "error-1",
      message: "first failure",
      recordedAt: "2026-02-26T00:00:01.000Z"
    });

    harness.input.debugWorkspaceData = createDebugWorkspaceSnapshot({
      history: [],
      debugErrors: [firstDebugError],
      debugErrorsSignature: ["error-1|2026-02-26T00:00:01.000Z|first failure"]
    });
    applyCoreDataSnapshotState(harness.input);
    harness.setDebugErrorsMock.mockClear();

    const secondDebugError = createDebugErrorEntry({
      errorId: "error-2",
      message: "second failure",
      recordedAt: "2026-02-26T00:00:03.000Z"
    });
    const nextSignature = ["error-2|2026-02-26T00:00:03.000Z|second failure"];
    harness.input.debugWorkspaceData = createDebugWorkspaceSnapshot({
      history: [],
      debugErrors: [secondDebugError],
      debugErrorsSignature: nextSignature
    });
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setDebugErrorsMock).toHaveBeenCalledTimes(1);
    expect(harness.setDebugErrorsMock).toHaveBeenCalledWith([secondDebugError]);
    expect(harness.input.debugErrorsSignatureRef.current).toEqual(nextSignature);
  });

  it("reuses previous large history when debug snapshot boundaries match", () => {
    const harness = createHarness();
    const previousHistory = createDebugHistoryCollection(2_000);
    const incomingHistory = createDebugHistoryCollection(2_000);
    incomingHistory[1_000] = createDebugHistoryEntry("history-middle-updated");

    harness.input.debugWorkspaceData = createDebugWorkspaceSnapshot({ history: incomingHistory });
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setHistoryMock).toHaveBeenCalledTimes(1);
    const updateAction = harness.setHistoryMock.mock.calls[0]?.[0];
    if (!updateAction) {
      throw new Error("Expected history state updater");
    }
    const applyHistoryUpdate = updateAction as (previousEntries: DebugHistory) => DebugHistory;
    const mergedHistory = applyHistoryUpdate(previousHistory);

    expect(mergedHistory).toBe(previousHistory);
  });

  it("applies incoming large history when debug snapshot tail identifier changes", () => {
    const harness = createHarness();
    const previousHistory = createDebugHistoryCollection(2_000);
    const incomingHistory = createDebugHistoryCollection(2_000);
    incomingHistory[1_999] = createDebugHistoryEntry("history-tail-updated");

    harness.input.debugWorkspaceData = createDebugWorkspaceSnapshot({ history: incomingHistory });
    applyCoreDataSnapshotState(harness.input);

    expect(harness.setHistoryMock).toHaveBeenCalledTimes(1);
    const updateAction = harness.setHistoryMock.mock.calls[0]?.[0];
    if (!updateAction) {
      throw new Error("Expected history state updater");
    }
    const applyHistoryUpdate = updateAction as (previousEntries: DebugHistory) => DebugHistory;
    const mergedHistory = applyHistoryUpdate(previousHistory);

    expect(mergedHistory).toBe(incomingHistory);
  });
});
