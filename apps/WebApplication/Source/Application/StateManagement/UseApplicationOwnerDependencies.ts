import { useMemo } from "react";
import { WebShellSessionBootstrapClient } from "@/Application/DataAccess/WebShellSessionBootstrapClient";
import { ApiAuthenticationErrorClassifier } from "@/Application/DomainModel/ApiAuthenticationErrorClassifier";
import { DateValueFormatter } from "@/Application/DomainModel/DateValueFormatter";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import { CoreDataDeferredResourceCacheOwner } from "@/Application/StateManagement/CoreDataDeferredResourceCacheOwner";
import { CoreDataRefreshConcurrencyCoordinator } from "@/Application/StateManagement/CoreDataRefreshConcurrencyCoordinator";
import { EventRefreshScheduler } from "@/Application/StateManagement/EventRefreshScheduler";
import { EventStreamConnectionCoordinator } from "@/Application/StateManagement/EventStreamConnectionCoordinator";
import {
  EventStreamRefreshDecisionEngine,
  type EventStreamRefreshDecisionReader,
} from "@/Application/StateManagement/EventStreamRefreshDecisionEngine";
import type { EventStreamRefreshDecisionWorkerOwner } from "@/Application/StateManagement/EventStreamRefreshDecisionWorkerOwner";
import { MobileSidebarSwipeCoordinator } from "@/Application/StateManagement/MobileSidebarSwipeCoordinator";
import { PageTouchOverscrollGuardCoordinator } from "@/Application/StateManagement/PageTouchOverscrollGuardCoordinator";
import { RuntimeViewportSizingCoordinator } from "@/Application/StateManagement/RuntimeViewportSizingCoordinator";
import { UserInterfaceActionRequestBuilder } from "@/Application/StateManagement/UserInterfaceActionRequestBuilder";
import { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  CapabilitySnapshotCache,
  type CapabilitySnapshotRecord,
} from "@/Features/Capabilities/DataAccess/CapabilitySnapshotCache";
import { ChatServerClient } from "@/Features/Chat/DataAccess/ChatServerClient";
import {
  type SelectedThreadSnapshotCacheStore,
  SelectedThreadSnapshotIndexedDatabaseStore,
} from "@/Features/Chat/DataAccess/SelectedThreadSnapshotIndexedDatabaseStore";
import { ConversationItemFlattener } from "@/Features/Chat/DomainModel/ConversationItemFlattener";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import { PendingUserInputAnswerBuilder } from "@/Features/Chat/DomainModel/PendingUserInputAnswerBuilder";
import { PendingUserInputRequestSelector } from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { ChatRequestActionCoordinator } from "@/Features/Chat/StateManagement/ChatRequestActionCoordinator";
import { ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { CollaborationModeActionCoordinator } from "@/Features/Chat/StateManagement/CollaborationModeActionCoordinator";
import type { ConversationItemFlatteningWorkerOwner } from "@/Features/Chat/StateManagement/ConversationItemFlatteningWorkerOwner";
import { ModeSelectionSyncCoordinator } from "@/Features/Chat/StateManagement/ModeSelectionSyncCoordinator";
import { ReadThreadStateMerger } from "@/Features/Chat/StateManagement/ReadThreadStateMerger";
import { SelectedThreadDataRefreshCoordinator } from "@/Features/Chat/StateManagement/SelectedThreadDataRefreshCoordinator";
import { SelectedThreadRefreshConcurrencyCoordinator } from "@/Features/Chat/StateManagement/SelectedThreadRefreshConcurrencyCoordinator";
import { DebugServerClient } from "@/Features/Debugging/DataAccess/DebugServerClient";
import { DebugIssueStateResolver } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import type { DebugIssueDerivationWorkerOwner } from "@/Features/Debugging/StateManagement/DebugIssueDerivationWorkerOwner";
import { DebugWorkspaceActionCoordinator } from "@/Features/Debugging/StateManagement/DebugWorkspaceActionCoordinator";
import { DebugWorkspaceDataReader } from "@/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "@/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { TrackedUserInterfaceErrorReporter } from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";
import { PushClientStateManager } from "@/Features/PushNotifications/DataAccess/PushClientStateManager";
import { PushServerClient } from "@/Features/PushNotifications/DataAccess/PushServerClient";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushDiagnosticsRefreshStateOwner } from "@/Features/PushNotifications/StateManagement/PushDiagnosticsRefreshStateOwner";
import { PushNotificationToolbarActionCoordinator } from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";
import { LastViewedThreadPreferenceStore } from "@/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
import { ThreadDisplayNamePreferenceStore } from "@/Features/Threads/DataAccess/ThreadDisplayNamePreferenceStore";
import {
  ThreadListSnapshotIndexedDatabaseStore,
  type ThreadListSnapshotPersistenceStore,
} from "@/Features/Threads/DataAccess/ThreadListSnapshotIndexedDatabaseStore";
import { ThreadMutationServerClient } from "@/Features/Threads/DataAccess/ThreadMutationServerClient";
import { ThreadQueryCache } from "@/Features/Threads/DataAccess/ThreadQueryCache";
import { ThreadServerClient } from "@/Features/Threads/DataAccess/ThreadServerClient";
import { ThreadDisplayNameStateOwner } from "@/Features/Threads/StateManagement/ThreadDisplayNameStateOwner";
import { ThreadListPresentationStateResolver } from "@/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import type { ThreadListPresentationWorkerOwner } from "@/Features/Threads/StateManagement/ThreadListPresentationWorkerOwner";
import { ThreadListStateController } from "@/Features/Threads/StateManagement/ThreadListStateController";
import { ThreadListStateStore } from "@/Features/Threads/StateManagement/ThreadListStateStore";
import { ThreadMutationActionCoordinator } from "@/Features/Threads/StateManagement/ThreadMutationActionCoordinator";
import { ThreadRefreshConcurrencyCoordinator } from "@/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

