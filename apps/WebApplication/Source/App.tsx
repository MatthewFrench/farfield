import {
  useMemo
} from "react";
import {
  APP_DEFAULT_VALUE,
  ARCHIVED_THREAD_LIST_MAX_PAGES,
  ASSUMED_APP_DEFAULT_MODEL_IDENTIFIER,
  ASSUMED_APP_DEFAULT_REASONING_EFFORT,
  CAPABILITY_REFRESH_INTERVAL_MS,
  CHAT_SCROLL_BOTTOM_THRESHOLD_PX,
  CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS,
  CORE_REFRESH_INTERVAL_MS,
  DEBUG_ERROR_LIST_LIMIT,
  DEBUG_HISTORY_LIMIT,
  DEFAULT_EFFORT_OPTIONS,
  EVENT_REFRESH_SCHEDULE_DELAY_MS,
  INITIAL_VISIBLE_CHAT_ITEMS,
  MOBILE_LAYOUT_MAXIMUM_WIDTH_PX,
  MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX,
  MOBILE_SIDEBAR_SWIPE_EDGE_PX,
  MOBILE_SIDEBAR_SWIPE_MAXIMUM_VERTICAL_DRIFT_PX,
  MOBILE_SIDEBAR_SWIPE_TRIGGER_PX,
  MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX,
  READ_THREAD_RETRY_ATTEMPTS,
  READ_THREAD_RETRY_BASE_DELAY_MS,
  READ_THREAD_RETRY_MAX_DELAY_MS,
  THREAD_LIST_LIMIT,
  THREAD_LIST_MAX_PAGES,
  THREAD_ONLY_HISTORY_METHOD_NAMES,
  THREAD_QUERY_CACHE_MAXIMUM_ENTRIES,
  THREAD_QUERY_CACHE_TIME_TO_LIVE_MS,
  UNSUPPORTED_PUSH_CLIENT_STATE,
  VISIBLE_CHAT_ITEMS_STEP
} from "@/Application/Configuration/ApplicationBehaviorConfiguration";
import { ApplicationRouteStateMapper } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import {
  type CoreDataCapabilitySnapshot,
  useCoreDataLoaders
} from "@/Application/StateManagement/UseCoreDataLoaders";
import {
  useApplicationDerivedState
} from "@/Application/StateManagement/UseApplicationDerivedState";
import {
  useApplicationOwnerDependencies
} from "@/Application/StateManagement/UseApplicationOwnerDependencies";
import {
  useApplicationRuntimeRequestHandlers
} from "@/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import {
  useApplicationRuntimeComposition
} from "@/Application/StateManagement/UseApplicationRuntimeComposition";
import {
  useApplicationShellState
} from "@/Application/StateManagement/UseApplicationShellState";
import {
  useApplicationFormattingHelpers,
  useStreamEventCards
} from "@/Application/StateManagement/UseApplicationPresentationHelpers";
import {
  ApplicationShellLayout
} from "@/Application/UserInterface/ApplicationShellLayout";
import { ConversationSyncSignatureBuilder } from "@/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import {
  useSelectedThreadLoaders
} from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import { useTheme } from "@/Features/Theme/StateManagement/UseTheme";
import {
  TooltipProvider
} from "@/Components/UserInterface/Tooltip";

const modeSelectionStateResolver = new ModeSelectionStateResolver();
const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(modeSelectionStateResolver);
const applicationRouteStateMapper = new ApplicationRouteStateMapper();

