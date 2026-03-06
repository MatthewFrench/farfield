import { useDeferredValue, useMemo } from "react";
import { readRunningTerminalCount } from "@/Features/Chat/DomainModel/RunningTerminalCountSelector";
import { toErrorBannerDetails } from "@/Features/Debugging/DomainModel/ErrorBannerDetailsParser";
import {
  readActiveAgentCapabilities,
  readActiveAgentDescriptor,
  readActiveAgentLabel,
  readActiveThreadAgentId,
  readAgentCapabilityFlags,
  readAgentsById,
  readAvailableAgentIds,
  readSelectedAgentDescriptor,
} from "./ApplicationAgentCapabilityDerivation";
import { readAgentConnectivityAndSystemHealth } from "./ApplicationConnectivitySystemHealthDerivation";
import {
  readActiveRequestSelection,
  readConversationStateSelection,
} from "./ApplicationConversationStateDerivation";
import {
  readDefaultModeOption,
  readEffortOptions,
  readEffortOptionsWithoutAssumedDefault,
  readIsPlanModeEnabled,
  readModelOptionsWithoutAssumedDefault,
  readPlanModeOption,
} from "./ApplicationModeAndEffortOptionDerivation";
import { readModelOptions } from "./ApplicationModelOptionDerivation";
import {
  readChatSurfaceState,
  readSelectedThreadLabel,
  readThreadListState,
} from "./ApplicationThreadAndChatSurfaceDerivation";
import { useApplicationDebugIssueDerivedState } from "./UseApplicationDebugIssueDerivedState";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";
import { useFlatConversationItemsDerivedState } from "./UseFlatConversationItemsDerivedState";
import { useThreadListPresentationDerivedState } from "./UseThreadListPresentationDerivedState";

const DEFAULT_SELECTED_AGENT_LABEL = "Agent";
const MINIMUM_VISIBLE_CHAT_ITEM_INDEX = 0;
const EMPTY_TURNS: ApplicationDerivedState["turns"] = [];
const EMPTY_DEBUG_HISTORY_ENTRY_LIST_ITEMS: ApplicationDerivedState["debugHistoryEntryListItems"] =
  [];

function readRecentTraceSummaries(
  traceStatus: UseApplicationDerivedStateInput["traceStatus"],
): ApplicationDerivedState["recentTraceSummaries"] {
  if (!traceStatus) {
    return [];
  }
  return traceStatus.recent.map((trace) => ({
    id: trace.id,
    label: trace.label,
    eventCount: trace.eventCount,
    path: trace.path,
  }));
}

function readDebugHistoryEntryListItems(
  history: UseApplicationDerivedStateInput["history"],
): ApplicationDerivedState["debugHistoryEntryListItems"] {
  if (history.length === 0) {
    return EMPTY_DEBUG_HISTORY_ENTRY_LIST_ITEMS;
  }
  return history.map((historyEntry) => ({
    id: historyEntry.id,
    at: historyEntry.at,
    source: historyEntry.source,
    direction: historyEntry.direction,
  }));
}

function readPendingRequests(
  conversationState: ApplicationDerivedState["conversationState"],
  pendingUserInputRequestSelector: UseApplicationDerivedStateInput["pendingUserInputRequestSelector"],
): ApplicationDerivedState["pendingRequests"] {
  if (!conversationState) {
    return [];
  }
  return pendingUserInputRequestSelector.readPendingUserInputRequests(conversationState);
}

function readHistoryDetailPayloadText(
  historyDetail: UseApplicationDerivedStateInput["historyDetail"],
): string {
  if (!historyDetail) {
    return "";
  }
  return JSON.stringify(historyDetail.fullPayload, null, 2);
}

function readRunningTerminalCountFromConversationState(
  conversationState: ApplicationDerivedState["deferredConversationState"],
): number {
  return readRunningTerminalCount(conversationState);
}

function readActiveRequest(
  pendingRequests: ApplicationDerivedState["pendingRequests"],
  selectedRequestId: UseApplicationDerivedStateInput["selectedRequestId"],
): ApplicationDerivedState["activeRequest"] {
  return readActiveRequestSelection({
    pendingRequests,
    selectedRequestId,
  });
}

