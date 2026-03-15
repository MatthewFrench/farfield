import { useDeferredValue, useMemo } from "react";
import { readInterruptedTurnNotice } from "@/Features/Chat/DomainModel/InterruptedTurnNoticeDerivation";
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

function readThreadProjectDerivedState(input: {
  threadListPresentationState: ApplicationDerivedState["threadListPresentationState"];
  selectedAgentProjectDirectories: readonly string[];
  threadComposerProjectContextStateOwner: UseApplicationDerivedStateInput["threadComposerProjectContextStateOwner"];
}): Pick<
  ApplicationDerivedState,
  | "newThreadProjectPathResolution"
  | "activeProjectGroups"
  | "archivedProjectGroups"
  | "archivedThreadIds"
  | "archivedSectionThreadCount"
> {
  return {
    newThreadProjectPathResolution: input.threadComposerProjectContextStateOwner.resolveProjectPath(
      {
        activeProjectGroups: input.threadListPresentationState.activeProjectGroups,
        selectedAgentProjectDirectories: input.selectedAgentProjectDirectories,
      },
    ),
    activeProjectGroups: input.threadListPresentationState.activeProjectGroups,
    archivedProjectGroups: input.threadListPresentationState.archivedProjectGroups,
    archivedThreadIds: input.threadListPresentationState.archivedThreadIdentifiers,
    archivedSectionThreadCount: input.threadListPresentationState.archivedSectionThreadCount,
  };
}

function readActiveAgentDerivedState(input: {
  activeThreadAgentId: ApplicationDerivedState["activeThreadAgentId"];
  agentsById: ApplicationDerivedState["agentsById"];
  selectedAgentDescriptor: ApplicationDerivedState["selectedAgentDescriptor"];
  selectedAgentLabel: ApplicationDerivedState["selectedAgentLabel"];
  selectedAgentCapabilities: ApplicationDerivedState["selectedAgentCapabilities"];
}): Pick<
  ApplicationDerivedState,
  | "activeAgentDescriptor"
  | "activeAgentLabel"
  | "activeAgentCapabilities"
  | "canSetCollaborationMode"
  | "canListModels"
  | "canListCollaborationModes"
  | "canSubmitUserInputForActiveAgent"
> {
  const activeAgentDescriptor = readActiveAgentDescriptor({
    activeThreadAgentId: input.activeThreadAgentId,
    agentsById: input.agentsById,
    selectedAgentDescriptor: input.selectedAgentDescriptor,
  });
  const activeAgentLabel = readActiveAgentLabel({
    activeAgentDescriptor,
    selectedAgentLabel: input.selectedAgentLabel,
  });
  const activeAgentCapabilities = readActiveAgentCapabilities({
    activeAgentDescriptor,
    selectedAgentCapabilities: input.selectedAgentCapabilities,
  });
  const {
    canSetCollaborationMode,
    canListModels,
    canListCollaborationModes,
    canSubmitUserInputForActiveAgent,
  } = readAgentCapabilityFlags(activeAgentCapabilities);

  return {
    activeAgentDescriptor,
    activeAgentLabel,
    activeAgentCapabilities,
    canSetCollaborationMode,
    canListModels,
    canListCollaborationModes,
    canSubmitUserInputForActiveAgent,
  };
}

function readModeAndModelDerivedState(input: {
  modes: UseApplicationDerivedStateInput["modes"];
  models: UseApplicationDerivedStateInput["models"];
  modeSelectionStateResolver: UseApplicationDerivedStateInput["modeSelectionStateResolver"];
  selectedModeKey: UseApplicationDerivedStateInput["selectedModeKey"];
  selectedModelId: UseApplicationDerivedStateInput["selectedModelId"];
  selectedReasoningEffort: UseApplicationDerivedStateInput["selectedReasoningEffort"];
  conversationState: ApplicationDerivedState["conversationState"];
  defaultEffortOptions: UseApplicationDerivedStateInput["defaultEffortOptions"];
  appDefaultModel: ApplicationDerivedState["appDefaultModel"];
  appDefaultReasoningEffort: ApplicationDerivedState["appDefaultReasoningEffort"];
}): Pick<
  ApplicationDerivedState,
  | "planModeOption"
  | "defaultModeOption"
  | "isPlanModeEnabled"
  | "effortOptions"
  | "effortOptionsWithoutAssumedDefault"
  | "modelOptions"
  | "modelOptionsWithoutAssumedDefault"
