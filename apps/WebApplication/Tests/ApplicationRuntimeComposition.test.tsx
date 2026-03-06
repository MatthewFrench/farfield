import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface PushFeatureCompositionMock {
  submitApiSessionToken: () => Promise<void>;
  refreshPushClientState: () => Promise<void>;
  ensureFreshPushSettingsDiagnostics: () => Promise<void>;
  refreshPushSettingsDiagnostics: () => Promise<void>;
  enablePushNotificationsFromToolbar: () => Promise<void>;
  sendPushTestNotificationFromSettings: (input: {
    threadId: string;
    turnId: string;
  }) => Promise<void>;
}

interface ChatFeatureCompositionMock {
  submitMessage: (draft: string) => Promise<void>;
  steerMessage: (draft: string) => Promise<void>;
  applyModeDraft: (draft: {
    modeKey: string;
    modelId: string;
    reasoningEffort: string;
  }) => Promise<void>;
  submitPendingRequest: () => Promise<void>;
  skipPendingRequest: () => Promise<void>;
  runInterrupt: () => Promise<void>;
  handleAnswerChange: (questionId: string, field: "option" | "freeform", value: string) => void;
  chatModeToolbarProperties: {
    isModeSyncing: boolean;
  };
}

interface DebugFeatureCompositionMock {
  loadHistoryDetail: (historyEntryId: string) => Promise<void>;
  replayHistoryEntryFromDetail: (input: {
    historyEntryId: string;
    direction: "request" | "response";
    waitForResponse: boolean;
  }) => void;
  clearDebugIssuesFromPanel: () => void;
  startTraceFromDebugPanel: () => void;
  markTraceFromDebugPanel: () => void;
  stopTraceFromDebugPanel: () => void;
  openDebugFromErrorBanner: () => void;
}

interface ApplicationRefreshEffectsCapture {
  refreshPushClientState: () => Promise<void>;
  ensureFreshPushSettingsDiagnostics: () => Promise<void>;
  loadCoreDataTracked: () => Promise<void>;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
  refreshSelectedThreadIncrementalIfPresent: () => Promise<void>;
}

interface ApplicationSynchronizationEffectsCapture {
  loadCoreDataTracked: () => Promise<void>;
  loadSelectedThreadTracked: (
    threadId: string,
    options?: {
      includeTurns?: boolean;
      includeReadThread?: boolean;
    },
  ) => Promise<void>;
  loadHistoryDetail: (historyEntryId: string) => Promise<void>;
}

interface SelectedThreadLifecycleEffectsCapture {
  readNextSelectedThreadIdentifierAfterLoadFailure: (
    failedThreadIdentifier: string,
  ) => string | null;
}

interface ApplicationShellCompositionCapture {
  chatFeatureComposition: ChatFeatureCompositionMock;
  debugFeatureComposition: DebugFeatureCompositionMock;
  pushFeatureComposition: PushFeatureCompositionMock;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
}

const hookMocks = vi.hoisted(() => ({
  useApplicationPushFeatureComposition: vi.fn(),
  useViewportShellEffects: vi.fn(),
  useApplicationRefreshEffects: vi.fn(),
  useSelectedThreadLifecycleEffects: vi.fn(),
  useEventStreamEffects: vi.fn(),
  useModeAndPendingRequestEffects: vi.fn(),
  useApplicationChatFeatureComposition: vi.fn(),
  useApplicationDebugFeatureComposition: vi.fn(),
  useApplicationSynchronizationEffects: vi.fn(),
  useApplicationShellComposition: vi.fn(),
}));

vi.mock("../Source/Application/StateManagement/UseApplicationPushFeatureComposition", () => ({
  useApplicationPushFeatureComposition: hookMocks.useApplicationPushFeatureComposition,
}));

vi.mock("../Source/Application/StateManagement/UseViewportShellEffects", () => ({
  useViewportShellEffects: hookMocks.useViewportShellEffects,
}));

vi.mock("../Source/Application/StateManagement/UseApplicationRefreshEffects", () => ({
  useApplicationRefreshEffects: hookMocks.useApplicationRefreshEffects,
}));

vi.mock("../Source/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects", () => ({
  useSelectedThreadLifecycleEffects: hookMocks.useSelectedThreadLifecycleEffects,
}));

