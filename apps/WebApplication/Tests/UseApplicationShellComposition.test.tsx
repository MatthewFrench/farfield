import { cleanup, render } from "@testing-library/react";
import { useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationRouteStateMapper } from "../Source/Application/DomainModel/ApplicationRouteStateMapper";
import { MobileSidebarSwipeCoordinator } from "../Source/Application/StateManagement/MobileSidebarSwipeCoordinator";
import { RuntimeViewportSizingCoordinator } from "../Source/Application/StateManagement/RuntimeViewportSizingCoordinator";
import { type ApplicationChatFeatureComposition } from "../Source/Application/StateManagement/UseApplicationChatFeatureComposition";
import { useApplicationDerivedState } from "../Source/Application/StateManagement/UseApplicationDerivedState";
import { type ApplicationDerivedState } from "../Source/Application/StateManagement/UseApplicationDerivedStateContracts";
import { type ApplicationPushFeatureComposition } from "../Source/Application/StateManagement/UseApplicationPushFeatureComposition";
import {
  type ApplicationShellComposition,
  useApplicationShellComposition,
} from "../Source/Application/StateManagement/UseApplicationShellComposition";
import {
  type ApplicationShellState,
  useApplicationShellState,
} from "../Source/Application/StateManagement/UseApplicationShellState";
import * as ApplicationShellViewPropertiesModule from "../Source/Application/StateManagement/UseApplicationShellViewProperties";
import * as MobileSidebarTouchHandlersModule from "../Source/Application/StateManagement/UseMobileSidebarTouchHandlers";
import { CapabilityServerClient } from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";
import { ConversationItemFlattener } from "../Source/Features/Chat/DomainModel/ConversationItemFlattener";
import { ConversationSyncSignatureBuilder } from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { PendingUserInputRequestSelector } from "../Source/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { ChatScrollStateCoordinator } from "../Source/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { type ChatModeToolbarProps } from "../Source/Features/Chat/UserInterface/ChatModeToolbar";
import { DebugIssueStateResolver } from "../Source/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { type DebugActionHandlers } from "../Source/Features/Debugging/StateManagement/UseDebugActionHandlers";
import { type PushClientState } from "../Source/Features/PushNotifications/DomainModel/PushClientContracts";
import { ThreadDisplayNamePreferenceStore } from "../Source/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";
import { ThreadMutationServerClient } from "../Source/Features/Threads/DataAccess/ThreadMutationServerClient";
import { ThreadQueryCache } from "../Source/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "../Source/Features/Threads/DataAccess/ThreadServerClient";
import { ThreadDisplayNameStateOwner } from "../Source/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "../Source/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "../Source/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadMutationActionCoordinator } from "../Source/Features/Threads/StateManagement/ThreadMutationActionCoordinator";
import { ThreadRefreshConcurrencyCoordinator } from "../Source/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";
import * as ThreadActionHandlersModule from "../Source/Features/Threads/StateManagement/UseThreadActionHandlers";
import { type ThreadActionHandlers } from "../Source/Features/Threads/StateManagement/UseThreadActionHandlers";
import * as ThreadListPanePropertiesModule from "../Source/Features/Threads/StateManagement/UseThreadListPaneProperties";
import { type ThreadListPaneProperties } from "../Source/Features/Threads/UserInterface/ThreadListPaneContracts";

const THREAD_QUERY_CACHE_TIME_TO_LIVE_MILLISECONDS = 60_000;
const THREAD_QUERY_CACHE_MAXIMUM_ENTRIES = 25;
const MOBILE_LAYOUT_MAXIMUM_WIDTH_PX = 768;
const MOBILE_SIDEBAR_SWIPE_EDGE_PX = 32;
const MOBILE_SIDEBAR_SWIPE_TRIGGER_PX = 56;
const MOBILE_SIDEBAR_SWIPE_MAXIMUM_VERTICAL_DRIFT_PX = 40;
const MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX = -16;
const CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 24;
const MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX = 120;
const INITIAL_VISIBLE_CHAT_ITEMS = 20;
const VISIBLE_CHAT_ITEMS_STEP = 15;