export interface UseApplicationOwnerDependenciesInput {
  setErrorMessage: (errorMessage: string) => void;
  modeSelectionStateResolver: ModeSelectionStateResolver;
  unsupportedPushClientState: PushClientState;
  lastViewedThreadPreferenceStore: LastViewedThreadPreferenceStore;
  threadDisplayNamePreferenceStore: ThreadDisplayNamePreferenceStore;
  threadOnlyHistoryMethods: readonly string[];
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
  pushDiagnosticsRefreshTimeToLiveMilliseconds: number;
}

export interface ApplicationOwnerDependencies<
  CapabilitySnapshotType extends CapabilitySnapshotRecord,
> {
  apiAuthenticationErrorClassifier: ApiAuthenticationErrorClassifier;
  dateValueFormatter: DateValueFormatter;
  capabilityServerClient: CapabilityServerClient;
  webShellSessionBootstrapClient: WebShellSessionBootstrapClient;
  apiSessionBootstrapCoordinator: ApiSessionBootstrapCoordinator;
  coreDataRefreshConcurrencyCoordinator: CoreDataRefreshConcurrencyCoordinator;
  deferredResourceCacheOwner: CoreDataDeferredResourceCacheOwner;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionReader;
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamConnectionCoordinator: EventStreamConnectionCoordinator;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
  pageTouchOverscrollGuardCoordinator: PageTouchOverscrollGuardCoordinator;
  mobileSidebarSwipeCoordinator: MobileSidebarSwipeCoordinator;
  capabilitySnapshotCache: CapabilitySnapshotCache<CapabilitySnapshotType>;
  chatServerClient: ChatServerClient;
  selectedThreadSnapshotCacheStore: SelectedThreadSnapshotCacheStore;
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
  threadListPresentationWorkerOwner: ThreadListPresentationWorkerOwner | null;
  debugServerClient: DebugServerClient;
  debugWorkspaceDataReader: DebugWorkspaceDataReader;
  debugWorkspaceStateStore: DebugWorkspaceStateStore;
  debugWorkspaceActionCoordinator: DebugWorkspaceActionCoordinator;
  debugIssueStateResolver: DebugIssueStateResolver;
  debugIssueDerivationWorkerOwner: DebugIssueDerivationWorkerOwner | null;
  conversationItemFlatteningWorkerOwner: ConversationItemFlatteningWorkerOwner | null;
  threadServerClient: ThreadServerClient;
  threadMutationServerClient: ThreadMutationServerClient;
  threadMutationActionCoordinator: ThreadMutationActionCoordinator;
  threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
  threadListStateController: ThreadListStateController;
  lastViewedThreadPreferenceStore: LastViewedThreadPreferenceStore;
  pushServerClient: PushServerClient;
  pushClientStateManager: PushClientStateManager;
  pushDiagnosticsRefreshStateOwner: PushDiagnosticsRefreshStateOwner;
  pushNotificationToolbarActionCoordinator: PushNotificationToolbarActionCoordinator;
}

interface MobileSidebarSwipeConfiguration {
  mobileLayoutMaximumWidthPx: number;
  mobileSidebarSwipeEdgePx: number;
  mobileSidebarSwipeTriggerPx: number;
  mobileSidebarSwipeMaximumVerticalDriftPx: number;
  mobileSidebarSwipeCancelNegativePx: number;
}

