import { describe, expect, it, vi } from "vitest";
import { applyCoreDataSnapshotState, type ApplyCoreDataSnapshotStateInput } from "../Source/Application/StateManagement/CoreDataSnapshotStateApplier";
import type {
  CapabilityCollaborationModesResponse,
  CapabilityConfigDefaultsResponse,
  CapabilityModelsResponse
} from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";
import { DebugWorkspaceStateStore } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "../Source/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

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

function createModelDescriptor(displayName: string): CapabilityModelsResponse["data"][number] {
  return {
    id: DEFAULT_MODEL_ID,
    model: DEFAULT_MODEL_ID,
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
  modelDisplayName: string
): {
  modes: CapabilityCollaborationModesResponse;
  models: CapabilityModelsResponse;
  defaults: CapabilityConfigDefaultsResponse | null;
  fetchedAt: number;
} {
  return {
    modes: {
      data: [
        {
          name: DEFAULT_MODE_NAME,
          mode: DEFAULT_MODE_KEY,
          model: DEFAULT_MODEL_ID,
          reasoning_effort: modeReasoningEffort
        }
      ]
    },
    models: {
      data: [createModelDescriptor(modelDisplayName)],
      nextCursor: null
    },
    defaults: null,
    fetchedAt: Date.now()
  };
}

function createHarness() {
  const setModesMock = vi.fn();
  const setModelsMock = vi.fn();
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
    setHistory: vi.fn(),
    setDebugErrors: vi.fn(),
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
    setModelsMock
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
    expect(harness.input.modesSignatureRef.current).toEqual(["default|Balanced|high"]);
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
    expect(harness.input.modesSignatureRef.current).toEqual(["default|Balanced|medium"]);
    expect(harness.input.modelsSignatureRef.current).toEqual(["gpt-5|GPT-5"]);
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
    expect(harness.input.modelsSignatureRef.current).toEqual(["gpt-5|GPT-5 Turbo"]);
  });
});