function readSelectedThread(
  threads: UseApplicationDerivedStateInput["threads"],
  selectedThreadId: UseApplicationDerivedStateInput["selectedThreadId"],
): ApplicationDerivedState["selectedThread"] {
  return threads.find((thread) => thread.id === selectedThreadId) ?? null;
}

function readSurfaceDerivation(input: {
  selectedThreadId: UseApplicationDerivedStateInput["selectedThreadId"];
  isCoreLoading: UseApplicationDerivedStateInput["isCoreLoading"];
  isSelectedThreadLoading: UseApplicationDerivedStateInput["isSelectedThreadLoading"];
  threadCount: number;
  turnCount: number;
  errorMessage: UseApplicationDerivedStateInput["errorMessage"];
}): {
  threadListState: ApplicationDerivedState["threadListState"];
  chatSurfaceState: ApplicationDerivedState["chatSurfaceState"];
  errorBannerDetails: ApplicationDerivedState["errorBannerDetails"];
} {
  return {
    threadListState: readThreadListState({
      isCoreLoading: input.isCoreLoading,
      threadCount: input.threadCount,
    }),
    chatSurfaceState: readChatSurfaceState({
      selectedThreadId: input.selectedThreadId,
      isCoreLoading: input.isCoreLoading,
      isSelectedThreadLoading: input.isSelectedThreadLoading,
      turnCount: input.turnCount,
    }),
    errorBannerDetails: toErrorBannerDetails(input.errorMessage),
  };
}

