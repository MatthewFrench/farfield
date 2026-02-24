import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface PushFeatureCompositionMock {
  submitApiSessionToken: () => Promise<void>;
  refreshPushClientState: () => Promise<void>;
  enablePushNotificationsFromToolbar: () => Promise<void>;
}

interface ChatFeatureCompositionMock {
  submitMessage: (draft: string) => Promise<void>;
  applyModeDraft: (draft: { modeKey: string; modelId: string; reasoningEffort: string }) => Promise<void>;
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
  startTraceFromDebugPanel: () => void;
  markTraceFromDebugPanel: () => void;
  stopTraceFromDebugPanel: () => void;
  openDebugFromErrorBanner: () => void;
}

interface ApplicationRefreshEffectsCapture {
  refreshPushClientState: () => Promise<void>;
  loadCoreDataTracked: () => Promise<void>;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
}

interface ApplicationSynchronizationEffectsCapture {
  loadCoreDataTracked: () => Promise<void>;
  loadSelectedThreadTracked: (
    threadId: string,
    options?: {
      includeTurns?: boolean;
      includeReadThread?: boolean;
    }
  ) => Promise<void>;
  loadHistoryDetail: (historyEntryId: string) => Promise<void>;
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
  useApplicationShellComposition: vi.fn()
}));

vi.mock("../Source/Application/StateManagement/UseApplicationPushFeatureComposition", () => ({
  useApplicationPushFeatureComposition: hookMocks.useApplicationPushFeatureComposition
}));

vi.mock("../Source/Application/StateManagement/UseViewportShellEffects", () => ({
  useViewportShellEffects: hookMocks.useViewportShellEffects
}));

vi.mock("../Source/Application/StateManagement/UseApplicationRefreshEffects", () => ({
  useApplicationRefreshEffects: hookMocks.useApplicationRefreshEffects
}));

vi.mock("../Source/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects", () => ({
  useSelectedThreadLifecycleEffects: hookMocks.useSelectedThreadLifecycleEffects
}));

vi.mock("../Source/Application/StateManagement/UseEventStreamEffects", () => ({
  useEventStreamEffects: hookMocks.useEventStreamEffects
}));

vi.mock("../Source/Features/Chat/StateManagement/UseModeAndPendingRequestEffects", () => ({
  useModeAndPendingRequestEffects: hookMocks.useModeAndPendingRequestEffects
}));

vi.mock("../Source/Application/StateManagement/UseApplicationChatFeatureComposition", () => ({
  useApplicationChatFeatureComposition: hookMocks.useApplicationChatFeatureComposition
}));

vi.mock("../Source/Application/StateManagement/UseApplicationDebugFeatureComposition", () => ({
  useApplicationDebugFeatureComposition: hookMocks.useApplicationDebugFeatureComposition
}));

vi.mock("../Source/Application/StateManagement/UseApplicationSynchronizationEffects", () => ({
  useApplicationSynchronizationEffects: hookMocks.useApplicationSynchronizationEffects
}));

vi.mock("../Source/Application/StateManagement/UseApplicationShellComposition", () => ({
  useApplicationShellComposition: hookMocks.useApplicationShellComposition
}));

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
} from "../Source/Application/Configuration/ApplicationBehaviorConfiguration";
import { ApplicationRouteStateMapper } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";
import {
  type CoreDataCapabilitySnapshot,
  type CoreDataLoaders,
  useCoreDataLoaders
} from "../Source/Application/StateManagement/UseCoreDataLoaders";
import { useApplicationDerivedState } from "../Source/Application/StateManagement/UseApplicationDerivedState";
import { useApplicationOwnerDependencies } from "../Source/Application/StateManagement/UseApplicationOwnerDependencies";
import { useApplicationFormattingHelpers, useStreamEventCards } from "../Source/Application/StateManagement/UseApplicationPresentationHelpers";
import { type ApplicationRuntimeRequestHandlers, useApplicationRuntimeRequestHandlers } from "../Source/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import {
  useApplicationRuntimeComposition
} from "../Source/Application/StateManagement/UseApplicationRuntimeComposition";
import { type ApplicationShellState, useApplicationShellState } from "../Source/Application/StateManagement/UseApplicationShellState";
import { ConversationSyncSignatureBuilder } from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { type SelectedThreadLoaders, useSelectedThreadLoaders } from "../Source/Features/Chat/StateManagement/UseSelectedThreadLoaders";

interface RuntimeHarnessSnapshot {
  applicationShellState: ApplicationShellState;
  coreDataLoaders: CoreDataLoaders;
  loadSelectedThreadTracked: SelectedThreadLoaders["loadSelectedThreadTracked"];
  runtimeRequestHandlers: ApplicationRuntimeRequestHandlers;
}

let latestRuntimeHarnessSnapshot: RuntimeHarnessSnapshot | null = null;
let applicationRefreshEffectsCapture: ApplicationRefreshEffectsCapture | null = null;
let applicationSynchronizationEffectsCapture: ApplicationSynchronizationEffectsCapture | null = null;
let applicationShellCompositionCapture: ApplicationShellCompositionCapture | null = null;

let pushFeatureCompositionMock: PushFeatureCompositionMock;
let chatFeatureCompositionMock: ChatFeatureCompositionMock;
let debugFeatureCompositionMock: DebugFeatureCompositionMock;

const modeSelectionStateResolver = new ModeSelectionStateResolver();
const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(modeSelectionStateResolver);
const applicationRouteStateMapper = new ApplicationRouteStateMapper();