vi.mock("../Source/Application/StateManagement/UseEventStreamEffects", () => ({
  useEventStreamEffects: hookMocks.useEventStreamEffects,
}));

vi.mock("../Source/Features/Chat/StateManagement/UseModeAndPendingRequestEffects", () => ({
  useModeAndPendingRequestEffects: hookMocks.useModeAndPendingRequestEffects,
}));

vi.mock("../Source/Application/StateManagement/UseApplicationChatFeatureComposition", () => ({
  useApplicationChatFeatureComposition: hookMocks.useApplicationChatFeatureComposition,
}));

vi.mock("../Source/Application/StateManagement/UseApplicationDebugFeatureComposition", () => ({
  useApplicationDebugFeatureComposition: hookMocks.useApplicationDebugFeatureComposition,
}));

vi.mock("../Source/Application/StateManagement/UseApplicationSynchronizationEffects", () => ({
  useApplicationSynchronizationEffects: hookMocks.useApplicationSynchronizationEffects,
}));

vi.mock("../Source/Application/StateManagement/UseApplicationShellComposition", () => ({
  useApplicationShellComposition: hookMocks.useApplicationShellComposition,
}));

import { useMemo } from "react";
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
  PUSH_DIAGNOSTICS_REFRESH_TIME_TO_LIVE_MS,
  READ_THREAD_RETRY_ATTEMPTS,
  READ_THREAD_RETRY_BASE_DELAY_MS,
  READ_THREAD_RETRY_MAX_DELAY_MS,
  THREAD_LIST_LIMIT,
  THREAD_LIST_MAX_PAGES,
  THREAD_ONLY_HISTORY_METHOD_NAMES,
  THREAD_QUERY_CACHE_MAXIMUM_ENTRIES,
  THREAD_QUERY_CACHE_TIME_TO_LIVE_MS,
  UNSUPPORTED_PUSH_CLIENT_STATE,
  VISIBLE_CHAT_ITEMS_STEP,
} from "../Source/Application/Configuration/ApplicationBehaviorConfiguration";
import { ApplicationRouteStateMapper } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";
import { useApplicationDerivedState } from "../Source/Application/StateManagement/UseApplicationDerivedState";
import { useApplicationOwnerDependencies } from "../Source/Application/StateManagement/UseApplicationOwnerDependencies";
import {
  useApplicationFormattingHelpers,
  useStreamEventCards,
} from "../Source/Application/StateManagement/UseApplicationPresentationHelpers";
import { useApplicationRuntimeComposition } from "../Source/Application/StateManagement/UseApplicationRuntimeComposition";
import {
  type ApplicationRuntimeRequestHandlers,
  useApplicationRuntimeRequestHandlers,
} from "../Source/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import {
  type ApplicationShellState,
  useApplicationShellState,
} from "../Source/Application/StateManagement/UseApplicationShellState";
import {
  type CoreDataCapabilitySnapshot,
  type CoreDataLoaders,
  useCoreDataLoaders,
} from "../Source/Application/StateManagement/UseCoreDataLoaders";
import { ConversationSyncSignatureBuilder } from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import {
  type SelectedThreadLoaders,
  useSelectedThreadLoaders,
} from "../Source/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import { LastViewedThreadPreferenceStore } from "../Source/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
import { ThreadDisplayNamePreferenceStore } from "../Source/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";

interface RuntimeHarnessSnapshot {
  applicationShellState: ApplicationShellState;
  coreDataLoaders: CoreDataLoaders;
  applyCachedSelectedThreadSnapshot: SelectedThreadLoaders["applyCachedSelectedThreadSnapshot"];
  loadSelectedThreadTracked: SelectedThreadLoaders["loadSelectedThreadTracked"];
  applySelectedThreadStreamDelta: SelectedThreadLoaders["applySelectedThreadStreamDelta"];
  runtimeRequestHandlers: ApplicationRuntimeRequestHandlers;
}

let latestRuntimeHarnessSnapshot: RuntimeHarnessSnapshot | null = null;
let applicationRefreshEffectsCapture: ApplicationRefreshEffectsCapture | null = null;
let applicationSynchronizationEffectsCapture: ApplicationSynchronizationEffectsCapture | null =
  null;