export function App(): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme();
  const initialUiState = useMemo(
    () => applicationRouteStateMapper.parseFromPathname(window.location.pathname),
    []
  );

  const applicationShellState = useApplicationShellState({
    initialUiState,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    initialVisibleChatItems: INITIAL_VISIBLE_CHAT_ITEMS
  });

  const applicationOwnerDependencies = useApplicationOwnerDependencies<CoreDataCapabilitySnapshot>({
    setErrorMessage: applicationShellState.setError,
    modeSelectionStateResolver,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    threadOnlyHistoryMethods: Array.from(THREAD_ONLY_HISTORY_METHOD_NAMES),
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
    threadQueryCacheMaximumEntries: THREAD_QUERY_CACHE_MAXIMUM_ENTRIES
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
    debugIssueStateResolver: applicationOwnerDependencies.debugIssueStateResolver,
    threadListStateController: applicationOwnerDependencies.threadListStateController
  });

  const streamEventCards = useStreamEventCards({
    streamEvents: applicationShellState.streamEvents
  });

  const runtimeRequestHandlers = useApplicationRuntimeRequestHandlers({
    trackedUserInterfaceErrorReporter: applicationOwnerDependencies.trackedUserInterfaceErrorReporter,
    userInterfaceActionRequestBuilder: applicationOwnerDependencies.userInterfaceActionRequestBuilder,
    apiAuthenticationErrorClassifier: applicationOwnerDependencies.apiAuthenticationErrorClassifier,
    apiSessionBootstrapCoordinator: applicationOwnerDependencies.apiSessionBootstrapCoordinator,
    requiresApiSessionToken: applicationShellState.requiresApiSessionToken,
    apiSessionBootstrapErrorMessage: applicationShellState.apiSessionBootstrapError,
    setRequiresApiSessionToken: applicationShellState.setRequiresApiSessionToken,
    setApiSessionBootstrapErrorMessage: applicationShellState.setApiSessionBootstrapError,
    setErrorMessage: applicationShellState.setError
  });

  const {
    renderAgentFavicon,
    formatDateValue
  } = useApplicationFormattingHelpers({
    dateValueFormatter: applicationOwnerDependencies.dateValueFormatter
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
    coreDataRefreshConcurrencyCoordinator: applicationOwnerDependencies.coreDataRefreshConcurrencyCoordinator,
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
    loadCoreDataTrackedRef: applicationShellState.loadCoreDataTrackedRef,
    loadSelectedThreadRef: applicationShellState.loadSelectedThreadRef,
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
    setIsCoreLoading: applicationShellState.setIsCoreLoading,
    ensureApiSessionBootstrapped: runtimeRequestHandlers.ensureApiSessionBootstrapped,
    readInitialModeKey: (availableModes) => {
      const nonPlanDefault = availableModes.find((mode) => !modeSelectionStateResolver.isPlanModeOption(mode));
      return nonPlanDefault?.mode ?? availableModes[0]?.mode ?? "";
    },
    handleRuntimeRequestError: runtimeRequestHandlers.handleRuntimeRequestError
  });

  const {
    loadSelectedThreadTracked
  } = useSelectedThreadLoaders({
    threads: applicationShellState.threads,
    selectedAgentId: applicationShellState.selectedAgentId,
    agentsById: applicationDerivedState.agentsById,
    appDefaultModel: applicationDerivedState.appDefaultModel,
    appDefaultReasoningEffort: applicationDerivedState.appDefaultReasoningEffort,
    selectedThreadIdRef: applicationShellState.selectedThreadIdRef,
    pendingThreadMaterializationCoordinator: applicationShellState.pendingThreadMaterializationCoordinator,
    conversationSyncSignatureBuilder,
    selectedThreadDataRefreshCoordinator: applicationOwnerDependencies.selectedThreadDataRefreshCoordinator,
    selectedThreadRefreshConcurrencyCoordinator: applicationOwnerDependencies.selectedThreadRefreshConcurrencyCoordinator,
    readThreadStateMerger: applicationOwnerDependencies.readThreadStateMerger,
    chatServerClient: applicationOwnerDependencies.chatServerClient,
    setLiveState: applicationShellState.setLiveState,
    setReadThreadState: applicationShellState.setReadThreadState,
    setStreamEvents: applicationShellState.setStreamEvents
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
    loadSelectedThreadTracked,
    streamEventCards,
    renderAgentFavicon,
    formatDateValue
  });

  return (
    <TooltipProvider delayDuration={120}>
      <ApplicationShellLayout
        applicationShellElementRef={applicationShellState.applicationShellElementRef}
        onAppShellTouchStart={runtimeComposition.shellComposition.handleAppShellTouchStart}
        onAppShellTouchMove={runtimeComposition.shellComposition.handleAppShellTouchMove}
        onEndSidebarSwipeTracking={runtimeComposition.shellComposition.endSidebarSwipeTracking}
        mobileSidebarOpen={applicationShellState.mobileSidebarOpen}
        desktopSidebarOpen={applicationShellState.desktopSidebarOpen}
        onCloseMobileSidebar={() => {
          applicationShellState.setMobileSidebarOpen(false);
        }}
        onHideDesktopSidebar={() => {
          applicationShellState.setDesktopSidebarOpen(false);
        }}
        threadListPaneProperties={runtimeComposition.shellComposition.threadListPaneProperties}
        allSystemsReady={applicationDerivedState.allSystemsReady}
        hasAnySystemFailure={applicationDerivedState.hasAnySystemFailure}
        commitLabel={applicationDerivedState.commitLabel}
        agentDescriptors={applicationShellState.agentDescriptors}
        codexConfigured={applicationDerivedState.codexConfigured}
        threadSidebarHealthState={runtimeComposition.shellComposition.threadSidebarHealthState}
        activeTab={applicationShellState.activeTab}
        applicationHeaderBarProperties={runtimeComposition.shellComposition.applicationHeaderBarProperties}
        debugStatusBannersProperties={runtimeComposition.shellComposition.debugStatusBannersProperties}
        chatWorkspacePaneProperties={runtimeComposition.shellComposition.chatWorkspacePaneProperties}
        debugWorkspacePaneProperties={runtimeComposition.shellComposition.debugWorkspacePaneProperties}
        showApiSessionBootstrapOverlay={applicationShellState.requiresApiSessionToken}
        apiSessionBootstrapOverlayProperties={runtimeComposition.shellComposition.apiSessionBootstrapOverlayProperties}
      />
    </TooltipProvider>
  );
}
