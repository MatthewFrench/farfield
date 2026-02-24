import { useMemo } from "react";
import { ApiAuthenticationErrorClassifier } from "@/Application/DomainModel/ApiAuthenticationErrorClassifier";
import { DateValueFormatter } from "@/Application/DomainModel/DateValueFormatter";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import { CoreDataRefreshConcurrencyCoordinator } from "@/Application/StateManagement/CoreDataRefreshConcurrencyCoordinator";
import { EventRefreshScheduler } from "@/Application/StateManagement/EventRefreshScheduler";
import { EventStreamConnectionCoordinator } from "@/Application/StateManagement/EventStreamConnectionCoordinator";
import { EventStreamRefreshDecisionEngine } from "@/Application/StateManagement/EventStreamRefreshDecisionEngine";
import { MobileSidebarSwipeCoordinator } from "@/Application/StateManagement/MobileSidebarSwipeCoordinator";
import { PageTouchOverscrollGuardCoordinator } from "@/Application/StateManagement/PageTouchOverscrollGuardCoordinator";
import { RuntimeViewportSizingCoordinator } from "@/Application/StateManagement/RuntimeViewportSizingCoordinator";
import { UserInterfaceActionRequestBuilder } from "@/Application/StateManagement/UserInterfaceActionRequestBuilder";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import {
  CapabilityServerClient
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  CapabilitySnapshotCache,
  type CapabilitySnapshotRecord
} from "@/Features/Capabilities/DataAccess/CapabilitySnapshotCache";
import { ChatServerClient } from "@/Features/Chat/DataAccess/ChatServerClient";
import { ConversationItemFlattener } from "@/Features/Chat/DomainModel/ConversationItemFlattener";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { PendingUserInputAnswerBuilder } from "@/Features/Chat/DomainModel/PendingUserInputAnswerBuilder";
import { PendingUserInputRequestSelector } from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { ChatRequestActionCoordinator } from "@/Features/Chat/StateManagement/ChatRequestActionCoordinator";
import { ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { CollaborationModeActionCoordinator } from "@/Features/Chat/StateManagement/CollaborationModeActionCoordinator";
import { ModeSelectionSyncCoordinator } from "@/Features/Chat/StateManagement/ModeSelectionSyncCoordinator";
import { ReadThreadStateMerger } from "@/Features/Chat/StateManagement/ReadThreadStateMerger";
import { SelectedThreadDataRefreshCoordinator } from "@/Features/Chat/StateManagement/SelectedThreadDataRefreshCoordinator";
import { SelectedThreadRefreshConcurrencyCoordinator } from "@/Features/Chat/StateManagement/SelectedThreadRefreshConcurrencyCoordinator";
import { DebugServerClient } from "@/Features/Debugging/DataAccess/DebugServerClient";
import { DebugIssueStateResolver } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { DebugWorkspaceActionCoordinator } from "@/Features/Debugging/StateManagement/DebugWorkspaceActionCoordinator";
import { DebugWorkspaceDataReader } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { TrackedUserInterfaceErrorReporter } from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";
import { PushClientStateManager } from "@/Features/PushNotifications/DataAccess/PushClientStateManager";
import {
  PushNotificationToolbarActionCoordinator
} from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";
import { ThreadMutationServerClient } from "@/Features/Threads/DataAccess/ThreadMutationServerClient";
import { ThreadQueryCache } from "@/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "@/Features/Threads/DataAccess/ThreadServerClient";
import { ThreadListPresentationStateResolver } from "@/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "@/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadMutationActionCoordinator } from "@/Features/Threads/StateManagement/ThreadMutationActionCoordinator";
import { ThreadRefreshConcurrencyCoordinator } from "@/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

