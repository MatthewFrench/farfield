import { useMemo } from "react";
import { WebShellSessionBootstrapClient } from "@/Application/DataAccess/WebShellSessionBootstrapClient";
import { ApiAuthenticationErrorClassifier } from "@/Application/DomainModel/ApiAuthenticationErrorClassifier";
import { DateValueFormatter } from "@/Application/DomainModel/DateValueFormatter";
import { ApiSessionBootstrapCoordinator } from "@/Application/StateManagement/ApiSessionBootstrapCoordinator";
import { CoreDataRefreshConcurrencyCoordinator } from "@/Application/StateManagement/CoreDataRefreshConcurrencyCoordinator";
import { EventRefreshScheduler } from "@/Application/StateManagement/EventRefreshScheduler";
import { EventStreamConnectionCoordinator } from "@/Application/StateManagement/EventStreamConnectionCoordinator";
import {
  EventStreamRefreshDecisionEngine,
  type EventStreamRefreshDecisionReader,
} from "@/Application/StateManagement/EventStreamRefreshDecisionEngine";
import { EventStreamRefreshDecisionWorkerOwner } from "@/Application/StateManagement/EventStreamRefreshDecisionWorkerOwner";
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
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { PushNotificationToolbarActionCoordinator } from "@/Features/PushNotifications/StateManagement/PushNotificationToolbarActionCoordinator";
import { LastViewedThreadPreferenceStore } from "@/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
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
  lastViewedThreadPreferenceStore: LastViewedThreadPreferenceStore;
  threadOnlyHistoryMethods: readonly string[];
  eventStreamRefreshDecisionExecutionMode?: "worker" | "in-thread";
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
  CapabilitySnapshotType extends CapabilitySnapshotRecord,
> {
  apiAuthenticationErrorClassifier: ApiAuthenticationErrorClassifier;
  dateValueFormatter: DateValueFormatter;
  capabilityServerClient: CapabilityServerClient;
  webShellSessionBootstrapClient: WebShellSessionBootstrapClient;
  apiSessionBootstrapCoordinator: ApiSessionBootstrapCoordinator;
  coreDataRefreshConcurrencyCoordinator: CoreDataRefreshConcurrencyCoordinator;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionReader;
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
  lastViewedThreadPreferenceStore: LastViewedThreadPreferenceStore;
  pushClientStateManager: PushClientStateManager;
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
  threadQueryCacheTimeToLiveMilliseconds: number;
  threadQueryCacheMaximumEntries: number;
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
    threadServerClient: new ThreadServerClient(),
    threadQueryCache: new ThreadQueryCache(
      configuration.threadQueryCacheTimeToLiveMilliseconds,
      configuration.threadQueryCacheMaximumEntries,
    ),
    threadRefreshConcurrencyCoordinator: new ThreadRefreshConcurrencyCoordinator(),
    threadListStateStore: new ThreadListStateStore(),
    threadListPresentationStateResolver: new ThreadListPresentationStateResolver(),
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
    threadOnlyHistoryMethods,
    eventStreamRefreshDecisionExecutionMode = "in-thread",
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
  const eventStreamRefreshDecisionEngine = useMemo<EventStreamRefreshDecisionReader>(() => {
    if (eventStreamRefreshDecisionExecutionMode === "worker") {
      return new EventStreamRefreshDecisionWorkerOwner({
        threadOnlyHistoryMethods,
        createWorker: () =>
          new Worker(new URL("./EventStreamRefreshDecisionWorkerRuntime.ts", import.meta.url), {
            type: "module",
          }),
      });
    }
    return new EventStreamRefreshDecisionEngine(Array.from(threadOnlyHistoryMethods));
  }, [eventStreamRefreshDecisionExecutionMode, threadOnlyHistoryMethods]);
  const eventRefreshScheduler = useMemo(
    () => new EventRefreshScheduler(eventRefreshScheduleDelayMilliseconds),
    [eventRefreshScheduleDelayMilliseconds],
  );
  const eventStreamConnectionCoordinator = useStableOwner(
    () => new EventStreamConnectionCoordinator(),
  );
  const runtimeViewportSizingCoordinator = useMemo(
    () => new RuntimeViewportSizingCoordinator(mobileVisualViewportKeyboardOpenDeltaPx),
    [mobileVisualViewportKeyboardOpenDeltaPx],
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
  const threadMutationServerClient = useStableOwner(() => new ThreadMutationServerClient());
  const threadMutationActionCoordinator = useStableOwner(
    () => new ThreadMutationActionCoordinator(),
  );
  const threadListStateController = useMemo(
    () =>
      createThreadListStateController({
        threadQueryCacheTimeToLiveMilliseconds,
        threadQueryCacheMaximumEntries,
      }),
    [threadQueryCacheMaximumEntries, threadQueryCacheTimeToLiveMilliseconds],
  );
  const pushClientStateManager = useStableOwner(() => new PushClientStateManager());
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
    lastViewedThreadPreferenceStore,
    pushClientStateManager,
    pushNotificationToolbarActionCoordinator,
  };
}