interface SelectedThreadRetryConfiguration {
  readThreadRetryMaximumAttempts: number;
  readThreadRetryBaseDelayMilliseconds: number;
  readThreadRetryMaximumDelayMilliseconds: number;
}

interface ThreadListStateControllerConfiguration {
  threadServerClient: ThreadServerClient;
  threadQueryCacheTimeToLiveMilliseconds: number;
  threadQueryCacheMaximumEntries: number;
  threadListSnapshotPersistenceStore: ThreadListSnapshotPersistenceStore;
  threadDisplayNameStateOwner: ThreadDisplayNameStateOwner;
}

// These owner instances retain mutable runtime state and must remain stable across rerenders.
const STABLE_OWNER_MEMO_DEPENDENCIES: readonly [] = [];

function useStableOwner<OwnerType>(ownerFactory: () => OwnerType): OwnerType {
  return useMemo(ownerFactory, STABLE_OWNER_MEMO_DEPENDENCIES);
}

function createMobileSidebarSwipeCoordinator(
  configuration: MobileSidebarSwipeConfiguration,
): MobileSidebarSwipeCoordinator {
  return new MobileSidebarSwipeCoordinator({
    mobileLayoutMaximumWidthPx: configuration.mobileLayoutMaximumWidthPx,
    sidebarSwipeEdgePx: configuration.mobileSidebarSwipeEdgePx,
    sidebarSwipeTriggerPx: configuration.mobileSidebarSwipeTriggerPx,
    sidebarSwipeMaximumVerticalDriftPx: configuration.mobileSidebarSwipeMaximumVerticalDriftPx,
    sidebarSwipeCancelNegativePx: configuration.mobileSidebarSwipeCancelNegativePx,
  });
}

function createSelectedThreadDataRefreshCoordinator(
  configuration: SelectedThreadRetryConfiguration,
): SelectedThreadDataRefreshCoordinator {
  return new SelectedThreadDataRefreshCoordinator({
    retryConfiguration: {
      maximumAttempts: configuration.readThreadRetryMaximumAttempts,
      baseDelayMilliseconds: configuration.readThreadRetryBaseDelayMilliseconds,
      maximumDelayMilliseconds: configuration.readThreadRetryMaximumDelayMilliseconds,
    },
  });
}

function createThreadListStateController(
  configuration: ThreadListStateControllerConfiguration,
): ThreadListStateController {
  // The controller owns cache and presentation state and therefore composes these owners together.
  return new ThreadListStateController({
    threadServerClient: configuration.threadServerClient,
    threadQueryCache: new ThreadQueryCache(
      configuration.threadQueryCacheTimeToLiveMilliseconds,
      configuration.threadQueryCacheMaximumEntries,
    ),
    threadListSnapshotPersistenceStore: configuration.threadListSnapshotPersistenceStore,
    threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
    threadListStateStore: new ThreadListStateStore(),
    threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
    threadDisplayNameStateOwner: configuration.threadDisplayNameStateOwner,
  });
}

export function useApplicationOwnerDependencies<
  CapabilitySnapshotType extends CapabilitySnapshotRecord,