> {
  const planModeOption = readPlanModeOption({
    modes: input.modes,
    modeSelectionStateResolver: input.modeSelectionStateResolver,
  });
  const defaultModeOption = readDefaultModeOption({
    modes: input.modes,
    modeSelectionStateResolver: input.modeSelectionStateResolver,
  });
  const isPlanModeEnabled = readIsPlanModeEnabled({
    planModeOption,
    selectedModeKey: input.selectedModeKey,
  });
  const effortOptions = readEffortOptions({
    defaultEffortOptions: input.defaultEffortOptions,
    modes: input.modes,
    latestReasoningEffort: input.conversationState?.latestReasoningEffort,
    selectedReasoningEffort: input.selectedReasoningEffort,
  });
  const effortOptionsWithoutAssumedDefault = readEffortOptionsWithoutAssumedDefault({
    appDefaultReasoningEffort: input.appDefaultReasoningEffort,
    effortOptions,
  });
  const modelOptions = readModelOptions({
    models: input.models,
    latestModel: input.conversationState?.latestModel,
    selectedModelId: input.selectedModelId,
  });
  const modelOptionsWithoutAssumedDefault = readModelOptionsWithoutAssumedDefault({
    appDefaultModel: input.appDefaultModel,
    modelOptions,
  });

  return {
    planModeOption,
    defaultModeOption,
    isPlanModeEnabled,
    effortOptions,
    effortOptionsWithoutAssumedDefault,
    modelOptions,
    modelOptionsWithoutAssumedDefault,
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
  const {
    newThreadProjectPathResolution,
    activeProjectGroups,
    archivedProjectGroups,
    archivedThreadIds,
    archivedSectionThreadCount,
  } = useMemo(
    () =>
      readThreadProjectDerivedState({
        threadListPresentationState,
        selectedAgentProjectDirectories: selectedAgentDescriptor?.projectDirectories ?? [],
        threadComposerProjectContextStateOwner: input.threadComposerProjectContextStateOwner,
      }),
    [
      input.threadComposerProjectContextStateOwner,
      selectedAgentDescriptor?.projectDirectories,
      threadListPresentationState,
    ],
  );

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
  const interruptedTurnNotice = useMemo(
    () => readInterruptedTurnNotice(immediateTurns),
    [immediateTurns],
  );
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

  const {
    activeAgentDescriptor,
    activeAgentLabel,
    activeAgentCapabilities,
    canSetCollaborationMode,
    canListModels,
    canListCollaborationModes,
    canSubmitUserInputForActiveAgent,
  } = useMemo(
    () =>
      readActiveAgentDerivedState({
        activeThreadAgentId,
        agentsById,
        selectedAgentDescriptor,
        selectedAgentLabel,
        selectedAgentCapabilities,
      }),
    [
      activeThreadAgentId,
      agentsById,
      selectedAgentDescriptor,
      selectedAgentLabel,
      selectedAgentCapabilities,
    ],
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

  const {
    planModeOption,
    defaultModeOption,
    isPlanModeEnabled,
    effortOptions,
    effortOptionsWithoutAssumedDefault,
    modelOptions,
    modelOptionsWithoutAssumedDefault,
  } = useMemo(
    () =>
      readModeAndModelDerivedState({
        modes,
        models,
        modeSelectionStateResolver,
        selectedModeKey,
        selectedModelId,
        selectedReasoningEffort,
        conversationState,
        defaultEffortOptions,
        appDefaultModel,
        appDefaultReasoningEffort,
      }),
    [
      appDefaultModel,
      appDefaultReasoningEffort,
      conversationState,
      defaultEffortOptions,
      modeSelectionStateResolver,
      models,
      modes,
      selectedModeKey,
      selectedModelId,
      selectedReasoningEffort,
    ],
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

  const { conversationItemCount, visibleConversationItems, conversationItemFlatteningError } =
    useFlatConversationItemsDerivedState({
      turns,
      isGenerating,
      visibleChatItemLimit,
      conversationItemFlattener,
    });

  if (conversationItemFlatteningError) {
    throw conversationItemFlatteningError;
  }

  // Clamp to zero so slicing never underflows when the visible limit is larger than the list.
  const firstVisibleChatItemIndex = Math.max(
    MINIMUM_VISIBLE_CHAT_ITEM_INDEX,
    conversationItemCount - visibleChatItemLimit,
  );
  const hasHiddenChatItems = firstVisibleChatItemIndex > MINIMUM_VISIBLE_CHAT_ITEM_INDEX;

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
    newThreadProjectPathResolution,
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
    interruptedTurnNotice,
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
