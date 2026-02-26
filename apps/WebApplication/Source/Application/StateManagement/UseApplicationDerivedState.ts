import { useDeferredValue, useMemo } from "react";
import { toErrorBannerDetails } from "@/Features/Debugging/DomainModel/ErrorBannerDetailsParser";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput
} from "./UseApplicationDerivedStateContracts";

const DEFAULT_SELECTED_AGENT_LABEL = "Agent";
const LOADING_THREAD_LABEL = "Loading thread...";
const NO_THREAD_SELECTED_LABEL = "No thread selected";
const UNKNOWN_COMMIT_LABEL = "unknown";

type ConversationState = ApplicationDerivedState["conversationState"];
type SystemHealthState = UseApplicationDerivedStateInput["health"];

interface ConversationStateSelectionInput {
  liveConversationState: ConversationState;
  readConversationState: ConversationState;
  conversationSyncSignatureBuilder: UseApplicationDerivedStateInput["conversationSyncSignatureBuilder"];
}

interface ActiveRequestSelectionInput {
  pendingRequests: ApplicationDerivedState["pendingRequests"];
  selectedRequestId: number | null;
}

interface SelectedThreadLabelInput {
  selectedThread: ApplicationDerivedState["selectedThread"];
  selectedThreadId: string | null;
  isSelectedThreadLoading: boolean;
}

interface ThreadListStateInput {
  isCoreLoading: boolean;
  threadCount: number;
}

interface ChatSurfaceStateInput {
  selectedThreadId: string | null;
  isCoreLoading: boolean;
  isSelectedThreadLoading: boolean;
  turnCount: number;
}

interface ModelOptionsInput {
  models: UseApplicationDerivedStateInput["models"];
  latestModel: string | null | undefined;
  selectedModelId: string;
}

interface SystemHealthStatus {
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
}

interface SystemHealthStatusInput {
  codexConfigured: boolean;
  openCodeConnected: boolean;
  health: SystemHealthState;
}

function readConversationStateSelection(
  input: ConversationStateSelectionInput
): ConversationState {
  const {
    liveConversationState,
    readConversationState,
    conversationSyncSignatureBuilder
  } = input;
  if (!liveConversationState) {
    return readConversationState;
  }
  if (!readConversationState) {
    return liveConversationState;
  }

  // Use the newest snapshot so streamed updates and read-thread responses remain aligned.
  const liveUpdatedAt = conversationSyncSignatureBuilder.readConversationStateUpdatedAt(
    liveConversationState
  );
  const readUpdatedAt = conversationSyncSignatureBuilder.readConversationStateUpdatedAt(
    readConversationState
  );
  return liveUpdatedAt > readUpdatedAt ? liveConversationState : readConversationState;
}

function readActiveRequestSelection(
  input: ActiveRequestSelectionInput
): ApplicationDerivedState["activeRequest"] {
  const { pendingRequests, selectedRequestId } = input;
  const firstPendingRequest = pendingRequests[0] ?? null;
  if (!firstPendingRequest) {
    return null;
  }
  if (selectedRequestId === null) {
    return firstPendingRequest;
  }
  return pendingRequests.find((request) => request.id === selectedRequestId) ?? firstPendingRequest;
}

function readSelectedThreadLabel(input: SelectedThreadLabelInput): string {
  const { selectedThread, selectedThreadId, isSelectedThreadLoading } = input;
  if (selectedThread) {
    return ThreadGroupSelectors.threadLabel(selectedThread);
  }
  if (selectedThreadId && isSelectedThreadLoading) {
    return LOADING_THREAD_LABEL;
  }
  return NO_THREAD_SELECTED_LABEL;
}

function readThreadListState(input: ThreadListStateInput): ApplicationDerivedState["threadListState"] {
  const { isCoreLoading, threadCount } = input;
  if (isCoreLoading) {
    return "loading";
  }
  if (threadCount === 0) {
    return "empty";
  }
  return "ready";
}

function readChatSurfaceState(input: ChatSurfaceStateInput): ApplicationDerivedState["chatSurfaceState"] {
  const {
    selectedThreadId,
    isCoreLoading,
    isSelectedThreadLoading,
    turnCount
  } = input;
  if (!selectedThreadId && isCoreLoading) {
    return "loading-threads";
  }
  if (selectedThreadId && isSelectedThreadLoading) {
    return "loading-thread";
  }
  if (turnCount === 0) {
    return selectedThreadId ? "no-messages" : "no-thread";
  }
  return "ready";
}

function readModelOptionLabel(model: UseApplicationDerivedStateInput["models"][number]): string {
  if (model.displayName && model.displayName !== model.id) {
    return `${model.displayName} (${model.id})`;
  }
  return model.displayName || model.id;
}

function readModelOptions(input: ModelOptionsInput): ApplicationDerivedState["modelOptions"] {
  const { models, latestModel, selectedModelId } = input;
  const modelLabelById = new Map<string, string>();

  for (const model of models) {
    modelLabelById.set(model.id, readModelOptionLabel(model));
  }

  if (latestModel && !modelLabelById.has(latestModel)) {
    modelLabelById.set(latestModel, latestModel);
  }
  if (selectedModelId && !modelLabelById.has(selectedModelId)) {
    modelLabelById.set(selectedModelId, selectedModelId);
  }

  return Array.from(modelLabelById.entries()).map(([id, label]) => ({ id, label }));
}

