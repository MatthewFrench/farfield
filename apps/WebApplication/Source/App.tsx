/**
 * Root web-shell composition owner.
 * This module wires typed owner hooks into the shell layout while keeping
 * feature behavior in dedicated owner modules.
 */
import { useCallback, useMemo } from "react";
import {
  APP_DEFAULT_VALUE,
  ARCHIVED_THREAD_LIST_MAX_PAGES,
  ASSUMED_APP_DEFAULT_MODEL_IDENTIFIER,
  ASSUMED_APP_DEFAULT_REASONING_EFFORT,
  CAPABILITY_REFRESH_INTERVAL_MS,
  CHAT_SCROLL_BOTTOM_THRESHOLD_PX,
  CONVERSATION_ITEM_FLATTENING_EXECUTION_MODE,
  CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS,
  CORE_REFRESH_INTERVAL_MS,
  DEBUG_ERROR_LIST_LIMIT,
  DEBUG_HISTORY_LIMIT,
  DEBUG_ISSUE_DERIVATION_EXECUTION_MODE,
  DEFAULT_EFFORT_OPTIONS,
  EVENT_REFRESH_SCHEDULE_DELAY_MS,
  EVENT_STREAM_REFRESH_DECISION_EXECUTION_MODE,
  INITIAL_VISIBLE_CHAT_ITEMS,
  MOBILE_LAYOUT_MAXIMUM_WIDTH_PX,
  MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX,
  MOBILE_SIDEBAR_SWIPE_EDGE_PX,
  MOBILE_SIDEBAR_SWIPE_MAXIMUM_VERTICAL_DRIFT_PX,
  MOBILE_SIDEBAR_SWIPE_TRIGGER_PX,
  MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX,
  PUSH_DIAGNOSTICS_REFRESH_TIME_TO_LIVE_MS,
  READ_THREAD_RETRY_ATTEMPTS,
  READ_THREAD_RETRY_BASE_DELAY_MS,
  READ_THREAD_RETRY_MAX_DELAY_MS,
  THREAD_LIST_LIMIT,
  THREAD_LIST_MAX_PAGES,
  THREAD_LIST_PRESENTATION_EXECUTION_MODE,
  THREAD_ONLY_HISTORY_METHOD_NAMES,
  THREAD_QUERY_CACHE_MAXIMUM_ENTRIES,
  THREAD_QUERY_CACHE_TIME_TO_LIVE_MS,
  UNSUPPORTED_PUSH_CLIENT_STATE,
  VISIBLE_CHAT_ITEMS_STEP,
} from "@/Application/Configuration/ApplicationBehaviorConfiguration";
import {
  type ApplicationRouteState,
  ApplicationRouteStateMapper,
} from "@/Application/DomainModel/ApplicationRouteStateMapper";
import type { CoreDataModesResponse } from "@/Application/StateManagement/CoreDataSnapshotContracts";
import { useApplicationDerivedState } from "@/Application/StateManagement/UseApplicationDerivedState";
import { useApplicationOwnerDependencies } from "@/Application/StateManagement/UseApplicationOwnerDependencies";
import {
  useApplicationFormattingHelpers,
  useStreamEventCards,
} from "@/Application/StateManagement/UseApplicationPresentationHelpers";
import { useApplicationRuntimeComposition } from "@/Application/StateManagement/UseApplicationRuntimeComposition";
import { useApplicationRuntimeRequestHandlers } from "@/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import { useApplicationShellState } from "@/Application/StateManagement/UseApplicationShellState";
import {
  type CoreDataCapabilitySnapshot,
  useCoreDataLoaders,
} from "@/Application/StateManagement/UseCoreDataLoaders";
import { ApplicationShellLayout } from "@/Application/UserInterface/ApplicationShellLayout";
import { TooltipProvider } from "@/Components/UserInterface/Tooltip";
import { ConversationSyncSignatureBuilder } from "@/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { useSelectedThreadLoaders } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import { useTheme } from "@/Features/Theme/StateManagement/UseTheme";
import { LastViewedThreadPreferenceStore } from "@/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
import { ThreadDisplayNamePreferenceStore } from "@/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";

const modeSelectionStateResolver = new ModeSelectionStateResolver();
const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
  modeSelectionStateResolver,
);
const applicationRouteStateMapper = new ApplicationRouteStateMapper();
const APPLICATION_SHELL_TOOLTIP_DELAY_MILLISECONDS = 120;
const THREAD_ONLY_HISTORY_METHOD_IDENTIFIERS = Array.from(THREAD_ONLY_HISTORY_METHOD_NAMES);
const APPLICATION_CHAT_HOME_PATH = "/";

