import { cleanup, render } from "@testing-library/react";
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
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { type ThreadListItem } from "../Source/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
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
        canSetCollaborationMode: true,
        canSubmitUserInput: true,
        canReadLiveState: true,
        canReadStreamEvents: true,
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
        canSetCollaborationMode: false,
        canSubmitUserInput: false,
        canReadLiveState: false,
        canReadStreamEvents: false,
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
});