>(
  input: UseApplicationOwnerDependenciesInput,
): ApplicationOwnerDependencies<CapabilitySnapshotType> {
  const {
    setErrorMessage,
    modeSelectionStateResolver,
    unsupportedPushClientState,
    lastViewedThreadPreferenceStore,
    threadDisplayNamePreferenceStore,
    threadOnlyHistoryMethods,
    eventRefreshScheduleDelayMilliseconds,
    mobileVisualViewportKeyboardOpenDeltaPx,
    mobileLayoutMaximumWidthPx,
    mobileSidebarSwipeEdgePx,
    mobileSidebarSwipeTriggerPx,
    mobileSidebarSwipeMaximumVerticalDriftPx,
    mobileSidebarSwipeCancelNegativePx,
    capabilitySnapshotRefreshIntervalMilliseconds,
    chatScrollBottomThresholdPx,
    readThreadRetryMaximumAttempts,
    readThreadRetryBaseDelayMilliseconds,
    readThreadRetryMaximumDelayMilliseconds,
    threadQueryCacheTimeToLiveMilliseconds,
    threadQueryCacheMaximumEntries,
    pushDiagnosticsRefreshTimeToLiveMilliseconds,
  } = input;

  const apiAuthenticationErrorClassifier = useStableOwner(
    () => new ApiAuthenticationErrorClassifier(),
  );
  const dateValueFormatter = useStableOwner(() => new DateValueFormatter());
  const capabilityServerClient = useStableOwner(() => new CapabilityServerClient());
  const webShellSessionBootstrapClient = useStableOwner(() => new WebShellSessionBootstrapClient());
  const apiSessionBootstrapCoordinator = useStableOwner(() => new ApiSessionBootstrapCoordinator());
  const coreDataRefreshConcurrencyCoordinator = useStableOwner(
    () => new CoreDataRefreshConcurrencyCoordinator(),
  );
  const deferredResourceCacheOwner = useStableOwner(() => new CoreDataDeferredResourceCacheOwner());
  const eventStreamRefreshDecisionEngine = useMemo<EventStreamRefreshDecisionReader>(
    () => new EventStreamRefreshDecisionEngine(Array.from(threadOnlyHistoryMethods)),
    [threadOnlyHistoryMethods],
  );
  const eventRefreshScheduler = useMemo(
    () => new EventRefreshScheduler(eventRefreshScheduleDelayMilliseconds),
    [eventRefreshScheduleDelayMilliseconds],
  );
  const eventStreamConnectionCoordinator = useStableOwner(
    () => new EventStreamConnectionCoordinator(),
  );
  const runtimeViewportSizingCoordinator = useMemo(
    () =>
      new RuntimeViewportSizingCoordinator(
        mobileVisualViewportKeyboardOpenDeltaPx,
        mobileLayoutMaximumWidthPx,
      ),
    [mobileLayoutMaximumWidthPx, mobileVisualViewportKeyboardOpenDeltaPx],
  );
  const pageTouchOverscrollGuardCoordinator = useStableOwner(
    () => new PageTouchOverscrollGuardCoordinator(),
  );
  const mobileSidebarSwipeCoordinator = useMemo(
    () =>
      createMobileSidebarSwipeCoordinator({
        mobileLayoutMaximumWidthPx,
        mobileSidebarSwipeEdgePx,
        mobileSidebarSwipeTriggerPx,
        mobileSidebarSwipeMaximumVerticalDriftPx,
        mobileSidebarSwipeCancelNegativePx,
      }),
    [
      mobileLayoutMaximumWidthPx,
      mobileSidebarSwipeCancelNegativePx,
      mobileSidebarSwipeEdgePx,
      mobileSidebarSwipeMaximumVerticalDriftPx,
      mobileSidebarSwipeTriggerPx,
    ],
  );
  const capabilitySnapshotCache = useMemo(
    () =>
      new CapabilitySnapshotCache<CapabilitySnapshotType>(
        capabilitySnapshotRefreshIntervalMilliseconds,
      ),
    [capabilitySnapshotRefreshIntervalMilliseconds],
  );
  const chatServerClient = useStableOwner(() => new ChatServerClient());
  const selectedThreadSnapshotCacheStore = useStableOwner(
    () => new SelectedThreadSnapshotIndexedDatabaseStore(),
  );
  const selectedThreadRefreshConcurrencyCoordinator = useStableOwner(
    () => new SelectedThreadRefreshConcurrencyCoordinator(),
  );
  const readThreadStateMerger = useStableOwner(() => new ReadThreadStateMerger());
  const pendingUserInputRequestSelector = useStableOwner(
    () => new PendingUserInputRequestSelector(),
  );
  // Both coordinators read the same resolver owner to keep mode synchronization deterministic.
  const modeSelectionSyncCoordinator = useMemo(
    () => new ModeSelectionSyncCoordinator(modeSelectionStateResolver),
    [modeSelectionStateResolver],
  );
  const userInterfaceActionRequestBuilder = useStableOwner(
    () => new UserInterfaceActionRequestBuilder(),
  );
  const trackedUserInterfaceErrorReporter = useMemo(
    () =>
      new TrackedUserInterfaceErrorReporter({
        setErrorMessage,
      }),
    [setErrorMessage],
  );
  const pendingUserInputAnswerBuilder = useStableOwner(() => new PendingUserInputAnswerBuilder());
  const chatScrollStateCoordinator = useMemo(
    () => new ChatScrollStateCoordinator(chatScrollBottomThresholdPx),
    [chatScrollBottomThresholdPx],
  );
  const chatRequestActionCoordinator = useStableOwner(() => new ChatRequestActionCoordinator());
  const collaborationModeActionCoordinator = useMemo(
    () => new CollaborationModeActionCoordinator(modeSelectionStateResolver),
    [modeSelectionStateResolver],
  );
  const selectedThreadDataRefreshCoordinator = useMemo(
    () =>
      createSelectedThreadDataRefreshCoordinator({
        readThreadRetryMaximumAttempts,
        readThreadRetryBaseDelayMilliseconds,
        readThreadRetryMaximumDelayMilliseconds,
      }),
    [
      readThreadRetryBaseDelayMilliseconds,
      readThreadRetryMaximumAttempts,
      readThreadRetryMaximumDelayMilliseconds,
    ],
  );
  const conversationItemFlattener = useStableOwner(() => new ConversationItemFlattener());
  // Worker owners are app-lifetime dependencies. Disposing them in effect cleanup breaks
  // React StrictMode development preflight, which runs cleanup immediately after setup.
  const conversationItemFlatteningWorkerOwner = null;
  const debugServerClient = useStableOwner(() => new DebugServerClient());
  const debugWorkspaceDataReader = useMemo(
    () => new DebugWorkspaceDataReader(debugServerClient),
    [debugServerClient],
  );
  const debugWorkspaceStateStore = useStableOwner(() => new DebugWorkspaceStateStore());
  const debugWorkspaceActionCoordinator = useStableOwner(
    () => new DebugWorkspaceActionCoordinator(),
  );
  const debugIssueStateResolver = useStableOwner(() => new DebugIssueStateResolver());
  const debugIssueDerivationWorkerOwner = null;
  const threadServerClient = useStableOwner(() => new ThreadServerClient());
  const threadMutationServerClient = useStableOwner(() => new ThreadMutationServerClient());
  const threadMutationActionCoordinator = useStableOwner(
    () => new ThreadMutationActionCoordinator(),
  );
  const threadDisplayNameStateOwner = useMemo(
    () =>
      new ThreadDisplayNameStateOwner({
        threadDisplayNamePreferenceStore,
      }),
    [threadDisplayNamePreferenceStore],
  );
  const threadListSnapshotPersistenceStore = useStableOwner(
    () => new ThreadListSnapshotIndexedDatabaseStore(),
  );
  const threadListStateController = useMemo(
    () =>
      createThreadListStateController({
        threadServerClient,
        threadQueryCacheTimeToLiveMilliseconds,
        threadQueryCacheMaximumEntries,
        threadListSnapshotPersistenceStore,
        threadDisplayNameStateOwner,
      }),
    [
      threadServerClient,
      threadListSnapshotPersistenceStore,
      threadDisplayNameStateOwner,
      threadQueryCacheMaximumEntries,
      threadQueryCacheTimeToLiveMilliseconds,
    ],
  );
  const threadListPresentationWorkerOwner = null;
  const pushServerClient = useStableOwner(() => new PushServerClient());
  const pushClientStateManager = useStableOwner(() => new PushClientStateManager());
  const pushDiagnosticsRefreshStateOwner = useMemo(
    () =>
      new PushDiagnosticsRefreshStateOwner({
        timeToLiveMilliseconds: pushDiagnosticsRefreshTimeToLiveMilliseconds,
      }),
    [pushDiagnosticsRefreshTimeToLiveMilliseconds],
  );
  const pushNotificationToolbarActionCoordinator = useMemo(
    () =>
      new PushNotificationToolbarActionCoordinator({
        pushClientStateManager,
        unsupportedPushClientState,
      }),
    [unsupportedPushClientState, pushClientStateManager],
  );

  return {
    apiAuthenticationErrorClassifier,
    dateValueFormatter,
    capabilityServerClient,
    webShellSessionBootstrapClient,
    apiSessionBootstrapCoordinator,
    coreDataRefreshConcurrencyCoordinator,
    deferredResourceCacheOwner,
    eventStreamRefreshDecisionEngine,
    eventRefreshScheduler,
    eventStreamConnectionCoordinator,
    runtimeViewportSizingCoordinator,
    pageTouchOverscrollGuardCoordinator,
    mobileSidebarSwipeCoordinator,
    capabilitySnapshotCache,
    chatServerClient,
    selectedThreadSnapshotCacheStore,
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
    threadListPresentationWorkerOwner,
    debugServerClient,
    debugWorkspaceDataReader,
    debugWorkspaceStateStore,
    debugWorkspaceActionCoordinator,
    debugIssueStateResolver,
    debugIssueDerivationWorkerOwner,
    conversationItemFlatteningWorkerOwner,
    threadServerClient,
    threadMutationServerClient,
    threadMutationActionCoordinator,
    threadDisplayNameStateOwner,
    threadListStateController,
    lastViewedThreadPreferenceStore,
    pushServerClient,
    pushClientStateManager,
    pushDiagnosticsRefreshStateOwner,
    pushNotificationToolbarActionCoordinator,
  };
}