export interface UseApplicationOwnerDependenciesInput {
  setErrorMessage: (errorMessage: string) => void;
  modeSelectionStateResolver: ModeSelectionStateResolver;
  unsupportedPushClientState: PushClientState;
  threadOnlyHistoryMethods: string[];
  eventRefreshScheduleDelayMilliseconds: number;
  mobileVisualViewportKeyboardOpenDeltaPx: number;
  mobileLayoutMaximumWidthPx: number;
  mobileSidebarSwipeEdgePx: number;
  mobileSidebarSwipeTriggerPx: number;
  mobileSidebarSwipeMaximumVerticalDriftPx: number;
  mobileSidebarSwipeCancelNegativePx: number;
  capabilitySnapshotRefreshIntervalMilliseconds: number;
  chatScrollBottomThresholdPx: number;
  readThreadRetryMaximumAttempts: number;
  readThreadRetryBaseDelayMilliseconds: number;
  readThreadRetryMaximumDelayMilliseconds: number;
  threadQueryCacheTimeToLiveMilliseconds: number;
  threadQueryCacheMaximumEntries: number;
}

export interface ApplicationOwnerDependencies<
  CapabilitySnapshotType extends CapabilitySnapshotRecord
> {
  apiAuthenticationErrorClassifier: ApiAuthenticationErrorClassifier;
  dateValueFormatter: DateValueFormatter;
  capabilityServerClient: CapabilityServerClient;
  apiSessionBootstrapCoordinator: ApiSessionBootstrapCoordinator;
  coreDataRefreshConcurrencyCoordinator: CoreDataRefreshConcurrencyCoordinator;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionEngine;
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamConnectionCoordinator: EventStreamConnectionCoordinator;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
  pageTouchOverscrollGuardCoordinator: PageTouchOverscrollGuardCoordinator;
  mobileSidebarSwipeCoordinator: MobileSidebarSwipeCoordinator;
  capabilitySnapshotCache: CapabilitySnapshotCache<CapabilitySnapshotType>;
  chatServerClient: ChatServerClient;
  selectedThreadRefreshConcurrencyCoordinator: SelectedThreadRefreshConcurrencyCoordinator;
  readThreadStateMerger: ReadThreadStateMerger;
  pendingUserInputRequestSelector: PendingUserInputRequestSelector;
  modeSelectionSyncCoordinator: ModeSelectionSyncCoordinator;
  userInterfaceActionRequestBuilder: UserInterfaceActionRequestBuilder;
  trackedUserInterfaceErrorReporter: TrackedUserInterfaceErrorReporter;
  pendingUserInputAnswerBuilder: PendingUserInputAnswerBuilder;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
  chatRequestActionCoordinator: ChatRequestActionCoordinator;
  collaborationModeActionCoordinator: CollaborationModeActionCoordinator;
  selectedThreadDataRefreshCoordinator: SelectedThreadDataRefreshCoordinator;
  conversationItemFlattener: ConversationItemFlattener;
  debugServerClient: DebugServerClient;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  debugWorkspaceActionCoordinator: DebugWorkspaceActionCoordinator;
  debugIssueStateResolver: DebugIssueStateResolver;
  threadMutationServerClient: ThreadMutationServerClient;
  threadMutationActionCoordinator: ThreadMutationActionCoordinator;
  threadListStateController: ThreadListStateController;
  pushClientStateManager: PushClientStateManager;
  pushNotificationToolbarActionCoordinator: PushNotificationToolbarActionCoordinator;
}

export function useApplicationOwnerDependencies<
  CapabilitySnapshotType extends CapabilitySnapshotRecord
