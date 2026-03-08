import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useApplicationDerivedState } from "../Source/Application/StateManagement/UseApplicationDerivedState";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "../Source/Application/StateManagement/UseApplicationDerivedStateContracts";
import {
  type CapabilityAgentsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityModelsResponse,
} from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
} from "../Source/Features/Chat/DataAccess/ChatServerClient";
import {
  ConversationItemFlattener,
  type ConversationTurn,
} from "../Source/Features/Chat/DomainModel/ConversationItemFlattener";
import { ConversationSyncSignatureBuilder } from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { PendingUserInputRequestSelector } from "../Source/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { DebugIssueStateResolver } from "../Source/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { type DebugIssueDerivationResult } from "../Source/Features/Debugging/StateManagement/DebugIssueDerivationWorkerContracts";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { type ThreadListItem } from "../Source/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ThreadListPresentationStateInput,
  ThreadListPresentationStateResolver,
} from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "../Source/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

const THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS = 60_000;
const THREAD_QUERY_CACHE_MAXIMUM_ENTRIES = 10;

interface HarnessProperties {
  input: UseApplicationDerivedStateInput;
  onDerivedState: (derivedState: ApplicationDerivedState) => void;
}

interface ConversationStateInput {
  threadIdentifier: string;
  turns: ConversationTurn[];
  latestModel: string;
  latestReasoningEffort: string;
}

interface DeferredPromise<ResolvedType> {
  promise: Promise<ResolvedType>;
  resolve: (value: ResolvedType) => void;
  reject: (error: Error) => void;
}

interface ThreadListPresentationRequestRecord {
  deferredPromise: DeferredPromise<ApplicationDerivedState["threadListPresentationState"]>;
}

interface DebugIssueDerivationRequestRecord {
  deferredPromise: DeferredPromise<DebugIssueDerivationResult>;
}

class TestThreadListPresentationWorkerOwner {
  private readonly requestRecords: ThreadListPresentationRequestRecord[] = [];

  public readState(
    _input: ThreadListPresentationStateInput,
  ): Promise<ApplicationDerivedState["threadListPresentationState"]> {
    const deferredPromise =
      createDeferredPromise<ApplicationDerivedState["threadListPresentationState"]>();
    this.requestRecords.push({
      deferredPromise,
    });
    return deferredPromise.promise;
  }

  public dispose(): void {}

  public resolveRequestByIndex(
    requestIndex: number,
    value: ApplicationDerivedState["threadListPresentationState"],
  ): void {
    const requestRecord = this.requestRecords[requestIndex];
    if (!requestRecord) {
      throw new Error(`Missing thread-list worker request at index ${String(requestIndex)}`);
    }
    requestRecord.deferredPromise.resolve(value);
  }
}

class TestDebugIssueDerivationWorkerOwner {
  private readonly requestRecords: DebugIssueDerivationRequestRecord[] = [];

  public readDerivedDebugIssueState(_input: {
    debugErrors: UseApplicationDerivedStateInput["debugErrors"];
    historyEntries: UseApplicationDerivedStateInput["history"];
    severityFilter: UseApplicationDerivedStateInput["debugIssueSeverityFilter"];
    filterQuery: string;
    selectedIssueIdentifier: string;
  }): Promise<DebugIssueDerivationResult> {
    const deferredPromise = createDeferredPromise<DebugIssueDerivationResult>();
    this.requestRecords.push({
      deferredPromise,
    });
    return deferredPromise.promise;
  }

  public dispose(): void {}

  public resolveRequestByIndex(requestIndex: number, value: DebugIssueDerivationResult): void {
    const requestRecord = this.requestRecords[requestIndex];
    if (!requestRecord) {
      throw new Error(`Missing debug-issue worker request at index ${String(requestIndex)}`);
    }
    requestRecord.deferredPromise.resolve(value);
  }
}