function createPushFeatureCompositionMock(): PushFeatureCompositionMock {
  return {
    submitApiSessionToken: vi.fn(async (): Promise<void> => {}),
    refreshPushClientState: vi.fn(async (): Promise<void> => {}),
    enablePushNotificationsFromToolbar: vi.fn(async (): Promise<void> => {})
  };
}

function createChatFeatureCompositionMock(): ChatFeatureCompositionMock {
  return {
    submitMessage: vi.fn(async (_draft: string): Promise<void> => {}),
    applyModeDraft: vi.fn(async (_draft): Promise<void> => {}),
    submitPendingRequest: vi.fn(async (): Promise<void> => {}),
    skipPendingRequest: vi.fn(async (): Promise<void> => {}),
    runInterrupt: vi.fn(async (): Promise<void> => {}),
    handleAnswerChange: vi.fn(),
    chatModeToolbarProperties: {
      isModeSyncing: false
    }
  };
}

function createDebugFeatureCompositionMock(): DebugFeatureCompositionMock {
  return {
    loadHistoryDetail: vi.fn(async (_historyEntryId: string): Promise<void> => {}),
    replayHistoryEntryFromDetail: vi.fn(),
    startTraceFromDebugPanel: vi.fn(),
    markTraceFromDebugPanel: vi.fn(),
    stopTraceFromDebugPanel: vi.fn(),
    openDebugFromErrorBanner: vi.fn()
  };
}

function RuntimeCompositionHarness(): React.JSX.Element {
  const initialUiState = useMemo(
    () => applicationRouteStateMapper.parseFromPathname("/"),
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

  const {
    renderAgentFavicon,
    formatDateValue
  } = useApplicationFormattingHelpers({
    dateValueFormatter: applicationOwnerDependencies.dateValueFormatter
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
    loadSelectedThreadTracked,
    streamEventCards,
    renderAgentFavicon,
    formatDateValue
  });

  latestRuntimeHarnessSnapshot = {
    applicationShellState,
    coreDataLoaders,
    loadSelectedThreadTracked,
    runtimeRequestHandlers
  };

  return <div data-testid="runtime-composition-harness" />;
}

describe("useApplicationRuntimeComposition", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    latestRuntimeHarnessSnapshot = null;
    applicationRefreshEffectsCapture = null;
    applicationSynchronizationEffectsCapture = null;
    applicationShellCompositionCapture = null;

    pushFeatureCompositionMock = createPushFeatureCompositionMock();
    chatFeatureCompositionMock = createChatFeatureCompositionMock();
    debugFeatureCompositionMock = createDebugFeatureCompositionMock();

    hookMocks.useApplicationPushFeatureComposition.mockReturnValue(pushFeatureCompositionMock);
    hookMocks.useApplicationChatFeatureComposition.mockReturnValue(chatFeatureCompositionMock);
    hookMocks.useApplicationDebugFeatureComposition.mockReturnValue(debugFeatureCompositionMock);

    hookMocks.useViewportShellEffects.mockImplementation((): void => {});
    hookMocks.useSelectedThreadLifecycleEffects.mockImplementation((): void => {});
    hookMocks.useEventStreamEffects.mockImplementation((): void => {});
    hookMocks.useModeAndPendingRequestEffects.mockImplementation((): void => {});

    hookMocks.useApplicationRefreshEffects.mockImplementation((input: ApplicationRefreshEffectsCapture): void => {
      applicationRefreshEffectsCapture = input;
    });

    hookMocks.useApplicationSynchronizationEffects.mockImplementation((input: ApplicationSynchronizationEffectsCapture): void => {
      applicationSynchronizationEffectsCapture = input;
    });

    hookMocks.useApplicationShellComposition.mockImplementation((input: ApplicationShellCompositionCapture) => {
      applicationShellCompositionCapture = input;
      return {
        threadListPaneProperties: {
          threadListState: "ready"
        }
      };
    });
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
      harnessSnapshot.coreDataLoaders.loadCoreDataTracked
    );
    expect(harnessSnapshot.applicationShellState.loadSelectedThreadRef.current).toBe(
      harnessSnapshot.loadSelectedThreadTracked
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
      harnessSnapshot.coreDataLoaders.loadCoreDataTracked
    );
    expect(refreshEffectsInput.refreshPushClientState).toBe(
      pushFeatureCompositionMock.refreshPushClientState
    );

    const shellCompositionInput = applicationShellCompositionCapture;
    if (!shellCompositionInput) {
      throw new Error("Expected shell composition input to be captured");
    }
    expect(shellCompositionInput.refreshCoreDataAndSelectedThread).toBe(
      refreshEffectsInput.refreshCoreDataAndSelectedThread
    );

    const synchronizationEffectsInput = applicationSynchronizationEffectsCapture;
    if (!synchronizationEffectsInput) {
      throw new Error("Expected synchronization effects input to be captured");
    }

    expect(synchronizationEffectsInput.loadCoreDataTracked).toBe(
      harnessSnapshot.coreDataLoaders.loadCoreDataTracked
    );
    expect(synchronizationEffectsInput.loadSelectedThreadTracked).toBe(
      harnessSnapshot.loadSelectedThreadTracked
    );
    expect(synchronizationEffectsInput.loadHistoryDetail).toBe(
      debugFeatureCompositionMock.loadHistoryDetail
    );
  });
});