>(
  input: UseApplicationOwnerDependenciesInput
): ApplicationOwnerDependencies<CapabilitySnapshotType> {
  const apiAuthenticationErrorClassifier = useMemo(
    () => new ApiAuthenticationErrorClassifier(),
    []
  );
  const dateValueFormatter = useMemo(
    () => new DateValueFormatter(),
    []
  );
  const capabilityServerClient = useMemo(() => new CapabilityServerClient(), []);
  const apiSessionBootstrapCoordinator = useMemo(
    () => new ApiSessionBootstrapCoordinator(),
    []
  );
  const coreDataRefreshConcurrencyCoordinator = useMemo(
    () => new CoreDataRefreshConcurrencyCoordinator(),
    []
  );
  const eventStreamRefreshDecisionEngine = useMemo(
    () => new EventStreamRefreshDecisionEngine(Array.from(input.threadOnlyHistoryMethods)),
    [input.threadOnlyHistoryMethods]
  );
  const eventRefreshScheduler = useMemo(
    () => new EventRefreshScheduler(input.eventRefreshScheduleDelayMilliseconds),
    [input.eventRefreshScheduleDelayMilliseconds]
  );
  const eventStreamConnectionCoordinator = useMemo(
    () => new EventStreamConnectionCoordinator(),
    []
  );
  const runtimeViewportSizingCoordinator = useMemo(
    () => new RuntimeViewportSizingCoordinator(input.mobileVisualViewportKeyboardOpenDeltaPx),
    [input.mobileVisualViewportKeyboardOpenDeltaPx]
  );
  const pageTouchOverscrollGuardCoordinator = useMemo(
    () => new PageTouchOverscrollGuardCoordinator(),
    []
  );
  const mobileSidebarSwipeCoordinator = useMemo(
    () =>
      new MobileSidebarSwipeCoordinator({
        mobileLayoutMaximumWidthPx: input.mobileLayoutMaximumWidthPx,
        sidebarSwipeEdgePx: input.mobileSidebarSwipeEdgePx,
        sidebarSwipeTriggerPx: input.mobileSidebarSwipeTriggerPx,
        sidebarSwipeMaximumVerticalDriftPx: input.mobileSidebarSwipeMaximumVerticalDriftPx,
        sidebarSwipeCancelNegativePx: input.mobileSidebarSwipeCancelNegativePx
      }),
    [
      input.mobileLayoutMaximumWidthPx,
      input.mobileSidebarSwipeCancelNegativePx,
      input.mobileSidebarSwipeEdgePx,
      input.mobileSidebarSwipeMaximumVerticalDriftPx,
      input.mobileSidebarSwipeTriggerPx
    ]
  );
  const capabilitySnapshotCache = useMemo(
    () => new CapabilitySnapshotCache<CapabilitySnapshotType>(
      input.capabilitySnapshotRefreshIntervalMilliseconds
    ),
    [input.capabilitySnapshotRefreshIntervalMilliseconds]
  );
  const chatServerClient = useMemo(() => new ChatServerClient(), []);
  const selectedThreadRefreshConcurrencyCoordinator = useMemo(
    () => new SelectedThreadRefreshConcurrencyCoordinator(),
    []
  );
  const readThreadStateMerger = useMemo(
    () => new ReadThreadStateMerger(),
    []
  );
  const pendingUserInputRequestSelector = useMemo(
    () => new PendingUserInputRequestSelector(),
    []
  );
  const modeSelectionSyncCoordinator = useMemo(
    () => new ModeSelectionSyncCoordinator(input.modeSelectionStateResolver),
    [input.modeSelectionStateResolver]
  );
  const userInterfaceActionRequestBuilder = useMemo(
    () => new UserInterfaceActionRequestBuilder(),
    []
  );
  const trackedUserInterfaceErrorReporter = useMemo(
    () => new TrackedUserInterfaceErrorReporter({
      setErrorMessage: input.setErrorMessage
    }),
    [input.setErrorMessage]
  );
  const pendingUserInputAnswerBuilder = useMemo(
    () => new PendingUserInputAnswerBuilder(),
    []
  );
  const chatScrollStateCoordinator = useMemo(
    () => new ChatScrollStateCoordinator(input.chatScrollBottomThresholdPx),
    [input.chatScrollBottomThresholdPx]
  );
  const chatRequestActionCoordinator = useMemo(
    () => new ChatRequestActionCoordinator(),
    []
  );
  const collaborationModeActionCoordinator = useMemo(
    () => new CollaborationModeActionCoordinator(input.modeSelectionStateResolver),
    [input.modeSelectionStateResolver]
  );
  const selectedThreadDataRefreshCoordinator = useMemo(
    () => new SelectedThreadDataRefreshCoordinator({
      retryConfiguration: {
        maximumAttempts: input.readThreadRetryMaximumAttempts,
        baseDelayMilliseconds: input.readThreadRetryBaseDelayMilliseconds,
        maximumDelayMilliseconds: input.readThreadRetryMaximumDelayMilliseconds
      }
    }),
    [
      input.readThreadRetryBaseDelayMilliseconds,
      input.readThreadRetryMaximumAttempts,
      input.readThreadRetryMaximumDelayMilliseconds
    ]
  );
  const conversationItemFlattener = useMemo(
    () => new ConversationItemFlattener(),
    []
  );
  const debugServerClient = useMemo(() => new DebugServerClient(), []);
  const debugWorkspaceDataReader = useMemo(
    () => new DebugWorkspaceDataReader(debugServerClient),
    [debugServerClient]
  );
  const debugWorkspaceStateStore = useMemo(
    () => new DebugWorkspaceStateStore(),
    []
  );
  const debugWorkspaceActionCoordinator = useMemo(
    () => new DebugWorkspaceActionCoordinator(),
    []
  );
  const debugIssueStateResolver = useMemo(
    () => new DebugIssueStateResolver(),
    []
  );
  const threadMutationServerClient = useMemo(() => new ThreadMutationServerClient(), []);
  const threadMutationActionCoordinator = useMemo(
    () => new ThreadMutationActionCoordinator(),
    []
  );
  const threadListStateController = useMemo(
    () =>
      new ThreadListStateController({
        threadServerClient: new ThreadServerClient(),
        threadQueryCache: new ThreadQueryCache(
          input.threadQueryCacheTimeToLiveMilliseconds,
          input.threadQueryCacheMaximumEntries
        ),
        threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
        threadListStateStore: new ThreadListStateStore(),
        threadListPresentationStateResolver: new ThreadListPresentationStateResolver()
      }),
    [
      input.threadQueryCacheMaximumEntries,
      input.threadQueryCacheTimeToLiveMilliseconds
    ]
  );
  const pushClientStateManager = useMemo(
    () => new PushClientStateManager(),
    []
  );
  const pushNotificationToolbarActionCoordinator = useMemo(
    () =>
      new PushNotificationToolbarActionCoordinator({
        pushClientStateManager,
        unsupportedPushClientState: input.unsupportedPushClientState
      }),
    [
      input.unsupportedPushClientState,
      pushClientStateManager
    ]
  );

  return {
    apiAuthenticationErrorClassifier,
    dateValueFormatter,
    capabilityServerClient,
    apiSessionBootstrapCoordinator,
    coreDataRefreshConcurrencyCoordinator,
    eventStreamRefreshDecisionEngine,
    eventRefreshScheduler,
    eventStreamConnectionCoordinator,
    runtimeViewportSizingCoordinator,
    pageTouchOverscrollGuardCoordinator,
    mobileSidebarSwipeCoordinator,
    capabilitySnapshotCache,
    chatServerClient,
    selectedThreadRefreshConcurrencyCoordinator,
    readThreadStateMerger,
    pendingUserInputRequestSelector,
    modeSelectionSyncCoordinator,
    userInterfaceActionRequestBuilder,
    trackedUserInterfaceErrorReporter,
    pendingUserInputAnswerBuilder,
    chatScrollStateCoordinator,
    chatRequestActionCoordinator,
    collaborationModeActionCoordinator,
    selectedThreadDataRefreshCoordinator,
    conversationItemFlattener,
    debugServerClient,
    debugWorkspaceDataReader,
    debugWorkspaceStateStore,
    debugWorkspaceActionCoordinator,
    debugIssueStateResolver,
    threadMutationServerClient,
    threadMutationActionCoordinator,
    threadListStateController,
    pushClientStateManager,
    pushNotificationToolbarActionCoordinator
  };
}