function shouldRestoreLastViewedThreadIdentifierFromPath(
  pathname: string,
  routeState: ApplicationRouteState,
): boolean {
  return pathname === APPLICATION_CHAT_HOME_PATH && routeState.threadId === null;
}

function readPersistedThreadIdentifierOrNull(
  lastViewedThreadPreferenceStore: LastViewedThreadPreferenceStore,
): string | null {
  try {
    return lastViewedThreadPreferenceStore.readLastViewedThreadIdentifier();
  } catch {
    try {
      lastViewedThreadPreferenceStore.clearLastViewedThreadIdentifier();
    } catch {
      // Ignore storage cleanup errors so startup navigation state remains deterministic.
    }
    return null;
  }
}

/**
 * Select the initial startup mode key, preferring a non-plan option when available.
 * This preserves chat-first startup while still honoring plan-only agent capability sets.
 */
export function readInitialModeKeyFromModes(availableModes: CoreDataModesResponse["data"]): string {
  const nonPlanDefault = availableModes.find(
    (mode) => !modeSelectionStateResolver.isPlanModeOption(mode),
  );
  return nonPlanDefault?.mode ?? availableModes[0]?.mode ?? "";
}

export function App(): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme();
  const lastViewedThreadPreferenceStore = useMemo(() => new LastViewedThreadPreferenceStore(), []);
  const threadDisplayNamePreferenceStore = useMemo(
    () => new ThreadDisplayNamePreferenceStore(),
    [],
  );
  const initialUiState = useMemo(() => {
    const pathname = window.location.pathname;
    const routeState = applicationRouteStateMapper.parseFromLocation(
      pathname,
      window.location.search,
    );
    if (!shouldRestoreLastViewedThreadIdentifierFromPath(pathname, routeState)) {
      return routeState;
    }
    const persistedThreadIdentifier = readPersistedThreadIdentifierOrNull(
      lastViewedThreadPreferenceStore,
    );
    if (persistedThreadIdentifier === null) {
      return routeState;
    }
    return {
      threadId: persistedThreadIdentifier,
      tab: routeState.tab,
      settingsWorkspaceSection: routeState.settingsWorkspaceSection,
    };
  }, [lastViewedThreadPreferenceStore]);

  const applicationShellState = useApplicationShellState({
    initialUiState,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    initialVisibleChatItems: INITIAL_VISIBLE_CHAT_ITEMS,
    initialIsMobileLayout: window.innerWidth <= MOBILE_LAYOUT_MAXIMUM_WIDTH_PX,
  });

  const applicationOwnerDependencies = useApplicationOwnerDependencies<CoreDataCapabilitySnapshot>({
    setErrorMessage: applicationShellState.setError,
    modeSelectionStateResolver,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    lastViewedThreadPreferenceStore,
    threadDisplayNamePreferenceStore,
    threadOnlyHistoryMethods: THREAD_ONLY_HISTORY_METHOD_IDENTIFIERS,
    eventStreamRefreshDecisionExecutionMode: EVENT_STREAM_REFRESH_DECISION_EXECUTION_MODE,
    threadListPresentationExecutionMode: THREAD_LIST_PRESENTATION_EXECUTION_MODE,
    debugIssueDerivationExecutionMode: DEBUG_ISSUE_DERIVATION_EXECUTION_MODE,
    conversationItemFlatteningExecutionMode: CONVERSATION_ITEM_FLATTENING_EXECUTION_MODE,
    eventRefreshScheduleDelayMilliseconds: EVENT_REFRESH_SCHEDULE_DELAY_MS,
    mobileVisualViewportKeyboardOpenDeltaPx: MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX,
    mobileLayoutMaximumWidthPx: MOBILE_LAYOUT_MAXIMUM_WIDTH_PX,
    mobileSidebarSwipeEdgePx: MOBILE_SIDEBAR_SWIPE_EDGE_PX,
    mobileSidebarSwipeTriggerPx: MOBILE_SIDEBAR_SWIPE_TRIGGER_PX,
    mobileSidebarSwipeMaximumVerticalDriftPx: MOBILE_SIDEBAR_SWIPE_MAXIMUM_VERTICAL_DRIFT_PX,
    mobileSidebarSwipeCancelNegativePx: MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX,
    capabilitySnapshotRefreshIntervalMilliseconds: CAPABILITY_REFRESH_INTERVAL_MS,
    chatScrollBottomThresholdPx: CHAT_SCROLL_BOTTOM_THRESHOLD_PX,
    readThreadRetryMaximumAttempts: READ_THREAD_RETRY_ATTEMPTS,
    readThreadRetryBaseDelayMilliseconds: READ_THREAD_RETRY_BASE_DELAY_MS,
    readThreadRetryMaximumDelayMilliseconds: READ_THREAD_RETRY_MAX_DELAY_MS,
    threadQueryCacheTimeToLiveMilliseconds: THREAD_QUERY_CACHE_TIME_TO_LIVE_MS,
    threadQueryCacheMaximumEntries: THREAD_QUERY_CACHE_MAXIMUM_ENTRIES,
    pushDiagnosticsRefreshTimeToLiveMilliseconds: PUSH_DIAGNOSTICS_REFRESH_TIME_TO_LIVE_MS,
  });

  const applicationDerivedState = useApplicationDerivedState({
    threads: applicationShellState.threads,
    archivedThreads: applicationShellState.archivedThreads,
    selectedThreadId: applicationShellState.selectedThreadId,
    selectedRequestId: applicationShellState.selectedRequestId,
    selectedAgentId: applicationShellState.selectedAgentId,
    selectedModeKey: applicationShellState.selectedModeKey,
    selectedModelId: applicationShellState.selectedModelId,
    selectedReasoningEffort: applicationShellState.selectedReasoningEffort,
    visibleChatItemLimit: applicationShellState.visibleChatItemLimit,
    isCoreLoading: applicationShellState.isCoreLoading,
    isSelectedThreadLoading: applicationShellState.isSelectedThreadLoading,
    debugIssueSeverityFilter: applicationShellState.debugIssueSeverityFilter,
    debugIssueFilterQuery: applicationShellState.debugIssueFilterQuery,
    selectedDebugIssueId: applicationShellState.selectedDebugIssueId,
    health: applicationShellState.health,
    configDefaults: applicationShellState.configDefaults,
    liveState: applicationShellState.liveState,
    readThreadState: applicationShellState.readThreadState,
    modes: applicationShellState.modes,
    models: applicationShellState.models,
    agentDescriptors: applicationShellState.agentDescriptors,
    history: applicationShellState.history,
    historyDetail: applicationShellState.historyDetail,
    debugErrors: applicationShellState.debugErrors,
    traceStatus: applicationShellState.traceStatus,
    errorMessage: applicationShellState.error,
    defaultEffortOptions: DEFAULT_EFFORT_OPTIONS,
    assumedAppDefaultModelIdentifier: ASSUMED_APP_DEFAULT_MODEL_IDENTIFIER,
    assumedAppDefaultReasoningEffort: ASSUMED_APP_DEFAULT_REASONING_EFFORT,
    modeSelectionStateResolver,
    conversationSyncSignatureBuilder,
    pendingUserInputRequestSelector: applicationOwnerDependencies.pendingUserInputRequestSelector,
    conversationItemFlattener: applicationOwnerDependencies.conversationItemFlattener,
    conversationItemFlatteningWorkerOwner:
      applicationOwnerDependencies.conversationItemFlatteningWorkerOwner,
    debugIssueStateResolver: applicationOwnerDependencies.debugIssueStateResolver,
    debugIssueDerivationWorkerOwner: applicationOwnerDependencies.debugIssueDerivationWorkerOwner,
    threadListPresentationWorkerOwner:
      applicationOwnerDependencies.threadListPresentationWorkerOwner,
    threadListStateController: applicationOwnerDependencies.threadListStateController,
  });

  const shouldRenderStreamEventCards =
    applicationShellState.activeTab === "debug" &&
    applicationShellState.settingsWorkspaceSection === "debug" &&
    applicationShellState.debugWorkspaceSection === "stream";
  const streamEventCards = useStreamEventCards({
    streamEvents: applicationShellState.streamEvents,
    streamEventCardsEnabled: shouldRenderStreamEventCards,
  });

  const runtimeRequestHandlers = useApplicationRuntimeRequestHandlers({
    trackedUserInterfaceErrorReporter:
      applicationOwnerDependencies.trackedUserInterfaceErrorReporter,
    userInterfaceActionRequestBuilder:
      applicationOwnerDependencies.userInterfaceActionRequestBuilder,
    webShellSessionBootstrapClient: applicationOwnerDependencies.webShellSessionBootstrapClient,
    apiAuthenticationErrorClassifier: applicationOwnerDependencies.apiAuthenticationErrorClassifier,
    apiSessionBootstrapCoordinator: applicationOwnerDependencies.apiSessionBootstrapCoordinator,
    requiresApiSessionToken: applicationShellState.requiresApiSessionToken,
    apiSessionBootstrapErrorMessage: applicationShellState.apiSessionBootstrapError,
    setRequiresApiSessionToken: applicationShellState.setRequiresApiSessionToken,
    setApiSessionBootstrapErrorMessage: applicationShellState.setApiSessionBootstrapError,
    setErrorMessage: applicationShellState.setError,
  });

  const { renderAgentFavicon, formatDateValue } = useApplicationFormattingHelpers({
    dateValueFormatter: applicationOwnerDependencies.dateValueFormatter,
  });

  const coreDataLoaders = useCoreDataLoaders({
    debugHistoryLimit: DEBUG_HISTORY_LIMIT,
    debugErrorListLimit: DEBUG_ERROR_LIST_LIMIT,
    threadListLimit: THREAD_LIST_LIMIT,
    threadListMaxPages: THREAD_LIST_MAX_PAGES,
    archivedThreadListMaxPages: ARCHIVED_THREAD_LIST_MAX_PAGES,
    capabilityServerClient: applicationOwnerDependencies.capabilityServerClient,
    capabilitySnapshotCache: applicationOwnerDependencies.capabilitySnapshotCache,
    threadListStateController: applicationOwnerDependencies.threadListStateController,
    debugServerClient: applicationOwnerDependencies.debugServerClient,
    debugWorkspaceDataReader: applicationOwnerDependencies.debugWorkspaceDataReader,
    debugWorkspaceStateStore: applicationOwnerDependencies.debugWorkspaceStateStore,
    deferredResourceCacheOwner: applicationOwnerDependencies.deferredResourceCacheOwner,
    coreDataRefreshConcurrencyCoordinator:
      applicationOwnerDependencies.coreDataRefreshConcurrencyCoordinator,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    activeTabRef: applicationShellState.activeTabRef,
    unreadThreadIdsRef: applicationShellState.unreadThreadIdsRef,
    debugErrorsSignatureRef: applicationShellState.debugErrorsSignatureRef,
    modesSignatureRef: applicationShellState.modesSignatureRef,
    modelsSignatureRef: applicationShellState.modelsSignatureRef,
    hasHydratedAgentSelectionRef: applicationShellState.hasHydratedAgentSelectionRef,
    isArchivedThreadsOpenRef: applicationShellState.isArchivedThreadsOpenRef,
    hasLoadedArchivedThreadsRef: applicationShellState.hasLoadedArchivedThreadsRef,
    lastCoreRefreshAtRef: applicationShellState.lastCoreRefreshAtRef,
    setHealth: applicationShellState.setHealth,
    setThreads: applicationShellState.setThreads,
    setUnreadThreadIds: applicationShellState.setUnreadThreadIds,
    setModes: applicationShellState.setModes,
    setModels: applicationShellState.setModels,
    setConfigDefaults: applicationShellState.setConfigDefaults,
    setTraceStatus: applicationShellState.setTraceStatus,
    setHistory: applicationShellState.setHistory,
    setDebugErrors: applicationShellState.setDebugErrors,
    setDebugErrorSessionId: applicationShellState.setDebugErrorSessionId,
    setDebugErrorSessionLogPath: applicationShellState.setDebugErrorSessionLogPath,
    setAgentDescriptors: applicationShellState.setAgentDescriptors,
    setSelectedAgentId: applicationShellState.setSelectedAgentId,
    setSelectedThreadId: applicationShellState.setSelectedThreadId,
    setSelectedModeKey: applicationShellState.setSelectedModeKey,
    setIsArchivedThreadsLoading: applicationShellState.setIsArchivedThreadsLoading,
    setArchivedThreads: applicationShellState.setArchivedThreads,
    setArchivedThreadsTruncated: applicationShellState.setArchivedThreadsTruncated,
    setHasLoadedArchivedThreads: applicationShellState.setHasLoadedArchivedThreads,
    ensureApiSessionBootstrapped: runtimeRequestHandlers.ensureApiSessionBootstrapped,
    buildActionRequestOptions: runtimeRequestHandlers.buildActionRequestOptions,
    readInitialModeKey: readInitialModeKeyFromModes,
    handleRuntimeRequestError: runtimeRequestHandlers.handleRuntimeRequestError,
  });

  const {
    applyCachedSelectedThreadSnapshot,
    hasAppliedSelectedThreadSnapshot,
    loadSelectedThreadTracked,
    applySelectedThreadStreamDelta,
  } = useSelectedThreadLoaders({
    threads: applicationShellState.threads,
    selectedAgentId: applicationShellState.selectedAgentId,
    agentsById: applicationDerivedState.agentsById,
    appDefaultModel: applicationDerivedState.appDefaultModel,
    appDefaultReasoningEffort: applicationDerivedState.appDefaultReasoningEffort,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    pendingThreadMaterializationCoordinator:
      applicationShellState.pendingThreadMaterializationCoordinator,
    conversationSyncSignatureBuilder,
    selectedThreadDataRefreshCoordinator:
      applicationOwnerDependencies.selectedThreadDataRefreshCoordinator,
    selectedThreadRefreshConcurrencyCoordinator:
      applicationOwnerDependencies.selectedThreadRefreshConcurrencyCoordinator,
    readThreadStateMerger: applicationOwnerDependencies.readThreadStateMerger,
    chatServerClient: applicationOwnerDependencies.chatServerClient,
    selectedThreadSnapshotCacheStore: applicationOwnerDependencies.selectedThreadSnapshotCacheStore,
    threadDisplayNameStateOwner: applicationOwnerDependencies.threadDisplayNameStateOwner,
    setLiveState: applicationShellState.setLiveState,
    setReadThreadState: applicationShellState.setReadThreadState,
    setStreamEvents: applicationShellState.setStreamEvents,
  });

  const runtimeComposition = useApplicationRuntimeComposition({
    theme,
    toggleTheme,
    appDefaultValue: APP_DEFAULT_VALUE,
    initialVisibleChatItems: INITIAL_VISIBLE_CHAT_ITEMS,
    visibleChatItemsStep: VISIBLE_CHAT_ITEMS_STEP,
    coreRefreshIntervalMs: CORE_REFRESH_INTERVAL_MS,
    coreRefreshConnectedMinIntervalMs: CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS,
    debugHistoryLimit: DEBUG_HISTORY_LIMIT,
    debugErrorListLimit: DEBUG_ERROR_LIST_LIMIT,
    applicationRouteStateMapper,
    applicationShellState,
    applicationDerivedState,
    applicationOwnerDependencies,
    runtimeRequestHandlers,
    coreDataLoaders,
    applyCachedSelectedThreadSnapshot,
    hasAppliedSelectedThreadSnapshot,
    loadSelectedThreadTracked,
    applySelectedThreadStreamDelta,
    streamEventCards,
    renderAgentFavicon,
    formatDateValue,
  });
  const { shellComposition } = runtimeComposition;

  const handleCloseMobileSidebar = useCallback((): void => {
    applicationShellState.setMobileSidebarOpen(false);
  }, [applicationShellState.setMobileSidebarOpen]);

  const handleHideDesktopSidebar = useCallback((): void => {
    applicationShellState.setDesktopSidebarOpen(false);
  }, [applicationShellState.setDesktopSidebarOpen]);

  return (
    <TooltipProvider delayDuration={APPLICATION_SHELL_TOOLTIP_DELAY_MILLISECONDS}>
      <ApplicationShellLayout
        applicationShellElementRef={applicationShellState.applicationShellElementRef}
        onAppShellTouchStart={shellComposition.handleAppShellTouchStart}
        onAppShellTouchMove={shellComposition.handleAppShellTouchMove}
        onEndSidebarSwipeTracking={shellComposition.endSidebarSwipeTracking}
        isMobileLayout={applicationShellState.isMobileLayout}
        mobileSidebarOpen={applicationShellState.mobileSidebarOpen}
        desktopSidebarOpen={applicationShellState.desktopSidebarOpen}
        onCloseMobileSidebar={handleCloseMobileSidebar}
        onHideDesktopSidebar={handleHideDesktopSidebar}
        threadListPaneProperties={shellComposition.threadListPaneProperties}
        allSystemsReady={applicationDerivedState.allSystemsReady}
        hasAnySystemFailure={applicationDerivedState.hasAnySystemFailure}
        commitLabel={applicationDerivedState.commitLabel}
        agentDescriptors={applicationShellState.agentDescriptors}
        codexConfigured={applicationDerivedState.codexConfigured}
        threadSidebarHealthState={shellComposition.threadSidebarHealthState}
        threadSidebarRuntimeSummary={shellComposition.threadSidebarRuntimeSummary}
        activeTab={applicationShellState.activeTab}
        applicationHeaderBarProperties={shellComposition.applicationHeaderBarProperties}
        debugStatusBannersProperties={shellComposition.debugStatusBannersProperties}
        chatWorkspacePaneProperties={shellComposition.chatWorkspacePaneProperties}
        settingsWorkspacePaneProperties={shellComposition.settingsWorkspacePaneProperties}
        showApiSessionBootstrapOverlay={applicationShellState.requiresApiSessionToken}
        apiSessionBootstrapOverlayProperties={shellComposition.apiSessionBootstrapOverlayProperties}
      />
    </TooltipProvider>
  );
}