interface ShellCompositionFixture {
  theme: string;
  toggleTheme: () => void;
  visibleChatItemsStep: number;
  streamEventCards: React.JSX.Element[];
  renderAgentFavicon: (
    agentId: "codex" | "opencode",
    label: string,
    className: string,
  ) => React.ReactNode;
  formatDateValue: (value: number | string | null | undefined) => string;
  loadCoreDataTracked: () => Promise<void>;
  loadSelectedThreadTracked: (threadId: string) => Promise<void>;
  refreshCoreDataAndSelectedThread: () => Promise<void>;
  buildActionRequestOptions: (actionName: string) => {
    actionId: string;
    requestOptions: {
      actionName: string;
    };
  };
  reportTrackedUserInterfaceError: () => Promise<void>;
  capabilityServerClient: CapabilityServerClient;
  threadMutationServerClient: ThreadMutationServerClient;
  threadMutationActionCoordinator: ThreadMutationActionCoordinator;
  threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
  threadListStateController: ThreadListStateController;
  mobileSidebarSwipeCoordinator: MobileSidebarSwipeCoordinator;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
  chatFeatureComposition: ApplicationChatFeatureComposition;
  debugFeatureComposition: DebugActionHandlers;
  pushFeatureComposition: ApplicationPushFeatureComposition;
}

interface RuntimeHarnessSnapshot {
  applicationShellState: ApplicationShellState;
  applicationDerivedState: ApplicationDerivedState;
  shellComposition: ApplicationShellComposition;
}

interface RuntimeHarnessProperties {
  fixture: ShellCompositionFixture;
}

let latestRuntimeHarnessSnapshot: RuntimeHarnessSnapshot | null = null;

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

function createUnsupportedPushClientState(): PushClientState {
  return {
    supported: false,
    serviceWorkerRegistered: false,
    permission: "unsupported",
    subscribed: false,
  };
}

function createChatModeToolbarPropertiesFixture(): ChatModeToolbarProps {
  return {
    canSetCollaborationMode: true,
    canListCollaborationModes: true,
    canListModels: true,
    hasPlanModeOption: true,
    isPlanModeEnabled: false,
    selectedThreadId: "thread-001",
    appDefaultValue: "default",
    appDefaultModel: "Default Model",
    appDefaultReasoningEffort: "Medium",
    selectedModelId: "",
    selectedReasoningEffort: "",
    selectedModeKey: "",
    modelOptionsWithoutAssumedDefault: [],
    effortOptionsWithoutAssumedDefault: [],
    isModeSyncing: false,
    pendingRequestCount: 0,
    runningTerminalCount: 0,
    onTogglePlanMode: (): void => {},
    onModelChange: (): void => {},
    onReasoningEffortChange: (): void => {},
  };
}

function createChatFeatureCompositionFixture(): ApplicationChatFeatureComposition {
  return {
    submitMessage: vi.fn(async (_draft: string): Promise<void> => {}),
    steerMessage: vi.fn(async (_draft: string): Promise<void> => {}),
    applyModeDraft: vi.fn(async (): Promise<void> => {}),
    submitPendingRequest: vi.fn(async (): Promise<void> => {}),
    skipPendingRequest: vi.fn(async (): Promise<void> => {}),
    runInterrupt: vi.fn(async (): Promise<void> => {}),
    handleAnswerChange: vi.fn((): void => {}),
    chatModeToolbarProperties: createChatModeToolbarPropertiesFixture(),
  };
}

function createDebugFeatureCompositionFixture(): DebugActionHandlers {
  return {
    loadHistoryDetail: vi.fn(async (_historyEntryId: string): Promise<void> => {}),
    replayHistoryEntryFromDetail: vi.fn((): void => {}),
    clearDebugIssuesFromPanel: vi.fn((): void => {}),
    startTraceFromDebugPanel: vi.fn((): void => {}),
    markTraceFromDebugPanel: vi.fn((): void => {}),
    stopTraceFromDebugPanel: vi.fn((): void => {}),
    openDebugFromErrorBanner: vi.fn((): void => {}),
  };
}

function createPushFeatureCompositionFixture(): ApplicationPushFeatureComposition {
  return {
    submitApiSessionToken: vi.fn(async (): Promise<void> => {}),
    refreshPushClientState: vi.fn(async (): Promise<void> => {}),
    ensureFreshPushSettingsDiagnostics: vi.fn(async (): Promise<void> => {}),
    refreshPushSettingsDiagnostics: vi.fn(async (): Promise<void> => {}),
    enablePushNotificationsFromToolbar: vi.fn(async (): Promise<void> => {}),
    sendPushTestNotificationFromSettings: vi.fn(async (): Promise<void> => {}),
  };
}