function createDeferredPromise<ResolvedType>(): DeferredPromise<ResolvedType> {
  let resolve: ((value: ResolvedType) => void) | null = null;
  let reject: ((error: Error) => void) | null = null;
  const promise = new Promise<ResolvedType>((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  if (resolve === null || reject === null) {
    throw new Error("Expected deferred promise handlers to initialize.");
  }
  return {
    promise,
    resolve,
    reject,
  };
}

function buildThreadListPresentationState(
  activeProjectGroupKey: string,
): ApplicationDerivedState["threadListPresentationState"] {
  return {
    selectedThread: null,
    activeProjectGroups: [
      {
        key: activeProjectGroupKey,
        label: activeProjectGroupKey,
        projectPath: `/workspace/${activeProjectGroupKey}`,
        projectCreatedAt: 1,
        latestUpdatedAt: 1,
        isRemoved: false,
        threads: [],
      },
    ],
    archivedProjectGroups: [],
    archivedThreadIdentifiers: new Set<string>(),
    archivedSectionThreadCount: 0,
  };
}

function readDebugIssueDerivationResult(
  resolver: DebugIssueStateResolver,
  input: {
    debugErrors: UseApplicationDerivedStateInput["debugErrors"];
    history: UseApplicationDerivedStateInput["history"];
    severityFilter: UseApplicationDerivedStateInput["debugIssueSeverityFilter"];
    filterQuery: string;
    selectedIssueIdentifier: string;
  },
): DebugIssueDerivationResult {
  const debugErrorIssues = resolver.readDebugErrorIssues(input.debugErrors);
  const debugWarningIssues = resolver.readDebugWarningIssues(input.history);
  const debugIssues = resolver.readCombinedDebugIssues({
    debugErrorIssues,
    debugWarningIssues,
  });
  const filteredDebugIssues = resolver.readFilteredDebugIssues({
    debugIssues,
    severityFilter: input.severityFilter,
    filterQuery: input.filterQuery,
  });
  return {
    debugErrorIssues,
    debugWarningIssues,
    debugIssues,
    runtimeRequestErrorOperationMetrics: resolver.readRuntimeRequestErrorOperationMetrics(
      input.debugErrors,
    ),
    filteredDebugIssues,
    selectedDebugIssue: resolver.readSelectedDebugIssue({
      debugIssues: filteredDebugIssues,
      selectedIssueIdentifier: input.selectedIssueIdentifier,
    }),
  };
}

/**
 * Direct owner-level tests for useApplicationDerivedState.
 * These tests keep scope on derivation behavior and avoid coupling to shell composition wiring.
 */
function Harness(properties: HarnessProperties): React.JSX.Element {
  const derivedState = useApplicationDerivedState(properties.input);
  properties.onDerivedState(derivedState);
  return <div data-testid="use-application-derived-state-harness" />;
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

function buildThreadListItem(
  threadIdentifier: string,
  agentIdentifier: ThreadListItem["agentId"] = "codex",
): ThreadListItem {
  return {
    id: threadIdentifier,
    preview: "",
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    agentId: agentIdentifier,
    hasUnreadTurn: null,
    isProjectRemoved: false,
  };
}

function buildAgentMessageTurn(turnIdentifier: string, text: string): ConversationTurn {
  return {
    id: turnIdentifier,
    status: "completed",
    items: [
      {
        id: `item-${turnIdentifier}`,
        type: "agentMessage",
        text,
      },
    ],
  };
}

function buildCommandExecutionTurn(
  turnIdentifier: string,
  commandStatus: "inProgress" | "completed",
  processIdentifier: string,
): ConversationTurn {
  return {
    id: turnIdentifier,
    status: commandStatus,
    items: [
      {
        id: `command-${turnIdentifier}`,
        type: "commandExecution",
        command: "npm run dev",
        processId: processIdentifier,
        status: commandStatus,
      },
    ],
  };
}

function buildConversationState(
  input: ConversationStateInput,
): NonNullable<ChatLiveStateResponse["conversationState"]> {
  return {
    id: input.threadIdentifier,
    turns: input.turns,
    requests: [],
    updatedAt: 1_700_000_000,
    latestModel: input.latestModel,
    latestReasoningEffort: input.latestReasoningEffort,
    latestCollaborationMode: {
      mode: "default",
      settings: {
        model: input.latestModel,
        reasoning_effort: input.latestReasoningEffort,
        developer_instructions: null,
      },
    },
  };
}

function buildReadThreadSnapshot(input: ConversationStateInput): ChatReadThreadResponse {
  return {
    ok: true,
    thread: buildConversationState(input),
    agentId: "codex",
  };
}

function buildDebugErrorRecord(input: {
  errorId: string;
  operation: string;
  message: string;
  actionName?: string;
}): NonNullable<UseApplicationDerivedStateInput["debugErrors"]>[number] {
  return {
    errorId: input.errorId,
    sessionId: "session-1",
    origin: "client",
    source: "farfield-web",
    operation: input.operation,
    message: input.message,
    severity: "error",
    name: null,
    stack: null,
    requestId: null,
    threadId: null,
    url: "/",
    occurredAt: "2025-01-01T10:00:00.000Z",
    recordedAt: "2025-01-01T10:00:00.000Z",
    details: input.actionName
      ? {
          actionName: input.actionName,
        }
      : {},
  };
}

function buildAgentDescriptorsFixture(): CapabilityAgentsResponse["agents"] {
  return [
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
    {
      id: "opencode",
      label: "OpenCode",
      enabled: true,
      connected: true,
      capabilities: {
        canListModels: false,
        canListCollaborationModes: false,
        canReadConfigRequirements: false,
        canListExperimentalFeatures: false,
        canListMcpServerStatuses: false,
        canListApps: false,
        canListSkills: false,
        canReadAccount: false,
        canReadAccountRateLimits: false,
        canSearchFuzzyFiles: false,
        canExecuteCommand: false,
        canStartAccountLogin: false,
        canCancelAccountLogin: false,
        canLogoutAccount: false,
        canReloadMcpServerConfig: false,
        canStartMcpServerOauthLogin: false,
        canWriteConfigValue: false,
        canWriteSkillsConfig: false,
        canDetectExternalAgentConfig: false,
        canImportExternalAgentConfig: false,
        canStartThreadRealtime: false,
        canAppendThreadRealtimeAudio: false,
        canAppendThreadRealtimeText: false,
        canStopThreadRealtime: false,
        canStartWindowsSandboxSetup: false,
        canSetCollaborationMode: false,
        canSubmitUserInput: false,
        canReadLiveState: false,
        canReadStreamEvents: false,

        canReadNotificationEvents: false,
      },
      projectDirectories: [],
    },
  ];
}

function createBaseInput(): UseApplicationDerivedStateInput {
  const modeSelectionStateResolver = new ModeSelectionStateResolver();

  const modes: CapabilityCollaborationModesResponse["data"] = [
    {
      name: "Default",
      mode: "default",
      model: null,
      reasoning_effort: "medium",
      developer_instructions: null,
    },
    {
      name: "Plan",
      mode: "plan",
      model: null,
      reasoning_effort: "medium",
      developer_instructions: null,
    },
  ];

  const models: CapabilityModelsResponse["data"] = [
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
      inputModalities: ["text"],
      supportsPersonality: false,
    },
  ];

  const configDefaults: CapabilityConfigDefaultsResponse = {
    ok: true,
    agentId: "codex",
    model: "gpt-5",
    reasoningEffort: "medium",
  };

  return {
    threads: [],
    archivedThreads: [],
    selectedThreadId: null,
    selectedRequestId: null,
    selectedAgentId: "codex",
    selectedModeKey: "default",
    selectedModelId: "",
    selectedReasoningEffort: "",
    visibleChatItemLimit: 20,
    isCoreLoading: false,
    isSelectedThreadLoading: false,
    debugIssueSeverityFilter: "all",
    debugIssueFilterQuery: "",
    selectedDebugIssueId: "",
    health: null,
    configDefaults,
    liveState: null,
    readThreadState: null,
    modes,
    models,
    agentDescriptors: buildAgentDescriptorsFixture(),
    history: [],
    historyDetail: null,
    debugErrors: [],
    traceStatus: null,
    errorMessage: "",
    defaultEffortOptions: ["medium", "low"],
    assumedAppDefaultModelIdentifier: "gpt-5",
    assumedAppDefaultReasoningEffort: "medium",
    modeSelectionStateResolver,
    conversationSyncSignatureBuilder: new ConversationSyncSignatureBuilder(
      modeSelectionStateResolver,
    ),
    pendingUserInputRequestSelector: new PendingUserInputRequestSelector(),
    conversationItemFlattener: new ConversationItemFlattener(),
    debugIssueStateResolver: new DebugIssueStateResolver(),
    threadListStateController: createThreadListStateController(),
  };
}

function renderDerivedState(input: UseApplicationDerivedStateInput): ApplicationDerivedState {
  const snapshotReference: { current: ApplicationDerivedState | null } = {
    current: null,
  };

  render(
    <Harness
      input={input}
      onDerivedState={(derivedState) => {
        snapshotReference.current = derivedState;
      }}
    />,
  );

  const snapshot = snapshotReference.current;
  if (!snapshot) {
    throw new Error("Expected application derived state snapshot to be captured");
  }
  return snapshot;
}

function renderDerivedStateHarness(input: UseApplicationDerivedStateInput): {
  readLatestDerivedState: () => ApplicationDerivedState;
  rerender: (nextInput: UseApplicationDerivedStateInput) => void;
} {
  const snapshotReference: { current: ApplicationDerivedState | null } = {
    current: null,
  };
  const renderResult = render(
    <Harness
      input={input}
      onDerivedState={(derivedState) => {
        snapshotReference.current = derivedState;
      }}
    />,
  );

  return {
    readLatestDerivedState: () => {
      const snapshot = snapshotReference.current;
      if (!snapshot) {
        throw new Error("Expected application derived state snapshot to be captured");
      }
      return snapshot;
    },
    rerender: (nextInput: UseApplicationDerivedStateInput) => {
      renderResult.rerender(
        <Harness
          input={nextInput}
          onDerivedState={(derivedState) => {
            snapshotReference.current = derivedState;
          }}
        />,
      );
    },
  };
}

describe("useApplicationDerivedState", () => {
  afterEach(() => {
    cleanup();
  });

  it("derives mode and effort options from defaults, modes, conversation, and selection state", () => {
    const input: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      selectedModeKey: "plan",
      selectedReasoningEffort: "none",
      modes: [
        {
          name: "Default",
          mode: "default",
          model: null,
          reasoning_effort: "high",
          developer_instructions: null,
        },
        {
          name: "Plan",
          mode: "plan",
          model: null,
          reasoning_effort: "minimal",
          developer_instructions: null,
        },
      ],
      readThreadState: buildReadThreadSnapshot({
        threadIdentifier: "thread-1",
        turns: [buildAgentMessageTurn("turn-1", "hello")],
        latestModel: "gpt-5",
        latestReasoningEffort: "xhigh",
      }),
    };

    const derivedState = renderDerivedState(input);

    expect(derivedState.planModeOption?.mode).toBe("plan");
    expect(derivedState.defaultModeOption?.mode).toBe("default");
    expect(derivedState.isPlanModeEnabled).toBe(true);
    expect(derivedState.effortOptions).toEqual([
      "medium",
      "low",
      "high",
      "minimal",
      "xhigh",
      "none",
    ]);
    expect(derivedState.effortOptionsWithoutAssumedDefault).toEqual([
      "low",
      "high",
      "minimal",
      "xhigh",
      "none",
    ]);
  });

  it("uses selected-thread agent ownership when deriving active-agent capabilities", () => {
    const input: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      selectedAgentId: "opencode",
      selectedThreadId: "thread-codex",
      threads: [buildThreadListItem("thread-codex", "codex")],
    };

    const derivedState = renderDerivedState(input);

    expect(derivedState.selectedAgentLabel).toBe("OpenCode");
    expect(derivedState.activeThreadAgentId).toBe("codex");
    expect(derivedState.activeAgentLabel).toBe("Codex");
    expect(derivedState.canSubmitUserInputForActiveAgent).toBe(true);
    expect(derivedState.canListModels).toBe(true);
    expect(derivedState.codexConfigured).toBe(true);
    expect(derivedState.openCodeConnected).toBe(true);
  });

  it("derives hidden conversation ranges when the visible limit is smaller than rendered items", () => {
    const input: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      visibleChatItemLimit: 2,
      readThreadState: buildReadThreadSnapshot({
        threadIdentifier: "thread-1",
        turns: [
          buildAgentMessageTurn("turn-1", "one"),
          buildAgentMessageTurn("turn-2", "two"),
          buildAgentMessageTurn("turn-3", "three"),
        ],
        latestModel: "gpt-5",
        latestReasoningEffort: "medium",
      }),
    };

    const derivedState = renderDerivedState(input);

    expect(derivedState.conversationItemCount).toBe(3);
    expect(derivedState.firstVisibleChatItemIndex).toBe(1);
    expect(derivedState.hasHiddenChatItems).toBe(true);
    expect(derivedState.visibleConversationItems.map((item) => item.key)).toEqual([
      "item-turn-2",
      "item-turn-3",
    ]);
  });

  it("clamps the first visible chat item index to zero when all items fit", () => {
    const input: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      visibleChatItemLimit: 20,
      readThreadState: buildReadThreadSnapshot({
        threadIdentifier: "thread-1",
        turns: [buildAgentMessageTurn("turn-1", "one"), buildAgentMessageTurn("turn-2", "two")],
        latestModel: "gpt-5",
        latestReasoningEffort: "medium",
      }),
    };

    const derivedState = renderDerivedState(input);

    expect(derivedState.conversationItemCount).toBe(2);
    expect(derivedState.firstVisibleChatItemIndex).toBe(0);
    expect(derivedState.hasHiddenChatItems).toBe(false);
    expect(derivedState.visibleConversationItems.map((item) => item.key)).toEqual([
      "item-turn-1",
      "item-turn-2",
    ]);
  });

  it("derives runtime-request-error operation metrics from debug errors", () => {
    const input: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      debugErrors: [
        buildDebugErrorRecord({
          errorId: "error-1",
          operation: "runtime-request-error",
          message: "Request failed for /api/threads",
        }),
        buildDebugErrorRecord({
          errorId: "error-2",
          operation: "runtime-request-error",
          message: "Request failed for /api/threads",
        }),
        buildDebugErrorRecord({
          errorId: "error-3",
          operation: "runtime-request-error",
          message: "Unexpected response",
          actionName: "startup-critical.threads.active",
        }),
      ],
    };

    const derivedState = renderDerivedState(input);

    expect(derivedState.runtimeRequestErrorOperationMetrics).toEqual([
      {
        operation: "request-path:/api/threads",
        count: 2,
      },
      {
        operation: "startup-critical.threads.active",
        count: 1,
      },
    ]);
  });

  it("derives running terminal count from in-progress command executions", () => {
    const input: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      readThreadState: buildReadThreadSnapshot({
        threadIdentifier: "thread-1",
        turns: [
          buildCommandExecutionTurn("turn-1", "inProgress", "pty-1"),
          buildCommandExecutionTurn("turn-2", "completed", "pty-2"),
        ],
        latestModel: "gpt-5",
        latestReasoningEffort: "medium",
      }),
    };

    const derivedState = renderDerivedState(input);

    expect(derivedState.runningTerminalCount).toBe(1);
  });

  it("keeps the newest thread-list worker projection when an older response resolves later", async () => {
    const threadListWorkerOwner = new TestThreadListPresentationWorkerOwner();
    const firstInput: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      threads: [buildThreadListItem("thread-first")],
      selectedThreadId: "thread-first",
      threadListPresentationWorkerOwner: threadListWorkerOwner,
    };
    const snapshotReference: { current: ApplicationDerivedState | null } = {
      current: null,
    };
    const { rerender } = render(
      <Harness
        input={firstInput}
        onDerivedState={(derivedState) => {
          snapshotReference.current = derivedState;
        }}
      />,
    );

    const secondInput: UseApplicationDerivedStateInput = {
      ...firstInput,
      threads: [buildThreadListItem("thread-second")],
      selectedThreadId: "thread-second",
    };
    rerender(
      <Harness
        input={secondInput}
        onDerivedState={(derivedState) => {
          snapshotReference.current = derivedState;
        }}
      />,
    );

    await act(async () => {
      threadListWorkerOwner.resolveRequestByIndex(
        1,
        buildThreadListPresentationState("new-project"),
      );
      await Promise.resolve();
    });

    expect(snapshotReference.current?.activeProjectGroups[0]?.key).toBe("new-project");

    await act(async () => {
      threadListWorkerOwner.resolveRequestByIndex(
        0,
        buildThreadListPresentationState("old-project"),
      );
      await Promise.resolve();
    });

    expect(snapshotReference.current?.activeProjectGroups[0]?.key).toBe("new-project");
  });

  it("exposes immediate thread-list presentation state before worker projection resolves", async () => {
    const threadListWorkerOwner = new TestThreadListPresentationWorkerOwner();
    const input: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      threads: [
        {
          ...buildThreadListItem("thread-immediate"),
          cwd: "/workspace/immediate",
          path: "/workspace/immediate",
        },
      ],
      selectedThreadId: "thread-immediate",
      threadListPresentationWorkerOwner: threadListWorkerOwner,
    };
    const snapshotReference: { current: ApplicationDerivedState | null } = {
      current: null,
    };

    render(
      <Harness
        input={input}
        onDerivedState={(derivedState) => {
          snapshotReference.current = derivedState;
        }}
      />,
    );

    expect(snapshotReference.current?.activeProjectGroups.length).toBeGreaterThan(0);
    expect(snapshotReference.current?.selectedThread?.id).toBe("thread-immediate");
  });

  it("keeps the newest debug-issue projection when an older response resolves later", async () => {
    const debugIssueStateResolver = new DebugIssueStateResolver();
    const debugIssueDerivationWorkerOwner = new TestDebugIssueDerivationWorkerOwner();
    const firstDebugError = buildDebugErrorRecord({
      errorId: "error-first",
      operation: "runtime-request-error",
      message: "first error",
    });
    const secondDebugError = buildDebugErrorRecord({
      errorId: "error-second",
      operation: "runtime-request-error",
      message: "second error",
    });
    const firstInput: UseApplicationDerivedStateInput = {
      ...createBaseInput(),
      debugErrors: [firstDebugError],
      debugIssueFilterQuery: "first",
      debugIssueDerivationWorkerOwner,
    };
    const snapshotReference: { current: ApplicationDerivedState | null } = {
      current: null,
    };
    const { rerender } = render(
      <Harness
        input={firstInput}
        onDerivedState={(derivedState) => {
          snapshotReference.current = derivedState;
        }}
      />,
    );

    const secondInput: UseApplicationDerivedStateInput = {
      ...firstInput,
      debugErrors: [secondDebugError],
      debugIssueFilterQuery: "second",
    };
    rerender(
      <Harness
        input={secondInput}
        onDerivedState={(derivedState) => {
          snapshotReference.current = derivedState;
        }}
      />,
    );

    await act(async () => {
      debugIssueDerivationWorkerOwner.resolveRequestByIndex(
        1,
        readDebugIssueDerivationResult(debugIssueStateResolver, {
          debugErrors: [secondDebugError],
          history: [],
          severityFilter: "all",
          filterQuery: "second",
          selectedIssueIdentifier: "",
        }),
      );
      await Promise.resolve();
    });
    expect(snapshotReference.current?.filteredDebugIssues[0]?.id).toContain("error-second");

    await act(async () => {
      debugIssueDerivationWorkerOwner.resolveRequestByIndex(
        0,
        readDebugIssueDerivationResult(debugIssueStateResolver, {
          debugErrors: [firstDebugError],
          history: [],
          severityFilter: "all",
          filterQuery: "first",
          selectedIssueIdentifier: "",
        }),
      );
      await Promise.resolve();
    });
    expect(snapshotReference.current?.filteredDebugIssues[0]?.id).toContain("error-second");
  });

  it("preserves empty-state collection identity across unchanged rerenders", () => {
    const input = createBaseInput();
    const harness = renderDerivedStateHarness(input);

    const initialDerivedState = harness.readLatestDerivedState();
    harness.rerender({
      ...input,
    });
    const nextDerivedState = harness.readLatestDerivedState();

    expect(nextDerivedState.turns).toBe(initialDerivedState.turns);
    expect(nextDerivedState.visibleConversationItems).toBe(
      initialDerivedState.visibleConversationItems,
    );
    expect(nextDerivedState.debugHistoryEntryListItems).toBe(
      initialDerivedState.debugHistoryEntryListItems,
    );
  });
});