let selectedThreadLifecycleEffectsCapture: SelectedThreadLifecycleEffectsCapture | null = null;
let applicationShellCompositionCapture: ApplicationShellCompositionCapture | null = null;

let pushFeatureCompositionMock: PushFeatureCompositionMock;
let chatFeatureCompositionMock: ChatFeatureCompositionMock;
let debugFeatureCompositionMock: DebugFeatureCompositionMock;

const modeSelectionStateResolver = new ModeSelectionStateResolver();
const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
  modeSelectionStateResolver,
);
const applicationRouteStateMapper = new ApplicationRouteStateMapper();
const runtimeHarnessLastViewedThreadPreferenceStore = new LastViewedThreadPreferenceStore(
  "test.runtime.last-viewed-thread.preference",
);
const runtimeHarnessThreadDisplayNamePreferenceStore = new ThreadDisplayNamePreferenceStore(
  "test.runtime.thread-display-name.preference",
);

function createPushFeatureCompositionMock(): PushFeatureCompositionMock {
  return {
    submitApiSessionToken: vi.fn(async (): Promise<void> => {}),
    refreshPushClientState: vi.fn(async (): Promise<void> => {}),
    ensureFreshPushSettingsDiagnostics: vi.fn(async (): Promise<void> => {}),
    refreshPushSettingsDiagnostics: vi.fn(async (): Promise<void> => {}),
    enablePushNotificationsFromToolbar: vi.fn(async (): Promise<void> => {}),
    sendPushTestNotificationFromSettings: vi.fn(async (): Promise<void> => {}),
  };
}

function createChatFeatureCompositionMock(): ChatFeatureCompositionMock {
  return {
    submitMessage: vi.fn(async (_draft: string): Promise<void> => {}),
    steerMessage: vi.fn(async (_draft: string): Promise<void> => {}),
    applyModeDraft: vi.fn(async (_draft): Promise<void> => {}),
    submitPendingRequest: vi.fn(async (): Promise<void> => {}),
    skipPendingRequest: vi.fn(async (): Promise<void> => {}),
    runInterrupt: vi.fn(async (): Promise<void> => {}),
    handleAnswerChange: vi.fn(),
    chatModeToolbarProperties: {
      isModeSyncing: false,
    },
  };
}

function createDebugFeatureCompositionMock(): DebugFeatureCompositionMock {
  return {
    loadHistoryDetail: vi.fn(async (_historyEntryId: string): Promise<void> => {}),
    replayHistoryEntryFromDetail: vi.fn(),
    clearDebugIssuesFromPanel: vi.fn(),
    startTraceFromDebugPanel: vi.fn(),
    markTraceFromDebugPanel: vi.fn(),
    stopTraceFromDebugPanel: vi.fn(),
    openDebugFromErrorBanner: vi.fn(),
  };
}