function createThreadActionHandlersFixture(): ThreadActionHandlers {
  return {
    createNewThread: vi.fn(async (): Promise<void> => {}),
    createThreadForSingleAgent: vi.fn((): void => {}),
    runArchiveThread: vi.fn(async (): Promise<void> => {}),
    runForkThread: vi.fn(async (): Promise<void> => {}),
    runRollbackThread: vi.fn(async (): Promise<void> => {}),
    runCompactThread: vi.fn(async (): Promise<void> => {}),
    runCleanThreadBackgroundTerminals: vi.fn(async (): Promise<void> => {}),
    runStartThreadReview: vi.fn(async (): Promise<void> => {}),
    runSetThreadName: vi.fn(async (): Promise<void> => {}),
    runUnarchiveThread: vi.fn(async (): Promise<void> => {}),
  };
}

function createShellCompositionFixture(): ShellCompositionFixture {
  const threadListStateController = createThreadListStateController();
  return {
    theme: "light",
    toggleTheme: vi.fn((): void => {}),
    visibleChatItemsStep: VISIBLE_CHAT_ITEMS_STEP,
    streamEventCards: [],
    renderAgentFavicon: vi.fn(() => null),
    formatDateValue: vi.fn(() => "formatted"),
    loadCoreDataTracked: vi.fn(async (): Promise<void> => {}),
    loadSelectedThreadTracked: vi.fn(async (_threadId: string): Promise<void> => {}),
    refreshCoreDataAndSelectedThread: vi.fn(async (): Promise<void> => {}),
    buildActionRequestOptions: vi.fn((actionName: string) => ({
      actionId: `action-${actionName}`,
      requestOptions: {
        actionName,
      },
    })),
    reportTrackedUserInterfaceError: vi.fn(async (): Promise<void> => {}),
    capabilityServerClient: new CapabilityServerClient(),
    threadMutationServerClient: new ThreadMutationServerClient(),
    threadMutationActionCoordinator: new ThreadMutationActionCoordinator(),
    threadDisplayNameStateOwner: new ThreadDisplayNameStateOwner({
      threadDisplayNamePreferenceStore: new ThreadDisplayNamePreferenceStore(
        "test.use-application-shell-composition.display-name",
      ),
    }),
    threadListStateController,
    mobileSidebarSwipeCoordinator: new MobileSidebarSwipeCoordinator({
      mobileLayoutMaximumWidthPx: MOBILE_LAYOUT_MAXIMUM_WIDTH_PX,
      sidebarSwipeEdgePx: MOBILE_SIDEBAR_SWIPE_EDGE_PX,
      sidebarSwipeTriggerPx: MOBILE_SIDEBAR_SWIPE_TRIGGER_PX,
      sidebarSwipeMaximumVerticalDriftPx: MOBILE_SIDEBAR_SWIPE_MAXIMUM_VERTICAL_DRIFT_PX,
      sidebarSwipeCancelNegativePx: MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX,
    }),
    runtimeViewportSizingCoordinator: new RuntimeViewportSizingCoordinator(
      MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX,
    ),
    chatScrollStateCoordinator: new ChatScrollStateCoordinator(CHAT_SCROLL_BOTTOM_THRESHOLD_PX),
    chatFeatureComposition: createChatFeatureCompositionFixture(),
    debugFeatureComposition: createDebugFeatureCompositionFixture(),
    pushFeatureComposition: createPushFeatureCompositionFixture(),
  };
}

function readLatestRuntimeHarnessSnapshot(): RuntimeHarnessSnapshot {
  if (!latestRuntimeHarnessSnapshot) {
    throw new Error("Expected runtime harness snapshot");
  }
  return latestRuntimeHarnessSnapshot;
}

/**
 * Uses real shell-state and derived-state owners so this test verifies wiring
 * against the same contracts the runtime composition root provides in production.
 */