export function useApplicationDerivedState(
  input: UseApplicationDerivedStateInput,
): ApplicationDerivedState {
  const {
    threads,
    archivedThreads,
    selectedThreadId,
    selectedRequestId,
    selectedAgentId,
    selectedModeKey,
    selectedModelId,
    selectedReasoningEffort,
    visibleChatItemLimit,
    isCoreLoading,
    isSelectedThreadLoading,
    debugIssueSeverityFilter,
    debugIssueFilterQuery,
    selectedDebugIssueId,
    health,
    configDefaults,
    liveState,
    readThreadState,
    modes,
    models,
    agentDescriptors,
    history,
    historyDetail,
    debugErrors,
    traceStatus,
    errorMessage,
    defaultEffortOptions,
    assumedAppDefaultModelIdentifier,
    assumedAppDefaultReasoningEffort,
    modeSelectionStateResolver,
    conversationSyncSignatureBuilder,
    pendingUserInputRequestSelector,
    conversationItemFlattener,
    conversationItemFlatteningWorkerOwner,
    debugIssueStateResolver,
    debugIssueDerivationWorkerOwner,
    threadListPresentationWorkerOwner,
    threadListStateController,
  } = input;

  const agentsById = useMemo(() => readAgentsById(agentDescriptors), [agentDescriptors]);

  const availableAgentIds = useMemo(
    () => readAvailableAgentIds(agentDescriptors),
    [agentDescriptors],
  );

  const selectedAgentDescriptor = useMemo(
    () => readSelectedAgentDescriptor({ agentsById, selectedAgentId }),
    [agentsById, selectedAgentId],
  );

  const {
    threadListPresentationState: rawThreadListPresentationState,
    threadListPresentationError,
  } = useThreadListPresentationDerivedState({
    threads,
    archivedThreads,
    selectedThreadId,
    threadListPresentationWorkerOwner,
    threadListStateController,
  });

  if (threadListPresentationError) {
    throw threadListPresentationError;
  }

  const selectedThread = useMemo(
    () => readSelectedThread(threads, selectedThreadId),
    [selectedThreadId, threads],
  );

  const threadListPresentationState = useMemo<
    ApplicationDerivedState["threadListPresentationState"]
  >(
    () => ({
      ...rawThreadListPresentationState,
      selectedThread,
    }),
    [rawThreadListPresentationState, selectedThread],
  );

  const appDefaultModel = configDefaults?.model ?? assumedAppDefaultModelIdentifier;
  const appDefaultReasoningEffort =
    configDefaults?.reasoningEffort ?? assumedAppDefaultReasoningEffort;
  const selectedAgentLabel = selectedAgentDescriptor?.label ?? DEFAULT_SELECTED_AGENT_LABEL;
  const selectedAgentCapabilities = selectedAgentDescriptor?.capabilities ?? null;
  const activeProjectGroups = threadListPresentationState.activeProjectGroups;
  const archivedProjectGroups = threadListPresentationState.archivedProjectGroups;
  const archivedThreadIds = threadListPresentationState.archivedThreadIdentifiers;
  const archivedSectionThreadCount = threadListPresentationState.archivedSectionThreadCount;

  const conversationState = useMemo<ApplicationDerivedState["conversationState"]>(() => {
    const liveConversationState = liveState?.conversationState ?? null;
    const readConversationState = readThreadState?.thread ?? null;
    return readConversationStateSelection({
      liveConversationState,
      readConversationState,
      conversationSyncSignatureBuilder,
    });
  }, [conversationSyncSignatureBuilder, liveState?.conversationState, readThreadState?.thread]);

  const pendingRequests = useMemo<ApplicationDerivedState["pendingRequests"]>(
    () => readPendingRequests(conversationState, pendingUserInputRequestSelector),
    [conversationState, pendingUserInputRequestSelector],
  );

  const immediateTurns = conversationState?.turns ?? EMPTY_TURNS;
  const lastTurn = immediateTurns[immediateTurns.length - 1];
  const isGenerating = conversationItemFlattener.isTurnInProgressStatus(lastTurn?.status);

  const deferredConversationState = useDeferredValue(conversationState);

  const runningTerminalCount = useMemo(
    () => readRunningTerminalCountFromConversationState(deferredConversationState),
    [deferredConversationState],
  );

  const liveStateReductionError = useMemo<
    ApplicationDerivedState["liveStateReductionError"]
  >(() => {
    const errorState = liveState?.liveStateError;
    if (errorState === null || errorState === undefined) {
      return null;
    }
    return errorState;
  }, [liveState?.liveStateError]);

  const activeRequest = useMemo<ApplicationDerivedState["activeRequest"]>(
    () => readActiveRequest(pendingRequests, selectedRequestId),
    [pendingRequests, selectedRequestId],
  );

  const activeThreadAgentId = useMemo<ApplicationDerivedState["activeThreadAgentId"]>(
    () => readActiveThreadAgentId({ selectedThread, selectedAgentId }),
    [selectedAgentId, selectedThread],
  );

  const activeAgentDescriptor = useMemo(
    () =>
      readActiveAgentDescriptor({
        activeThreadAgentId,
        agentsById,
        selectedAgentDescriptor,
      }),
    [activeThreadAgentId, agentsById, selectedAgentDescriptor],
  );

  const selectedThreadLabel = readSelectedThreadLabel({
    selectedThread,
    selectedThreadId,
    isSelectedThreadLoading,
  });

  const historyDetailPayloadText = readHistoryDetailPayloadText(historyDetail);

  const recentTraceSummaries = useMemo(() => readRecentTraceSummaries(traceStatus), [traceStatus]);

  const debugHistoryEntryListItems = useMemo(
    () => readDebugHistoryEntryListItems(history),
    [history],
  );

  const activeAgentLabel = readActiveAgentLabel({
    activeAgentDescriptor,
    selectedAgentLabel,
  });
  const activeAgentCapabilities = readActiveAgentCapabilities({
    activeAgentDescriptor,
    selectedAgentCapabilities,
  });
  const {
    canSetCollaborationMode,
    canListModels,
    canListCollaborationModes,
    canSubmitUserInputForActiveAgent,
  } = readAgentCapabilityFlags(activeAgentCapabilities);

  const planModeOption = useMemo(
    () =>
      readPlanModeOption({
        modes,
        modeSelectionStateResolver,
      }),
    [modeSelectionStateResolver, modes],
  );

  const defaultModeOption = useMemo(
    () =>
      readDefaultModeOption({
        modes,
        modeSelectionStateResolver,
      }),
    [modeSelectionStateResolver, modes],
  );

  const isPlanModeEnabled = readIsPlanModeEnabled({
    planModeOption,
    selectedModeKey,
  });

  const effortOptions = useMemo(
    () =>
      readEffortOptions({
        defaultEffortOptions,
        modes,
        latestReasoningEffort: conversationState?.latestReasoningEffort,
        selectedReasoningEffort,
      }),
    [
      conversationState?.latestReasoningEffort,
      defaultEffortOptions,
      modes,
      selectedReasoningEffort,
    ],
  );

  const effortOptionsWithoutAssumedDefault = useMemo(
    () =>
      readEffortOptionsWithoutAssumedDefault({
        appDefaultReasoningEffort,
        effortOptions,
      }),
    [appDefaultReasoningEffort, effortOptions],
  );

  const modelOptions = useMemo(
    () =>
      readModelOptions({
        models,
        latestModel: conversationState?.latestModel,
        selectedModelId,
      }),
    [conversationState?.latestModel, models, selectedModelId],
  );

  const modelOptionsWithoutAssumedDefault = useMemo(
    () =>
      readModelOptionsWithoutAssumedDefault({
        appDefaultModel,
        modelOptions,
      }),
    [appDefaultModel, modelOptions],
  );

  const turns = immediateTurns;

  const { threadListState, chatSurfaceState, errorBannerDetails } = readSurfaceDerivation({
    selectedThreadId,
    isCoreLoading,
    isSelectedThreadLoading,
    threadCount: threads.length,
    turnCount: immediateTurns.length,
    errorMessage,
  });

  const {
    debugErrorIssues,
    debugWarningIssues,
    debugIssues,
    runtimeRequestErrorOperationMetrics,
    filteredDebugIssues,
    selectedDebugIssue,
  } = useApplicationDebugIssueDerivedState({
    debugErrors,
    history,
    debugIssueSeverityFilter,
    debugIssueFilterQuery,
    selectedDebugIssueId,
    debugIssueStateResolver,
    debugIssueDerivationWorkerOwner,
  });

  const { flatConversationItems, conversationItemFlatteningError } =
    useFlatConversationItemsDerivedState({
      turns,
      isGenerating,
      conversationItemFlattener,
      conversationItemFlatteningWorkerOwner,
    });

  if (conversationItemFlatteningError) {
    throw conversationItemFlatteningError;
  }

  const conversationItemCount = flatConversationItems.length;
  // Clamp to zero so slicing never underflows when the visible limit is larger than the list.
  const firstVisibleChatItemIndex = Math.max(
    MINIMUM_VISIBLE_CHAT_ITEM_INDEX,
    conversationItemCount - visibleChatItemLimit,
  );
  const hasHiddenChatItems = firstVisibleChatItemIndex > MINIMUM_VISIBLE_CHAT_ITEM_INDEX;

  const visibleConversationItems = useMemo(
    () => flatConversationItems.slice(firstVisibleChatItemIndex),
    [firstVisibleChatItemIndex, flatConversationItems],
  );

  const { codexConfigured, openCodeConnected, allSystemsReady, hasAnySystemFailure } =
    readAgentConnectivityAndSystemHealth({
      agentsById,
      health,
    });

  return {
    threadListPresentationState,
    selectedThread,
    agentsById,
    availableAgentIds,
    selectedAgentDescriptor,
    appDefaultModel,
    appDefaultReasoningEffort,
    selectedAgentLabel,
    selectedAgentCapabilities,
    activeProjectGroups,
    archivedProjectGroups,
    archivedThreadIds,
    archivedSectionThreadCount,
    conversationState,
    runningTerminalCount,
    pendingRequests,
    liveStateReductionError,
    activeRequest,
    activeThreadAgentId,
    activeAgentDescriptor,
    selectedThreadLabel,
    historyDetailPayloadText,
    recentTraceSummaries,
    debugHistoryEntryListItems,
    activeAgentLabel,
    activeAgentCapabilities,
    canSetCollaborationMode,
    canListModels,
    canListCollaborationModes,
    canSubmitUserInputForActiveAgent,
    planModeOption,
    defaultModeOption,
    isPlanModeEnabled,
    effortOptions,
    effortOptionsWithoutAssumedDefault,
    modelOptions,
    modelOptionsWithoutAssumedDefault,
    deferredConversationState,
    turns,
    lastTurn,
    isGenerating,
    threadListState,
    chatSurfaceState,
    errorBannerDetails,
    debugErrorIssues,
    debugWarningIssues,
    debugIssues,
    runtimeRequestErrorOperationMetrics,
    filteredDebugIssues,
    selectedDebugIssue,
    flatConversationItems,
    conversationItemCount,
    firstVisibleChatItemIndex,
    hasHiddenChatItems,
    visibleConversationItems,
    commitLabel: health?.state.gitCommit ?? "unknown",
    codexConfigured,
    openCodeConnected,
    allSystemsReady,
    hasAnySystemFailure,
  };
}