function RuntimeCompositionHarness(): React.JSX.Element {
  const initialUiState = useMemo(() => applicationRouteStateMapper.parseFromPathname("/"), []);

  const applicationShellState = useApplicationShellState({
    initialUiState,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    initialVisibleChatItems: INITIAL_VISIBLE_CHAT_ITEMS,
    initialIsMobileLayout: false,
  });

  const applicationOwnerDependencies = useApplicationOwnerDependencies<CoreDataCapabilitySnapshot>({
    setErrorMessage: applicationShellState.setError,
    modeSelectionStateResolver,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    lastViewedThreadPreferenceStore: runtimeHarnessLastViewedThreadPreferenceStore,
    threadDisplayNamePreferenceStore: runtimeHarnessThreadDisplayNamePreferenceStore,
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
    debugIssueStateResolver: applicationOwnerDependencies.debugIssueStateResolver,
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
    readInitialModeKey: (availableModes) => {
      const nonPlanDefault = availableModes.find(
        (mode) => !modeSelectionStateResolver.isPlanModeOption(mode),
      );
      return nonPlanDefault?.mode ?? availableModes[0]?.mode ?? "";
    },
    handleRuntimeRequestError: runtimeRequestHandlers.handleRuntimeRequestError,
  });

  const {
    applyCachedSelectedThreadSnapshot,
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

  const { renderAgentFavicon, formatDateValue } = useApplicationFormattingHelpers({
    dateValueFormatter: applicationOwnerDependencies.dateValueFormatter,
  });

  useApplicationRuntimeComposition({
    theme: "dark",
    toggleTheme: () => {},
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
    loadSelectedThreadTracked,
    applySelectedThreadStreamDelta,
    streamEventCards,
    renderAgentFavicon,
    formatDateValue,
  });

  latestRuntimeHarnessSnapshot = {
    applicationShellState,
    coreDataLoaders,
    applyCachedSelectedThreadSnapshot,
    loadSelectedThreadTracked,
    applySelectedThreadStreamDelta,
    runtimeRequestHandlers,
  };

  return <div data-testid="runtime-composition-harness" />;
}

describe("useApplicationRuntimeComposition", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    latestRuntimeHarnessSnapshot = null;
    applicationRefreshEffectsCapture = null;
    applicationSynchronizationEffectsCapture = null;
    selectedThreadLifecycleEffectsCapture = null;
    applicationShellCompositionCapture = null;

    pushFeatureCompositionMock = createPushFeatureCompositionMock();
    chatFeatureCompositionMock = createChatFeatureCompositionMock();
    debugFeatureCompositionMock = createDebugFeatureCompositionMock();

    hookMocks.useApplicationPushFeatureComposition.mockReturnValue(pushFeatureCompositionMock);
    hookMocks.useApplicationChatFeatureComposition.mockReturnValue(chatFeatureCompositionMock);
    hookMocks.useApplicationDebugFeatureComposition.mockReturnValue(debugFeatureCompositionMock);

    hookMocks.useViewportShellEffects.mockImplementation((): void => {});
    hookMocks.useSelectedThreadLifecycleEffects.mockImplementation(
      (input: SelectedThreadLifecycleEffectsCapture): void => {
        selectedThreadLifecycleEffectsCapture = input;
      },
    );
    hookMocks.useEventStreamEffects.mockImplementation((): void => {});
    hookMocks.useModeAndPendingRequestEffects.mockImplementation((): void => {});

    hookMocks.useApplicationRefreshEffects.mockImplementation(
      (input: ApplicationRefreshEffectsCapture): void => {
        applicationRefreshEffectsCapture = input;
      },
    );

    hookMocks.useApplicationSynchronizationEffects.mockImplementation(
      (input: ApplicationSynchronizationEffectsCapture): void => {
        applicationSynchronizationEffectsCapture = input;
      },
    );

    hookMocks.useApplicationShellComposition.mockImplementation(
      (input: ApplicationShellCompositionCapture) => {
        applicationShellCompositionCapture = input;
        return {
          threadListPaneProperties: {
            threadListState: "ready",
          },
        };
      },
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("updates tracked loader refs and forwards feature compositions to shell composition", () => {
    render(<RuntimeCompositionHarness />);
    expect(screen.getByTestId("runtime-composition-harness")).toBeTruthy();

    const harnessSnapshot = latestRuntimeHarnessSnapshot;
    if (!harnessSnapshot) {
      throw new Error("Expected runtime harness snapshot to be captured");
    }

    expect(harnessSnapshot.applicationShellState.loadCoreDataTrackedRef.current).toBe(
      harnessSnapshot.coreDataLoaders.loadCoreDataTracked,
    );
    expect(harnessSnapshot.applicationShellState.loadSelectedThreadRef.current).toBe(
      harnessSnapshot.loadSelectedThreadTracked,
    );

    const shellCompositionInput = applicationShellCompositionCapture;
    if (!shellCompositionInput) {
      throw new Error("Expected shell composition input to be captured");
    }

    expect(shellCompositionInput.chatFeatureComposition).toBe(chatFeatureCompositionMock);
    expect(shellCompositionInput.debugFeatureComposition).toBe(debugFeatureCompositionMock);
    expect(shellCompositionInput.pushFeatureComposition).toBe(pushFeatureCompositionMock);
  });

  it("wires refresh and synchronization effects to composed feature handlers", () => {
    render(<RuntimeCompositionHarness />);

    const harnessSnapshot = latestRuntimeHarnessSnapshot;
    if (!harnessSnapshot) {
      throw new Error("Expected runtime harness snapshot to be captured");
    }

    const refreshEffectsInput = applicationRefreshEffectsCapture;
    if (!refreshEffectsInput) {
      throw new Error("Expected refresh effects input to be captured");
    }

    expect(refreshEffectsInput.loadCoreDataTracked).toBe(
      harnessSnapshot.coreDataLoaders.loadCoreDataTracked,
    );
    expect(refreshEffectsInput.refreshPushClientState).toBe(
      pushFeatureCompositionMock.refreshPushClientState,
    );
    expect(refreshEffectsInput.ensureFreshPushSettingsDiagnostics).toBe(
      pushFeatureCompositionMock.ensureFreshPushSettingsDiagnostics,
    );

    const shellCompositionInput = applicationShellCompositionCapture;
    if (!shellCompositionInput) {
      throw new Error("Expected shell composition input to be captured");
    }
    expect(shellCompositionInput.refreshCoreDataAndSelectedThread).toBe(
      refreshEffectsInput.refreshCoreDataAndSelectedThread,
    );

    const synchronizationEffectsInput = applicationSynchronizationEffectsCapture;
    if (!synchronizationEffectsInput) {
      throw new Error("Expected synchronization effects input to be captured");
    }

    expect(synchronizationEffectsInput.loadCoreDataTracked).toBe(
      harnessSnapshot.coreDataLoaders.loadCoreDataTracked,
    );
    expect(synchronizationEffectsInput.loadSelectedThreadTracked).toBe(
      harnessSnapshot.loadSelectedThreadTracked,
    );
    expect(synchronizationEffectsInput.loadHistoryDetail).toBe(
      debugFeatureCompositionMock.loadHistoryDetail,
    );
  });

  it("wires selected-thread load-failure recovery to choose the next available thread", () => {
    render(<RuntimeCompositionHarness />);
    const harnessSnapshot = latestRuntimeHarnessSnapshot;
    if (!harnessSnapshot) {
      throw new Error("Expected runtime harness snapshot to be captured");
    }

    act(() => {
      harnessSnapshot.applicationShellState.setThreads([
        {
          id: "thread-2",
          preview: "second",
          createdAt: 2,
          updatedAt: 2,
          agentId: "codex",
          hasUnreadTurn: null,
          isProjectRemoved: false,
        },
        {
          id: "thread-1",
          preview: "first",
          createdAt: 1,
          updatedAt: 1,
          agentId: "codex",
          hasUnreadTurn: null,
          isProjectRemoved: false,
        },
      ]);
    });

    const lifecycleEffectsInput = selectedThreadLifecycleEffectsCapture;
    if (!lifecycleEffectsInput) {
      throw new Error("Expected selected-thread lifecycle input to be captured");
    }

    expect(lifecycleEffectsInput.readNextSelectedThreadIdentifierAfterLoadFailure("thread-2")).toBe(
      "thread-1",
    );
    expect(lifecycleEffectsInput.readNextSelectedThreadIdentifierAfterLoadFailure("thread-1")).toBe(
      "thread-2",
    );
    expect(lifecycleEffectsInput.readNextSelectedThreadIdentifierAfterLoadFailure("missing")).toBe(
      "thread-2",
    );
  });

  it("reads current loader refs for each runtime refresh invocation", async () => {
    render(<RuntimeCompositionHarness />);
    const harnessSnapshot = latestRuntimeHarnessSnapshot;
    if (!harnessSnapshot) {
      throw new Error("Expected runtime harness snapshot to be captured");
    }
    const refreshEffectsInput = applicationRefreshEffectsCapture;
    if (!refreshEffectsInput) {
      throw new Error("Expected refresh effects input to be captured");
    }

    const firstCoreLoader = vi.fn(async (): Promise<void> => {});
    const secondCoreLoader = vi.fn(async (): Promise<void> => {});
    const firstSelectedThreadLoader = vi.fn(async (_threadId: string): Promise<void> => {});
    const secondSelectedThreadLoader = vi.fn(async (_threadId: string): Promise<void> => {});

    harnessSnapshot.applicationShellState.loadCoreDataTrackedRef.current = firstCoreLoader;
    harnessSnapshot.applicationShellState.loadSelectedThreadRef.current = firstSelectedThreadLoader;
    harnessSnapshot.applicationShellState.selectedThreadIdRef.current = "thread-1";
    await act(async (): Promise<void> => {
      await refreshEffectsInput.refreshCoreDataAndSelectedThread();
    });

    harnessSnapshot.applicationShellState.loadCoreDataTrackedRef.current = secondCoreLoader;
    harnessSnapshot.applicationShellState.loadSelectedThreadRef.current =
      secondSelectedThreadLoader;
    harnessSnapshot.applicationShellState.selectedThreadIdRef.current = "thread-2";
    await act(async (): Promise<void> => {
      await refreshEffectsInput.refreshCoreDataAndSelectedThread();
    });

    expect(firstCoreLoader).toHaveBeenCalledTimes(1);
    expect(secondCoreLoader).toHaveBeenCalledTimes(1);
    expect(firstSelectedThreadLoader).toHaveBeenCalledWith("thread-1", undefined);
    expect(secondSelectedThreadLoader).toHaveBeenCalledWith("thread-2", undefined);
  });

  it("reads current selected-thread loader ref for incremental refresh invocations", async () => {
    render(<RuntimeCompositionHarness />);
    const harnessSnapshot = latestRuntimeHarnessSnapshot;
    if (!harnessSnapshot) {
      throw new Error("Expected runtime harness snapshot to be captured");
    }
    const refreshEffectsInput = applicationRefreshEffectsCapture;
    if (!refreshEffectsInput) {
      throw new Error("Expected refresh effects input to be captured");
    }

    const firstSelectedThreadLoader = vi.fn(
      async (
        _threadId: string,
        _options?: {
          includeTurns?: boolean;
          includeReadThread?: boolean;
        },
      ): Promise<void> => {},
    );
    const secondSelectedThreadLoader = vi.fn(
      async (
        _threadId: string,
        _options?: {
          includeTurns?: boolean;
          includeReadThread?: boolean;
        },
      ): Promise<void> => {},
    );

    harnessSnapshot.applicationShellState.loadSelectedThreadRef.current = firstSelectedThreadLoader;
    harnessSnapshot.applicationShellState.selectedThreadIdRef.current = "thread-1";
    await act(async (): Promise<void> => {
      await refreshEffectsInput.refreshSelectedThreadIncrementalIfPresent();
    });

    harnessSnapshot.applicationShellState.loadSelectedThreadRef.current =
      secondSelectedThreadLoader;
    harnessSnapshot.applicationShellState.selectedThreadIdRef.current = "thread-2";
    await act(async (): Promise<void> => {
      await refreshEffectsInput.refreshSelectedThreadIncrementalIfPresent();
    });

    expect(firstSelectedThreadLoader).toHaveBeenCalledWith("thread-1", {
      includeReadThread: true,
      includeTurns: false,
    });
    expect(secondSelectedThreadLoader).toHaveBeenCalledWith("thread-2", {
      includeReadThread: true,
      includeTurns: false,
    });
  });

  it("reports invariant violation when selected-thread loader ref is missing", async () => {
    render(<RuntimeCompositionHarness />);
    const harnessSnapshot = latestRuntimeHarnessSnapshot;
    if (!harnessSnapshot) {
      throw new Error("Expected runtime harness snapshot to be captured");
    }
    const refreshEffectsInput = applicationRefreshEffectsCapture;
    if (!refreshEffectsInput) {
      throw new Error("Expected refresh effects input to be captured");
    }

    const coreLoader = vi.fn(async (): Promise<void> => {});
    harnessSnapshot.applicationShellState.loadCoreDataTrackedRef.current = coreLoader;
    harnessSnapshot.applicationShellState.selectedThreadIdRef.current = "thread-invariant";
    harnessSnapshot.applicationShellState.loadSelectedThreadRef.current = null;

    await act(async (): Promise<void> => {
      await refreshEffectsInput.refreshCoreDataAndSelectedThread();
    });

    expect(coreLoader).toHaveBeenCalledTimes(1);
    const updatedHarnessSnapshot = latestRuntimeHarnessSnapshot;
    if (!updatedHarnessSnapshot) {
      throw new Error("Expected runtime harness snapshot after refresh");
    }
    expect(updatedHarnessSnapshot.applicationShellState.error).toContain(
      "Runtime refresh invariant violated: selected-thread loader is unavailable for active selection.",
    );
  });
});