function RuntimeHarness(properties: RuntimeHarnessProperties): React.JSX.Element {
  const initialUiState = useMemo(
    () => new ApplicationRouteStateMapper().parseFromPathname("/"),
    [],
  );

  const applicationShellState = useApplicationShellState({
    initialUiState,
    unsupportedPushClientState: createUnsupportedPushClientState(),
    initialVisibleChatItems: INITIAL_VISIBLE_CHAT_ITEMS,
  });

  const modeSelectionStateResolver = useMemo(() => new ModeSelectionStateResolver(), []);
  const conversationSyncSignatureBuilder = useMemo(
    () => new ConversationSyncSignatureBuilder(modeSelectionStateResolver),
    [modeSelectionStateResolver],
  );
  const pendingUserInputRequestSelector = useMemo(() => new PendingUserInputRequestSelector(), []);
  const conversationItemFlattener = useMemo(() => new ConversationItemFlattener(), []);
  const debugIssueStateResolver = useMemo(() => new DebugIssueStateResolver(), []);

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
    defaultEffortOptions: ["medium", "high"],
    assumedAppDefaultModelIdentifier: "gpt-5",
    assumedAppDefaultReasoningEffort: "medium",
    modeSelectionStateResolver,
    conversationSyncSignatureBuilder,
    pendingUserInputRequestSelector,
    conversationItemFlattener,
    debugIssueStateResolver,
    threadListStateController: properties.fixture.threadListStateController,
  });

  const shellComposition = useApplicationShellComposition({
    theme: properties.fixture.theme,
    toggleTheme: properties.fixture.toggleTheme,
    visibleChatItemsStep: properties.fixture.visibleChatItemsStep,
    applicationShellState,
    applicationDerivedState,
    streamEventCards: properties.fixture.streamEventCards,
    renderAgentFavicon: properties.fixture.renderAgentFavicon,
    formatDateValue: properties.fixture.formatDateValue,
    loadCoreDataTracked: properties.fixture.loadCoreDataTracked,
    loadSelectedThreadTracked: properties.fixture.loadSelectedThreadTracked,
    refreshCoreDataAndSelectedThread: properties.fixture.refreshCoreDataAndSelectedThread,
    buildActionRequestOptions: properties.fixture.buildActionRequestOptions,
    reportTrackedUserInterfaceError: properties.fixture.reportTrackedUserInterfaceError,
    capabilityServerClient: properties.fixture.capabilityServerClient,
    threadMutationServerClient: properties.fixture.threadMutationServerClient,
    threadMutationActionCoordinator: properties.fixture.threadMutationActionCoordinator,
    threadDisplayNameStateOwner: properties.fixture.threadDisplayNameStateOwner,
    threadListStateController: properties.fixture.threadListStateController,
    mobileSidebarSwipeCoordinator: properties.fixture.mobileSidebarSwipeCoordinator,
    runtimeViewportSizingCoordinator: properties.fixture.runtimeViewportSizingCoordinator,
    chatScrollStateCoordinator: properties.fixture.chatScrollStateCoordinator,
    chatFeatureComposition: properties.fixture.chatFeatureComposition,
    debugFeatureComposition: properties.fixture.debugFeatureComposition,
    pushFeatureComposition: properties.fixture.pushFeatureComposition,
  });

  latestRuntimeHarnessSnapshot = {
    applicationShellState,
    applicationDerivedState,
    shellComposition,
  };

  return <div data-testid="use-application-shell-composition-harness" />;
}