function readSystemHealthStatus(input: SystemHealthStatusInput): SystemHealthStatus {
  const { codexConfigured, openCodeConnected, health } = input;

  if (!codexConfigured) {
    return {
      allSystemsReady: openCodeConnected,
      hasAnySystemFailure: !openCodeConnected
    };
  }

  return {
    allSystemsReady:
      health?.state.appReady === true
      && health?.state.ipcConnected === true
      && health?.state.ipcInitialized === true,
    hasAnySystemFailure:
      health?.state.appReady === false
      || health?.state.ipcConnected === false
      || health?.state.ipcInitialized === false
  };
}

export function useApplicationDerivedState(
  input: UseApplicationDerivedStateInput
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
    threadListStateController
  } = input;

  const threadListPresentationState = useMemo(
    () =>
      threadListStateController.readThreadListPresentationState({
        threads,
        archivedThreads,
        selectedThreadIdentifier: selectedThreadId
      }),
    [archivedThreads, selectedThreadId, threadListStateController, threads]
  );

  const selectedThread = threadListPresentationState.selectedThread;
  const agentsById = useMemo(() => {
    const map: ApplicationDerivedState["agentsById"] = {};
    for (const descriptor of agentDescriptors) {
      map[descriptor.id] = descriptor;
    }
    return map;
  }, [agentDescriptors]);

  const availableAgentIds = useMemo(
    () => agentDescriptors.filter((descriptor) => descriptor.enabled).map((descriptor) => descriptor.id),
    [agentDescriptors]
  );

  const selectedAgentDescriptor = useMemo(
    () => agentsById[selectedAgentId] ?? null,
    [agentsById, selectedAgentId]
  );

  const appDefaultModel = configDefaults?.model ?? assumedAppDefaultModelIdentifier;
  const appDefaultReasoningEffort = configDefaults?.reasoningEffort ?? assumedAppDefaultReasoningEffort;
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
      conversationSyncSignatureBuilder
    });
  }, [conversationSyncSignatureBuilder, liveState?.conversationState, readThreadState?.thread]);

  const pendingRequests = useMemo<ApplicationDerivedState["pendingRequests"]>(() => {
    if (!conversationState) {
      return [];
    }
    return pendingUserInputRequestSelector.readPendingUserInputRequests(conversationState);
  }, [conversationState, pendingUserInputRequestSelector]);

  const liveStateReductionError = useMemo<ApplicationDerivedState["liveStateReductionError"]>(() => {
    const errorState = liveState?.liveStateError;
    if (!errorState || errorState.kind !== "reductionFailed") {
      return null;
    }
    return errorState;
  }, [liveState?.liveStateError]);

  const activeRequest = useMemo<ApplicationDerivedState["activeRequest"]>(() => {
    return readActiveRequestSelection({
      pendingRequests,
      selectedRequestId
    });
  }, [pendingRequests, selectedRequestId]);

  const activeThreadAgentId = useMemo<ApplicationDerivedState["activeThreadAgentId"]>(
    () => selectedThread?.agentId ?? selectedAgentId,
    [selectedAgentId, selectedThread]
  );

  const activeAgentDescriptor = useMemo(
    () => agentsById[activeThreadAgentId] ?? selectedAgentDescriptor,
    [activeThreadAgentId, agentsById, selectedAgentDescriptor]
  );

  const selectedThreadLabel = readSelectedThreadLabel({
    selectedThread,
    selectedThreadId,
    isSelectedThreadLoading
  });

  const historyDetailPayloadText = useMemo(() => {
    if (!historyDetail) {
      return "";
    }
    return JSON.stringify(historyDetail.fullPayload, null, 2);
  }, [historyDetail]);

  const recentTraceSummaries = useMemo<ApplicationDerivedState["recentTraceSummaries"]>(() => {
    if (!traceStatus) {
      return [];
    }
    return traceStatus.recent.map((trace) => ({
      id: trace.id,
      label: trace.label,
      eventCount: trace.eventCount,
      path: trace.path
    }));
  }, [traceStatus]);

  const debugHistoryEntryListItems = useMemo<ApplicationDerivedState["debugHistoryEntryListItems"]>(
    () =>
      history.map((historyEntry) => ({
        id: historyEntry.id,
        at: historyEntry.at,
        source: historyEntry.source,
        direction: historyEntry.direction
      })),
    [history]
  );

  const activeAgentLabel = activeAgentDescriptor?.label ?? selectedAgentLabel;
  const activeAgentCapabilities = activeAgentDescriptor?.capabilities ?? selectedAgentCapabilities;
  const canSetCollaborationMode = Boolean(activeAgentCapabilities?.canSetCollaborationMode);
  const canListModels = Boolean(activeAgentCapabilities?.canListModels);
  const canListCollaborationModes = Boolean(activeAgentCapabilities?.canListCollaborationModes);
  const canSubmitUserInputForActiveAgent = Boolean(activeAgentCapabilities?.canSubmitUserInput);

  const planModeOption = useMemo(
    () => modes.find((mode) => modeSelectionStateResolver.isPlanModeOption(mode)) ?? null,
    [modeSelectionStateResolver, modes]
  );

  const defaultModeOption = useMemo(
    () => modes.find((mode) => !modeSelectionStateResolver.isPlanModeOption(mode)) ?? modes[0] ?? null,
    [modeSelectionStateResolver, modes]
  );

  const isPlanModeEnabled = planModeOption !== null && selectedModeKey === planModeOption.mode;

  const effortOptions = useMemo(() => {
    const values = new Set<string>(defaultEffortOptions);
    for (const mode of modes) {
      if (mode.reasoning_effort) {
        values.add(mode.reasoning_effort);
      }
    }
    const latestEffort = conversationState?.latestReasoningEffort;
    if (latestEffort) {
      values.add(latestEffort);
    }
    if (selectedReasoningEffort) {
      values.add(selectedReasoningEffort);
    }
    return Array.from(values);
  }, [conversationState?.latestReasoningEffort, defaultEffortOptions, modes, selectedReasoningEffort]);

  const effortOptionsWithoutAssumedDefault = useMemo(
    () => effortOptions.filter((option) => option !== appDefaultReasoningEffort),
    [appDefaultReasoningEffort, effortOptions]
  );

  const modelOptions = useMemo(
    () =>
      readModelOptions({
        models,
        latestModel: conversationState?.latestModel,
        selectedModelId
      }),
    [conversationState?.latestModel, models, selectedModelId]
  );

  const modelOptionsWithoutAssumedDefault = useMemo(
    () => modelOptions.filter((option) => option.id !== appDefaultModel),
    [appDefaultModel, modelOptions]
  );

  const deferredConversationState = useDeferredValue(conversationState);
  const turns = deferredConversationState?.turns ?? [];
  const lastTurn = turns[turns.length - 1];
  const isGenerating = conversationItemFlattener.isTurnInProgressStatus(lastTurn?.status);

  const threadListState = readThreadListState({
    isCoreLoading,
    threadCount: threads.length
  });

  const chatSurfaceState = readChatSurfaceState({
    selectedThreadId,
    isCoreLoading,
    isSelectedThreadLoading,
    turnCount: turns.length
  });

  const errorBannerDetails = useMemo(() => toErrorBannerDetails(errorMessage), [errorMessage]);

  const debugErrorIssues = useMemo(
    () => debugIssueStateResolver.readDebugErrorIssues(debugErrors),
    [debugErrors, debugIssueStateResolver]
  );

  const debugWarningIssues = useMemo(
    () => debugIssueStateResolver.readDebugWarningIssues(history),
    [debugIssueStateResolver, history]
  );

  const debugIssues = useMemo(
    () =>
      debugIssueStateResolver.readCombinedDebugIssues({
        debugErrorIssues,
        debugWarningIssues
      }),
    [debugErrorIssues, debugIssueStateResolver, debugWarningIssues]
  );

  const filteredDebugIssues = useMemo(
    () =>
      debugIssueStateResolver.readFilteredDebugIssues({
        debugIssues,
        severityFilter: debugIssueSeverityFilter,
        filterQuery: debugIssueFilterQuery
      }),
    [debugIssueFilterQuery, debugIssueSeverityFilter, debugIssueStateResolver, debugIssues]
  );

  const selectedDebugIssue = useMemo(
    () =>
      debugIssueStateResolver.readSelectedDebugIssue({
        debugIssues: filteredDebugIssues,
        selectedIssueIdentifier: selectedDebugIssueId
      }),
    [debugIssueStateResolver, filteredDebugIssues, selectedDebugIssueId]
  );

  const flatConversationItems = useMemo<ApplicationDerivedState["flatConversationItems"]>(
    () => conversationItemFlattener.flattenConversationItems(turns, isGenerating),
    [conversationItemFlattener, isGenerating, turns]
  );

  const conversationItemCount = flatConversationItems.length;
  const firstVisibleChatItemIndex = Math.max(0, conversationItemCount - visibleChatItemLimit);
  const hasHiddenChatItems = firstVisibleChatItemIndex > 0;

  const visibleConversationItems = useMemo(
    () => flatConversationItems.slice(firstVisibleChatItemIndex),
    [firstVisibleChatItemIndex, flatConversationItems]
  );

  const commitLabel = health?.state.gitCommit ?? UNKNOWN_COMMIT_LABEL;
  const codexConfigured = agentsById.codex?.enabled === true;
  const openCodeConnected = agentsById.opencode?.connected === true;
  const { allSystemsReady, hasAnySystemFailure } = readSystemHealthStatus({
    codexConfigured,
    openCodeConnected,
    health
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
    filteredDebugIssues,
    selectedDebugIssue,
    flatConversationItems,
    conversationItemCount,
    firstVisibleChatItemIndex,
    hasHiddenChatItems,
    visibleConversationItems,
    commitLabel,
    codexConfigured,
    openCodeConnected,
    allSystemsReady,
    hasAnySystemFailure
  };
}