describe("useApplicationShellComposition", () => {
  afterEach(() => {
    cleanup();
    latestRuntimeHarnessSnapshot = null;
    vi.restoreAllMocks();
  });

  it("wires owner inputs through extracted hook-input builders and preserves composed output behavior", () => {
    const fixture = createShellCompositionFixture();
    const threadActionHandlersFixture = createThreadActionHandlersFixture();

    const useThreadActionHandlersSpy = vi
      .spyOn(ThreadActionHandlersModule, "useThreadActionHandlers")
      .mockReturnValue(threadActionHandlersFixture);
    const useMobileSidebarTouchHandlersSpy = vi.spyOn(
      MobileSidebarTouchHandlersModule,
      "useMobileSidebarTouchHandlers",
    );
    const useThreadListPanePropertiesSpy = vi.spyOn(
      ThreadListPanePropertiesModule,
      "useThreadListPaneProperties",
    );
    const useApplicationShellViewPropertiesSpy = vi.spyOn(
      ApplicationShellViewPropertiesModule,
      "useApplicationShellViewProperties",
    );

    render(<RuntimeHarness fixture={fixture} />);

    const runtimeHarnessSnapshot = readLatestRuntimeHarnessSnapshot();
    const threadActionHandlersInput = useThreadActionHandlersSpy.mock.calls[0]?.[0];
    if (!threadActionHandlersInput) {
      throw new Error("Expected useThreadActionHandlers input");
    }
    expect(threadActionHandlersInput).toEqual({
      availableAgentIds: runtimeHarnessSnapshot.applicationDerivedState.availableAgentIds,
      threads: runtimeHarnessSnapshot.applicationShellState.threads,
      buildActionRequestOptions: fixture.buildActionRequestOptions,
      setIsBusy: runtimeHarnessSnapshot.applicationShellState.setIsBusy,
      setError: runtimeHarnessSnapshot.applicationShellState.setError,
      setSuccessBannerDetails: runtimeHarnessSnapshot.applicationShellState.setSuccessBannerDetails,
      setSelectedThreadId: runtimeHarnessSnapshot.applicationShellState.setSelectedThreadId,
      setMobileSidebarOpen: runtimeHarnessSnapshot.applicationShellState.setMobileSidebarOpen,
      selectedThreadIdRef: runtimeHarnessSnapshot.applicationShellState.selectedThreadIdRef,
      pendingThreadMaterializationCoordinator:
        runtimeHarnessSnapshot.applicationShellState.pendingThreadMaterializationCoordinator,
      threadMutationActionCoordinator: fixture.threadMutationActionCoordinator,
      threadMutationServerClient: fixture.threadMutationServerClient,
      threadDisplayNameStateOwner: fixture.threadDisplayNameStateOwner,
      threadListStateController: fixture.threadListStateController,
      loadCoreDataTracked: fixture.loadCoreDataTracked,
      loadSelectedThreadTracked: fixture.loadSelectedThreadTracked,
      reportTrackedUserInterfaceError: fixture.reportTrackedUserInterfaceError,
    });

    const mobileSidebarTouchHandlersInput = useMobileSidebarTouchHandlersSpy.mock.calls[0]?.[0];
    if (!mobileSidebarTouchHandlersInput) {
      throw new Error("Expected useMobileSidebarTouchHandlers input");
    }
    expect(mobileSidebarTouchHandlersInput).toEqual({
      mobileSidebarOpen: runtimeHarnessSnapshot.applicationShellState.mobileSidebarOpen,
      setMobileSidebarOpen: runtimeHarnessSnapshot.applicationShellState.setMobileSidebarOpen,
      mobileSidebarSwipeCoordinator: fixture.mobileSidebarSwipeCoordinator,
      runtimeViewportSizingCoordinator: fixture.runtimeViewportSizingCoordinator,
    });

    const threadListPanePropertiesInput = useThreadListPanePropertiesSpy.mock.calls[0]?.[0];
    if (!threadListPanePropertiesInput) {
      throw new Error("Expected useThreadListPaneProperties input");
    }
    expect(threadListPanePropertiesInput).toEqual(
      expect.objectContaining({
        createNewThread: threadActionHandlersFixture.createNewThread,
        createThreadForSingleAgent: threadActionHandlersFixture.createThreadForSingleAgent,
        archiveThread: threadActionHandlersFixture.runArchiveThread,
        forkThread: threadActionHandlersFixture.runForkThread,
        rollbackThread: threadActionHandlersFixture.runRollbackThread,
        compactThread: threadActionHandlersFixture.runCompactThread,
        cleanThreadBackgroundTerminals:
          threadActionHandlersFixture.runCleanThreadBackgroundTerminals,
        startThreadReview: threadActionHandlersFixture.runStartThreadReview,
        setThreadName: threadActionHandlersFixture.runSetThreadName,
        unarchiveThread: threadActionHandlersFixture.runUnarchiveThread,
        threadRuntimeStatusByThreadIdentifier:
          runtimeHarnessSnapshot.applicationShellState.threadRuntimeStatusByThreadIdentifier,
        formatDate: fixture.formatDateValue,
        renderAgentFavicon: fixture.renderAgentFavicon,
      }),
    );

    const shellViewPropertiesInput = useApplicationShellViewPropertiesSpy.mock.calls[0]?.[0];
    if (!shellViewPropertiesInput) {
      throw new Error("Expected useApplicationShellViewProperties input");
    }
    expect(shellViewPropertiesInput).toEqual(
      expect.objectContaining({
        theme: fixture.theme,
        threadSidebarRuntimeSummary:
          runtimeHarnessSnapshot.applicationShellState.threadSidebarRuntimeSummary,
        visibleChatItemsStep: fixture.visibleChatItemsStep,
        enablePushNotificationsFromToolbar:
          fixture.pushFeatureComposition.enablePushNotificationsFromToolbar,
        refreshPushSettingsDiagnostics:
          fixture.pushFeatureComposition.refreshPushSettingsDiagnostics,
        sendPushTestNotificationFromSettings:
          fixture.pushFeatureComposition.sendPushTestNotificationFromSettings,
        submitApiSessionToken: fixture.pushFeatureComposition.submitApiSessionToken,
        handleAnswerChange: fixture.chatFeatureComposition.handleAnswerChange,
        submitPendingRequest: fixture.chatFeatureComposition.submitPendingRequest,
        submitMessage: fixture.chatFeatureComposition.submitMessage,
        steerMessage: fixture.chatFeatureComposition.steerMessage,
        runInterrupt: fixture.chatFeatureComposition.runInterrupt,
        openDebugFromErrorBanner: fixture.debugFeatureComposition.openDebugFromErrorBanner,
        clearDebugIssuesFromDebugPanel: fixture.debugFeatureComposition.clearDebugIssuesFromPanel,
        replayHistoryEntryFromDetail: fixture.debugFeatureComposition.replayHistoryEntryFromDetail,
        streamEventCards: fixture.streamEventCards,
      }),
    );

    const mobileSidebarTouchHandlersResult = useMobileSidebarTouchHandlersSpy.mock.results[0]
      ?.value as MobileSidebarTouchHandlersModule.MobileSidebarTouchHandlers | undefined;
    if (mobileSidebarTouchHandlersResult === undefined) {
      throw new Error("Expected useMobileSidebarTouchHandlers result");
    }

    const threadListPanePropertiesResult = useThreadListPanePropertiesSpy.mock.results[0]?.value as
      | ThreadListPaneProperties
      | undefined;
    if (threadListPanePropertiesResult === undefined) {
      throw new Error("Expected useThreadListPaneProperties result");
    }

    expect(runtimeHarnessSnapshot.shellComposition.endSidebarSwipeTracking).toBe(
      mobileSidebarTouchHandlersResult.endSidebarSwipeTracking,
    );
    expect(runtimeHarnessSnapshot.shellComposition.handleAppShellTouchStart).toBe(
      mobileSidebarTouchHandlersResult.handleAppShellTouchStart,
    );
    expect(runtimeHarnessSnapshot.shellComposition.handleAppShellTouchMove).toBe(
      mobileSidebarTouchHandlersResult.handleAppShellTouchMove,
    );
    expect(runtimeHarnessSnapshot.shellComposition.threadListPaneProperties).toBe(
      threadListPanePropertiesResult,
    );

    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onCreateThreadForSingleAgent(
      "/workspace/example",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onCreateNewThread(
      "/workspace/example",
      "codex",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onArchiveThread(
      "thread-archive",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onForkThread("thread-fork");
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onRollbackThread(
      "thread-rollback",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onCompactThread(
      "thread-compact",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onCleanThreadBackgroundTerminals(
      "thread-background-terminals-clean",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onStartThreadReview(
      "thread-review",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onSetThreadName(
      "thread-name",
      "New title",
    );
    runtimeHarnessSnapshot.shellComposition.threadListPaneProperties.onUnarchiveThread(
      "thread-unarchive",
    );

    expect(threadActionHandlersFixture.createThreadForSingleAgent).toHaveBeenCalledWith(
      "/workspace/example",
    );
    expect(threadActionHandlersFixture.createNewThread).toHaveBeenCalledWith(
      "/workspace/example",
      "codex",
    );
    expect(threadActionHandlersFixture.runArchiveThread).toHaveBeenCalledWith("thread-archive");
    expect(threadActionHandlersFixture.runForkThread).toHaveBeenCalledWith("thread-fork");
    expect(threadActionHandlersFixture.runRollbackThread).toHaveBeenCalledWith("thread-rollback");
    expect(threadActionHandlersFixture.runCompactThread).toHaveBeenCalledWith("thread-compact");
    expect(threadActionHandlersFixture.runCleanThreadBackgroundTerminals).toHaveBeenCalledWith(
      "thread-background-terminals-clean",
    );
    expect(threadActionHandlersFixture.runStartThreadReview).toHaveBeenCalledWith("thread-review");
    expect(threadActionHandlersFixture.runSetThreadName).toHaveBeenCalledWith(
      "thread-name",
      "New title",
    );
    expect(threadActionHandlersFixture.runUnarchiveThread).toHaveBeenCalledWith("thread-unarchive");
  });
});
