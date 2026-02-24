import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { ApplicationRouteStateMapper } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import {
  useMobileSidebarTouchHandlers
} from "@/Application/StateManagement/UseMobileSidebarTouchHandlers";
import {
  useCoreDataLoaders
} from "@/Application/StateManagement/UseCoreDataLoaders";
import {
  useApplicationOwnerDependencies
} from "@/Application/StateManagement/UseApplicationOwnerDependencies";
import {
  useApplicationShellViewProperties
} from "@/Application/StateManagement/UseApplicationShellViewProperties";
import { useViewportShellEffects } from "@/Application/StateManagement/UseViewportShellEffects";
import { useApplicationRefreshEffects } from "@/Application/StateManagement/UseApplicationRefreshEffects";
import { useEventStreamEffects } from "@/Application/StateManagement/UseEventStreamEffects";
import { bootstrapEventsSession } from "@/Application/DataAccess/WebShellApi";
import {
  ApplicationShellLayout
} from "@/Application/UserInterface/ApplicationShellLayout";
import { AgentFavicon } from "@/Application/UserInterface/AgentFavicon";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import {
  type PushClientState
} from "@/SharedUtilities/Push";
import {
  toErrorBannerDetails,
  toErrorMessage
} from "@/SharedUtilities/DebugHelpers";
import { ThreadGroupSelectors } from "@/Features/Threads/DomainModel/ThreadGroupSelectors";
import type {
  ThreadListItem,
  ThreadListResponse
} from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { useThreadActionHandlers } from "@/Features/Threads/StateManagement/UseThreadActionHandlers";
import {
  useThreadListPaneProperties
} from "@/Features/Threads/StateManagement/UseThreadListPaneProperties";
import {
  type CapabilityAgentsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityHealthResponse,
  type CapabilityModelsResponse
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  type ChatStreamEventsResponse
} from "@/Features/Chat/DataAccess/ChatServerClient";
import { ConversationSyncSignatureBuilder } from "@/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import {
  type FlattenedConversationItem
} from "@/Features/Chat/DomainModel/ConversationItemFlattener";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import {
  type PendingUserInputRequest
} from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { useChatActionHandlers } from "@/Features/Chat/StateManagement/UseChatActionHandlers";
import { useChatScrollEffects } from "@/Features/Chat/StateManagement/UseChatScrollEffects";
import {
  useSelectedThreadLoaders,
  type LoadSelectedThreadOptions
} from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import { useSelectedThreadLifecycleEffects } from "@/Features/Chat/StateManagement/UseSelectedThreadLifecycleEffects";
import { useModeAndPendingRequestEffects } from "@/Features/Chat/StateManagement/UseModeAndPendingRequestEffects";
import {
  useChatModeToolbarProperties
} from "@/Features/Chat/StateManagement/UseChatModeToolbarProperties";
import {
  type DebugErrorListResponse,
  type DebugHistoryDetailResponse,
  type DebugHistoryResponse,
  type DebugTraceStatusResponse
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import {
  type DebugIssueSeverityFilter
} from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { useDebugActionHandlers } from "@/Features/Debugging/StateManagement/UseDebugActionHandlers";
import {
  type TrackedUserInterfaceErrorReportInput
} from "@/Features/Debugging/StateManagement/TrackedUserInterfaceErrorReporter";
import { type DebugHistoryEntryListItem } from "@/Features/Debugging/UserInterface/DebugHistoryPanel";
import { type DebugTraceSummary } from "@/Features/Debugging/UserInterface/DebugTracePanel";
import {
  type DebugWorkspaceSection
} from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import { useTheme } from "@/Hooks/UseTheme";
import { StreamEventCard } from "@/Components/StreamEventCard";
import {
  TooltipProvider
} from "@/Components/UserInterface/Tooltip";

/* ── Types ─────────────────────────────────────────────────── */
type Health = CapabilityHealthResponse;
type ConfigDefaults = CapabilityConfigDefaultsResponse;
type ThreadsResponse = ThreadListResponse;
type ModesResponse = CapabilityCollaborationModesResponse;
type ModelsResponse = CapabilityModelsResponse;
type LiveStateResponse = ChatLiveStateResponse;
type StreamEventsResponse = ChatStreamEventsResponse;
type ReadThreadResponse = ChatReadThreadResponse;
type AgentsResponse = CapabilityAgentsResponse;
type TraceStatus = DebugTraceStatusResponse;
type HistoryResponse = DebugHistoryResponse;
type HistoryDetail = DebugHistoryDetailResponse;
type DebugErrorsResponse = DebugErrorListResponse;
type PendingRequest = PendingUserInputRequest;
type Thread = ThreadListItem;
type AgentDescriptor = AgentsResponse["agents"][number];
type CapabilitySnapshot = {
  modes: ModesResponse;
  models: ModelsResponse;
  defaults: ConfigDefaults | null;
  fetchedAt: number;
};
const modeSelectionStateResolver = new ModeSelectionStateResolver();
const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(modeSelectionStateResolver);
const applicationRouteStateMapper = new ApplicationRouteStateMapper();


const DEFAULT_EFFORT_OPTIONS = ["minimal", "low", "medium", "high", "xhigh"] as const;
const INITIAL_VISIBLE_CHAT_ITEMS = 90;
const VISIBLE_CHAT_ITEMS_STEP = 80;
const CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 48;
const CORE_REFRESH_INTERVAL_MS = 5_000;
const CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS = 60_000;
const CAPABILITIES_REFRESH_INTERVAL_MS = 5 * 60_000;
const THREAD_ONLY_HISTORY_METHODS = new Set(["thread-stream-state-changed", "thread-queued-followups-changed"]);
const READ_THREAD_RETRY_ATTEMPTS = 6;
const READ_THREAD_RETRY_BASE_DELAY_MS = 140;
const READ_THREAD_RETRY_MAX_DELAY_MS = 1_000;
const APP_DEFAULT_VALUE = "__app_default__";
const ASSUMED_APP_DEFAULT_MODEL = "gpt-5.3-codex";
const ASSUMED_APP_DEFAULT_EFFORT = "medium";
const DEBUG_HISTORY_LIMIT = 120;
const DEBUG_ERROR_LIST_LIMIT = 240;
const THREAD_LIST_LIMIT = 80;
const THREAD_LIST_MAX_PAGES = 20;
const ARCHIVED_THREAD_LIST_MAX_PAGES = 20;
const THREAD_QUERY_CACHE_TTL_MS = 1_500;
const THREAD_QUERY_CACHE_MAXIMUM_ENTRIES = 16;
const EVENT_REFRESH_SCHEDULE_DELAY_MS = 200;
const MOBILE_LAYOUT_MAX_WIDTH_PX = 768;
const MOBILE_SIDEBAR_SWIPE_EDGE_PX = 32;
const MOBILE_SIDEBAR_SWIPE_TRIGGER_PX = 56;
const MOBILE_SIDEBAR_SWIPE_MAX_VERTICAL_DRIFT_PX = 36;
const MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX = -14;
const MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX = 120;
const UNSUPPORTED_PUSH_CLIENT_STATE: PushClientState = {
  supported: false,
  serviceWorkerRegistered: false,
  permission: "unsupported",
  subscribed: false
};

/* ── Main App ───────────────────────────────────────────────── */
export function App(): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme();
  const initialUiState = useMemo(
    () => applicationRouteStateMapper.parseFromPathname(window.location.pathname),
    []
  );

  /* State */
  const [error, setError] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [configDefaults, setConfigDefaults] = useState<ConfigDefaults | null>(null);
  const [threads, setThreads] = useState<ThreadsResponse["data"]>([]);
  const [unreadThreadIds, setUnreadThreadIds] = useState<Record<string, true>>({});
  const [archivedThreads, setArchivedThreads] = useState<ThreadsResponse["data"]>([]);
  const [hasLoadedArchivedThreads, setHasLoadedArchivedThreads] = useState(false);
  const [archivedThreadsTruncated, setArchivedThreadsTruncated] = useState(false);
  const [isArchivedThreadsOpen, setIsArchivedThreadsOpen] = useState(false);
  const [isArchivedThreadsLoading, setIsArchivedThreadsLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialUiState.threadId);
  const [liveState, setLiveState] = useState<LiveStateResponse | null>(null);
  const [readThreadState, setReadThreadState] = useState<ReadThreadResponse | null>(null);
  const [isSelectedThreadLoading, setIsSelectedThreadLoading] = useState(
    Boolean(initialUiState.threadId)
  );
  const [streamEvents, setStreamEvents] = useState<StreamEventsResponse["events"]>([]);
  const [modes, setModes] = useState<ModesResponse["data"]>([]);
  const [models, setModels] = useState<ModelsResponse["data"]>([]);
  const [selectedModeKey, setSelectedModeKey] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [traceStatus, setTraceStatus] = useState<TraceStatus | null>(null);
  const [traceLabel, setTraceLabel] = useState("capture");
  const [traceNote, setTraceNote] = useState("");
  const [history, setHistory] = useState<HistoryResponse["history"]>([]);
  const [debugErrors, setDebugErrors] = useState<DebugErrorsResponse["data"]>([]);
  const [debugErrorSessionId, setDebugErrorSessionId] = useState("");
  const [debugErrorSessionLogPath, setDebugErrorSessionLogPath] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [historyDetail, setHistoryDetail] = useState<HistoryDetail | null>(null);
  const [isCoreLoading, setIsCoreLoading] = useState(true);
  const [waitForReplayResponse, setWaitForReplayResponse] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [answerDraft, setAnswerDraft] = useState<Record<string, { option: string; freeform: string }>>({});
  const [agentDescriptors, setAgentDescriptors] = useState<AgentDescriptor[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>("codex");
  const [pushClientState, setPushClientState] = useState<PushClientState>(
    UNSUPPORTED_PUSH_CLIENT_STATE
  );
  const [isEnablingPushNotifications, setIsEnablingPushNotifications] = useState(false);
  const [requiresApiSessionToken, setRequiresApiSessionToken] = useState(false);
  const [apiSessionTokenDraft, setApiSessionTokenDraft] = useState("");
  const [apiSessionBootstrapError, setApiSessionBootstrapError] = useState("");
  const [isApiSessionBootstrapPending, setIsApiSessionBootstrapPending] = useState(false);

  /* UI state */
  const [activeTab, setActiveTab] = useState<"chat" | "debug">(initialUiState.tab);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);
  const [visibleChatItemLimit, setVisibleChatItemLimit] = useState(INITIAL_VISIBLE_CHAT_ITEMS);
  const [hasHydratedModeFromLiveState, setHasHydratedModeFromLiveState] = useState(false);
  const [isModeSyncing, setIsModeSyncing] = useState(false);
  const [collapsedThreadProjectGroups, setCollapsedThreadProjectGroups] = useState<Record<string, boolean>>({});
  const [collapsedArchivedProjectGroups, setCollapsedArchivedProjectGroups] = useState<Record<string, boolean>>({});
  const [debugWorkspaceSection, setDebugWorkspaceSection] = useState<DebugWorkspaceSection>("issues");
  const [selectedDebugIssueId, setSelectedDebugIssueId] = useState("");
  const [debugIssueSeverityFilter, setDebugIssueSeverityFilter] = useState<DebugIssueSeverityFilter>("all");
  const [debugIssueFilterQuery, setDebugIssueFilterQuery] = useState("");

  /* Refs */
  const selectedThreadIdRef = useRef<string | null>(null);
  const activeTabRef = useRef<"chat" | "debug">(initialUiState.tab);
  const coreRefreshIntervalRef = useRef<number | null>(null);
  const eventsConnectedRef = useRef(false);
  const lastCoreRefreshAtRef = useRef(0);
  const applicationShellElementRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const isChatAtBottomRef = useRef(true);
  const lastAppliedModeSignatureRef = useRef("");
  const unreadThreadIdsRef = useRef<Record<string, true>>({});
  const hasHydratedAgentSelectionRef = useRef(false);
  const pendingMaterializationThreadIdsRef = useRef<Set<string>>(new Set());
  const debugErrorsSignatureRef = useRef<string[]>([]);
  const modesSignatureRef = useRef<string[]>([]);
  const modelsSignatureRef = useRef<string[]>([]);
  const isArchivedThreadsOpenRef = useRef(false);
  const hasLoadedArchivedThreadsRef = useRef(false);
  const selectedThreadLoadTokenRef = useRef(0);
  const loadCoreDataTrackedRef = useRef<(() => Promise<void>) | null>(null);
  const loadSelectedThreadRef = useRef<((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null>(
    null
  );
  const viewportKeyboardStateRef = useRef<boolean | null>(null);
  const viewportTelemetryLastReportedAtRef = useRef(0);
  const keyboardOpenScrollRafRef = useRef<number | null>(null);
  const {
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
    pushNotificationToolbarActionCoordinator
  } = useApplicationOwnerDependencies<CapabilitySnapshot>({
    setErrorMessage: setError,
    modeSelectionStateResolver,
    unsupportedPushClientState: UNSUPPORTED_PUSH_CLIENT_STATE,
    threadOnlyHistoryMethods: Array.from(THREAD_ONLY_HISTORY_METHODS),
    eventRefreshScheduleDelayMilliseconds: EVENT_REFRESH_SCHEDULE_DELAY_MS,
    mobileVisualViewportKeyboardOpenDeltaPx: MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX,
    mobileLayoutMaximumWidthPx: MOBILE_LAYOUT_MAX_WIDTH_PX,
    mobileSidebarSwipeEdgePx: MOBILE_SIDEBAR_SWIPE_EDGE_PX,
    mobileSidebarSwipeTriggerPx: MOBILE_SIDEBAR_SWIPE_TRIGGER_PX,
    mobileSidebarSwipeMaximumVerticalDriftPx: MOBILE_SIDEBAR_SWIPE_MAX_VERTICAL_DRIFT_PX,
    mobileSidebarSwipeCancelNegativePx: MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX,
    capabilitySnapshotRefreshIntervalMilliseconds: CAPABILITIES_REFRESH_INTERVAL_MS,
    chatScrollBottomThresholdPx: CHAT_SCROLL_BOTTOM_THRESHOLD_PX,
    readThreadRetryMaximumAttempts: READ_THREAD_RETRY_ATTEMPTS,
    readThreadRetryBaseDelayMilliseconds: READ_THREAD_RETRY_BASE_DELAY_MS,
    readThreadRetryMaximumDelayMilliseconds: READ_THREAD_RETRY_MAX_DELAY_MS,
    threadQueryCacheTimeToLiveMilliseconds: THREAD_QUERY_CACHE_TTL_MS,
    threadQueryCacheMaximumEntries: THREAD_QUERY_CACHE_MAXIMUM_ENTRIES
  });

  /* Derived */
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
    const map: Partial<Record<AgentId, AgentDescriptor>> = {};
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
  const appDefaultModel = configDefaults?.model ?? ASSUMED_APP_DEFAULT_MODEL;
  const appDefaultReasoningEffort = configDefaults?.reasoningEffort ?? ASSUMED_APP_DEFAULT_EFFORT;
  const selectedAgentLabel = selectedAgentDescriptor?.label ?? "Agent";
  const selectedAgentCapabilities = selectedAgentDescriptor?.capabilities ?? null;
  const activeProjectGroups = threadListPresentationState.activeProjectGroups;
  const archivedProjectGroups = threadListPresentationState.archivedProjectGroups;
  const archivedThreadIds = threadListPresentationState.archivedThreadIdentifiers;
  const archivedSectionThreadCount = threadListPresentationState.archivedSectionThreadCount;
  const conversationState = useMemo(() => {
    const liveConversationState = liveState?.conversationState ?? null;
    const readConversationState = readThreadState?.thread ?? null;
    if (!liveConversationState) return readConversationState;
    if (!readConversationState) return liveConversationState;
    const liveUpdatedAt = conversationSyncSignatureBuilder.readConversationStateUpdatedAt(
      liveConversationState
    );
    const readUpdatedAt = conversationSyncSignatureBuilder.readConversationStateUpdatedAt(
      readConversationState
    );
    return liveUpdatedAt > readUpdatedAt ? liveConversationState : readConversationState;
  }, [liveState?.conversationState, readThreadState?.thread]);

  const pendingRequests = useMemo(() => {
    if (!conversationState) return [] as PendingRequest[];
    return pendingUserInputRequestSelector.readPendingUserInputRequests(conversationState);
  }, [conversationState, pendingUserInputRequestSelector]);
  const liveStateReductionError = useMemo(() => {
    const errorState = liveState?.liveStateError;
    if (!errorState || errorState.kind !== "reductionFailed") {
      return null;
    }
    return errorState;
  }, [liveState?.liveStateError]);

  const activeRequest = useMemo<PendingRequest | null>(() => {
    const firstPendingRequest = pendingRequests[0] ?? null;
    if (!firstPendingRequest) return null;
    if (selectedRequestId === null) return firstPendingRequest;
    return pendingRequests.find((request) => request.id === selectedRequestId) ?? firstPendingRequest;
  }, [pendingRequests, selectedRequestId]);

  const activeThreadAgentId: AgentId = useMemo(
    () => selectedThread?.agentId ?? selectedAgentId,
    [selectedAgentId, selectedThread]
  );
  const activeAgentDescriptor = useMemo(
    () => agentsById[activeThreadAgentId] ?? selectedAgentDescriptor,
    [activeThreadAgentId, agentsById, selectedAgentDescriptor]
  );
  const selectedThreadLabel = selectedThread
    ? ThreadGroupSelectors.threadLabel(selectedThread)
    : selectedThreadId && isSelectedThreadLoading
      ? "Loading thread..."
      : "No thread selected";
  const historyDetailPayloadText = useMemo(() => {
    if (!historyDetail) {
      return "";
    }
    return JSON.stringify(historyDetail.fullPayload, null, 2);
  }, [historyDetail]);
  const recentTraceSummaries = useMemo<DebugTraceSummary[]>(() => {
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
  const streamEventCards = useMemo<React.JSX.Element[]>(() => (
    streamEvents
      .slice()
      .reverse()
      .map((streamEvent, streamEventIndex) => (
        <StreamEventCard key={streamEventIndex} event={streamEvent} />
      ))
  ), [streamEvents]);
  const debugHistoryEntryListItems = useMemo<DebugHistoryEntryListItem[]>(() => (
    history.map((historyEntry) => ({
      id: historyEntry.id,
      at: historyEntry.at,
      source: historyEntry.source,
      direction: historyEntry.direction
    }))
  ), [history]);
  const activeAgentLabel = activeAgentDescriptor?.label ?? selectedAgentLabel;
  const activeAgentCapabilities = activeAgentDescriptor?.capabilities ?? selectedAgentCapabilities;
  const canSetCollaborationMode = Boolean(activeAgentCapabilities?.canSetCollaborationMode);
  const canListModels = Boolean(activeAgentCapabilities?.canListModels);
  const canListCollaborationModes = Boolean(activeAgentCapabilities?.canListCollaborationModes);
  const canSubmitUserInputForActiveAgent = Boolean(activeAgentCapabilities?.canSubmitUserInput);

  const planModeOption = useMemo(
    () => modes.find((mode) => modeSelectionStateResolver.isPlanModeOption(mode)) ?? null,
    [modes]
  );
  const defaultModeOption = useMemo(
    () => modes.find((mode) => !modeSelectionStateResolver.isPlanModeOption(mode)) ?? modes[0] ?? null,
    [modes]
  );
  const isPlanModeEnabled = planModeOption !== null && selectedModeKey === planModeOption.mode;

  const effortOptions = useMemo(() => {
    const vals = new Set<string>(DEFAULT_EFFORT_OPTIONS);
    for (const m of modes) if (m.reasoning_effort) vals.add(m.reasoning_effort);
    const le = conversationState?.latestReasoningEffort;
    if (le) vals.add(le);
    if (selectedReasoningEffort) vals.add(selectedReasoningEffort);
    return Array.from(vals);
  }, [conversationState?.latestReasoningEffort, modes, selectedReasoningEffort]);
  const effortOptionsWithoutAssumedDefault = useMemo(
    () => effortOptions.filter((option) => option !== appDefaultReasoningEffort),
    [appDefaultReasoningEffort, effortOptions]
  );

  const modelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of models) {
      const label =
        m.displayName && m.displayName !== m.id
          ? `${m.displayName} (${m.id})`
          : m.displayName || m.id;
      map.set(m.id, label);
    }
    const lm = conversationState?.latestModel;
    if (lm && !map.has(lm)) map.set(lm, lm);
    if (selectedModelId && !map.has(selectedModelId)) map.set(selectedModelId, selectedModelId);
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [conversationState?.latestModel, models, selectedModelId]);
  const modelOptionsWithoutAssumedDefault = useMemo(
    () => modelOptions.filter((option) => option.id !== appDefaultModel),
    [appDefaultModel, modelOptions]
  );

  const deferredConversationState = useDeferredValue(conversationState);
  const turns = deferredConversationState?.turns ?? [];
  const lastTurn = turns[turns.length - 1];
  const isGenerating = conversationItemFlattener.isTurnInProgressStatus(lastTurn?.status);
  const threadListState = isCoreLoading
    ? "loading"
    : threads.length === 0
      ? "empty"
      : "ready";
  const chatSurfaceState = !selectedThreadId && isCoreLoading
    ? "loading-threads"
    : selectedThreadId && isSelectedThreadLoading
      ? "loading-thread"
    : turns.length === 0
      ? selectedThreadId
        ? "no-messages"
        : "no-thread"
      : "ready";
  const errorBannerDetails = useMemo(() => toErrorBannerDetails(error), [error]);
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
  const reportTrackedUiError = useCallback(
    async (input: TrackedUserInterfaceErrorReportInput): Promise<void> => {
      await trackedUserInterfaceErrorReporter.report(input);
    },
    [trackedUserInterfaceErrorReporter]
  );

  const buildActionRequestOptions = useCallback(
    (actionName: string) => userInterfaceActionRequestBuilder.create(actionName),
    [userInterfaceActionRequestBuilder]
  );

  const flatConversationItems = useMemo<FlattenedConversationItem[]>(
    () => conversationItemFlattener.flattenConversationItems(turns, isGenerating),
    [conversationItemFlattener, isGenerating, turns]
  );
  const conversationItemCount = flatConversationItems.length;
  const firstVisibleChatItemIndex = Math.max(0, conversationItemCount - visibleChatItemLimit);
  const hasHiddenChatItems = firstVisibleChatItemIndex > 0;
  const visibleConversationItems = useMemo(
    () => flatConversationItems.slice(firstVisibleChatItemIndex),
    [flatConversationItems, firstVisibleChatItemIndex]
  );
  const commitLabel = health?.state.gitCommit ?? "unknown";
  const codexConfigured = agentsById.codex?.enabled === true;
  const openCodeConnected = agentsById.opencode?.connected === true;
  const allSystemsReady = codexConfigured
    ? (
      health?.state.appReady === true &&
      health?.state.ipcConnected === true &&
      health?.state.ipcInitialized === true
    )
    : openCodeConnected;
  const hasAnySystemFailure = codexConfigured
    ? (
      health?.state.appReady === false ||
      health?.state.ipcConnected === false ||
      health?.state.ipcInitialized === false
    )
    : !openCodeConnected;
  const handleRuntimeRequestError = useCallback(<ErrorType,>(error: ErrorType): void => {
    const message = toErrorMessage(error);
    if (apiAuthenticationErrorClassifier.isApiTokenAuthenticationError(message)) {
      apiSessionBootstrapCoordinator.markApiTokenRequired();
      setRequiresApiSessionToken(true);
      setApiSessionBootstrapError("");
      return;
    }
    setError(message);
  }, [apiAuthenticationErrorClassifier, apiSessionBootstrapCoordinator]);

  const ensureApiSessionBootstrapped = useCallback(async (): Promise<boolean> => {
    const bootstrapDecision = await apiSessionBootstrapCoordinator.ensureSession(
      () => bootstrapEventsSession()
    );
    if (bootstrapDecision.isReady) {
      if (requiresApiSessionToken) {
        setRequiresApiSessionToken(false);
      }
      if (apiSessionBootstrapError.length > 0) {
        setApiSessionBootstrapError("");
      }
      return true;
    }
    if (bootstrapDecision.requiresApiToken) {
      setRequiresApiSessionToken(true);
      setApiSessionBootstrapError("");
    }
    return false;
  }, [
    apiSessionBootstrapCoordinator,
    apiSessionBootstrapError.length,
    requiresApiSessionToken
  ]);

  /* Data loading */
  const {
    loadArchivedThreads,
    loadCoreDataTracked,
    refreshAll
  } = useCoreDataLoaders({
    debugHistoryLimit: DEBUG_HISTORY_LIMIT,
    debugErrorListLimit: DEBUG_ERROR_LIST_LIMIT,
    threadListLimit: THREAD_LIST_LIMIT,
    threadListMaxPages: THREAD_LIST_MAX_PAGES,
    archivedThreadListMaxPages: ARCHIVED_THREAD_LIST_MAX_PAGES,
    capabilityServerClient,
    capabilitySnapshotCache,
    threadListStateController,
    debugServerClient,
    debugWorkspaceDataReader,
    debugWorkspaceStateStore,
    coreDataRefreshConcurrencyCoordinator,
    selectedThreadIdRef,
    activeTabRef,
    unreadThreadIdsRef,
    debugErrorsSignatureRef,
    modesSignatureRef,
    modelsSignatureRef,
    hasHydratedAgentSelectionRef,
    isArchivedThreadsOpenRef,
    hasLoadedArchivedThreadsRef,
    lastCoreRefreshAtRef,
    loadCoreDataTrackedRef,
    loadSelectedThreadRef,
    setHealth,
    setThreads,
    setUnreadThreadIds,
    setModes,
    setModels,
    setConfigDefaults,
    setTraceStatus,
    setHistory,
    setDebugErrors,
    setDebugErrorSessionId,
    setDebugErrorSessionLogPath,
    setAgentDescriptors,
    setSelectedAgentId,
    setSelectedThreadId,
    setSelectedModeKey,
    setIsArchivedThreadsLoading,
    setArchivedThreads,
    setArchivedThreadsTruncated,
    setHasLoadedArchivedThreads,
    setIsCoreLoading,
    ensureApiSessionBootstrapped,
    readInitialModeKey: (availableModes) => {
      const nonPlanDefault = availableModes.find((mode) => !modeSelectionStateResolver.isPlanModeOption(mode));
      return nonPlanDefault?.mode ?? availableModes[0]?.mode ?? "";
    },
    handleRuntimeRequestError
  });

  const {
    loadSelectedThreadTracked
  } = useSelectedThreadLoaders({
    threads,
    selectedAgentId,
    agentsById,
    appDefaultModel,
    appDefaultReasoningEffort,
    selectedThreadIdRef,
    pendingMaterializationThreadIdsRef,
    conversationSyncSignatureBuilder,
    selectedThreadDataRefreshCoordinator,
    selectedThreadRefreshConcurrencyCoordinator,
    readThreadStateMerger,
    chatServerClient,
    setLiveState,
    setReadThreadState,
    setStreamEvents
  });

  const submitApiSessionToken = useCallback(async (): Promise<void> => {
    const tokenValue = apiSessionTokenDraft.trim();
    if (tokenValue.length === 0) {
      setApiSessionBootstrapError("API token is required");
      return;
    }
    setIsApiSessionBootstrapPending(true);
    try {
      const bootstrapDecision = await apiSessionBootstrapCoordinator.submitApiToken(
        tokenValue,
        (apiToken) => bootstrapEventsSession({ apiToken })
      );
      if (!bootstrapDecision.isReady) {
        if (bootstrapDecision.requiresApiToken) {
          apiSessionBootstrapCoordinator.markApiTokenRequired();
        }
        setRequiresApiSessionToken(true);
        setApiSessionBootstrapError("Invalid API token");
        return;
      }
      setRequiresApiSessionToken(false);
      setApiSessionBootstrapError("");
      setApiSessionTokenDraft("");
      await refreshAll();
    } catch (error) {
      setApiSessionBootstrapError(toErrorMessage(error));
    } finally {
      setIsApiSessionBootstrapPending(false);
    }
  }, [apiSessionBootstrapCoordinator, apiSessionTokenDraft, refreshAll]);

  useEffect(() => {
    loadCoreDataTrackedRef.current = loadCoreDataTracked;
  }, [loadCoreDataTracked]);

  useEffect(() => {
    loadSelectedThreadRef.current = loadSelectedThreadTracked;
  }, [loadSelectedThreadTracked]);

  const refreshPushClientState = useCallback(async () => {
    await pushNotificationToolbarActionCoordinator.refreshPushClientState({
      onPushClientStateRead: setPushClientState
    });
  }, [pushNotificationToolbarActionCoordinator]);

  const enablePushNotificationsFromToolbar = useCallback(async () => {
    await pushNotificationToolbarActionCoordinator.enablePushNotificationsFromToolbar({
      onSetEnablingPushNotifications: setIsEnablingPushNotifications,
      onPushClientStateRead: setPushClientState,
      onSetErrorMessage: setError
    });
  }, [pushNotificationToolbarActionCoordinator]);

  useViewportShellEffects({
    applicationShellElementRef,
    scrollRef,
    activeTabRef,
    selectedThreadIdRef,
    isChatAtBottomRef,
    viewportKeyboardStateRef,
    viewportTelemetryLastReportedAtRef,
    keyboardOpenScrollRafRef,
    setIsChatAtBottom,
    runtimeViewportSizingCoordinator,
    pageTouchOverscrollGuardCoordinator,
    chatScrollStateCoordinator
  });

  useApplicationRefreshEffects({
    selectedThreadId,
    activeTab,
    unreadThreadIds,
    isArchivedThreadsOpen,
    hasLoadedArchivedThreads,
    filteredDebugIssues,
    selectedDebugIssueId,
    selectedThreadIdRef,
    activeTabRef,
    unreadThreadIdsRef,
    isArchivedThreadsOpenRef,
    hasLoadedArchivedThreadsRef,
    coreRefreshIntervalRef,
    eventsConnectedRef,
    lastCoreRefreshAtRef,
    setUnreadThreadIds,
    setSelectedThreadId,
    setActiveTab,
    setSelectedDebugIssueId,
    threadListStateController,
    debugIssueStateResolver,
    applicationRouteStateMapper,
    loadCoreDataTracked,
    loadArchivedThreads,
    refreshAll,
    refreshPushClientState,
    handleRuntimeRequestError,
    coreRefreshIntervalMs: CORE_REFRESH_INTERVAL_MS,
    coreRefreshConnectedMinIntervalMs: CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS
  });

  useSelectedThreadLifecycleEffects({
    selectedThreadId,
    selectedThreadIdRef,
    selectedThreadLoadTokenRef,
    loadSelectedThreadRef,
    selectedThreadRefreshConcurrencyCoordinator,
    setLiveState,
    setReadThreadState,
    setStreamEvents,
    setIsSelectedThreadLoading,
    setSelectedThreadId,
    handleRuntimeRequestError
  });

  useEventStreamEffects({
    debugHistoryLimit: DEBUG_HISTORY_LIMIT,
    debugErrorListLimit: DEBUG_ERROR_LIST_LIMIT,
    eventRefreshScheduler,
    eventStreamConnectionCoordinator,
    eventStreamRefreshDecisionEngine,
    activeTabRef,
    selectedThreadIdRef,
    loadCoreDataTrackedRef,
    loadSelectedThreadRef,
    debugWorkspaceDataReader,
    debugWorkspaceStateStore,
    debugErrorsSignatureRef,
    eventsConnectedRef,
    setHistory,
    setDebugErrors,
    setDebugErrorSessionId,
    setDebugErrorSessionLogPath,
    handleRuntimeRequestError
  });

  useModeAndPendingRequestEffects({
    activeRequest,
    setSelectedRequestId,
    setAnswerDraft,
    modeSelectionSyncCoordinator,
    conversationState,
    appDefaultModel,
    appDefaultReasoningEffort,
    defaultModeKey: defaultModeOption?.mode || "",
    selectedModeKey,
    selectedModelId,
    selectedReasoningEffort,
    hasHydratedModeFromLiveState,
    isModeSyncing,
    lastAppliedModeSignatureRef,
    setSelectedModeKey,
    setSelectedModelId,
    setSelectedReasoningEffort,
    setHasHydratedModeFromLiveState,
    setIsModeSyncing,
    selectedThreadId
  });

  useChatScrollEffects({
    activeTab,
    selectedThreadId,
    conversationItemCount,
    initialVisibleChatItemCount: INITIAL_VISIBLE_CHAT_ITEMS,
    scrollRef,
    chatContentRef,
    isChatAtBottom,
    isChatAtBottomRef,
    setIsChatAtBottom,
    setVisibleChatItemLimit,
    chatScrollStateCoordinator
  });

  const {
    submitMessage,
    applyModeDraft,
    submitPendingRequest,
    skipPendingRequest,
    runInterrupt,
    handleAnswerChange
  } = useChatActionHandlers({
    selectedThreadId,
    selectedAgentId,
    modes,
    isModeSyncing,
    activeRequest,
    answerDraft,
    setAnswerDraft,
    buildActionRequestOptions,
    setIsBusy,
    setIsModeSyncing,
    setSelectedThreadId,
    selectedThreadIdRef,
    pendingMaterializationThreadIdsRef,
    readLastAppliedModeSignature: () => lastAppliedModeSignatureRef.current,
    writeLastAppliedModeSignature: (nextModeSignature) => {
      lastAppliedModeSignatureRef.current = nextModeSignature;
    },
    chatRequestActionCoordinator,
    collaborationModeActionCoordinator,
    chatClient: chatServerClient,
    threadMutationClient: threadMutationServerClient,
    pendingUserInputAnswerBuilder,
    refreshAll,
    onReloadSelectedThread: loadSelectedThreadTracked,
    reportTrackedUserInterfaceError: reportTrackedUiError
  });

  const {
    loadHistoryDetail,
    replayHistoryEntryFromDetail,
    startTraceFromDebugPanel,
    markTraceFromDebugPanel,
    stopTraceFromDebugPanel,
    openDebugFromErrorBanner
  } = useDebugActionHandlers({
    debugWorkspaceActionCoordinator,
    debugServerClient,
    refreshAll,
    traceLabel,
    traceNote,
    errorBannerDetails,
    setActiveTab,
    setDebugWorkspaceSection,
    setDebugIssueSeverityFilter,
    setSelectedDebugIssueId,
    setDebugIssueFilterQuery,
    onHistoryDetailLoaded: setHistoryDetail
  });

  useEffect(() => {
    void loadHistoryDetail(selectedHistoryId).catch((error) => handleRuntimeRequestError(error));
  }, [handleRuntimeRequestError, loadHistoryDetail, selectedHistoryId]);

  const {
    createNewThread,
    createThreadForSingleAgent,
    runArchiveThread,
    runUnarchiveThread
  } = useThreadActionHandlers({
    availableAgentIds,
    threads,
    buildActionRequestOptions,
    setIsBusy,
    setError,
    setSelectedThreadId,
    setMobileSidebarOpen,
    selectedThreadIdRef,
    pendingMaterializationThreadIdsRef,
    threadMutationActionCoordinator,
    threadMutationServerClient,
    threadListStateController,
    loadCoreDataTracked,
    refreshAll,
    reportTrackedUserInterfaceError: reportTrackedUiError
  });

  const {
    endSidebarSwipeTracking,
    handleAppShellTouchStart,
    handleAppShellTouchMove
  } = useMobileSidebarTouchHandlers({
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileSidebarSwipeCoordinator,
    runtimeViewportSizingCoordinator
  });

  const renderAgentFavicon = useCallback(
    (agentId: AgentId, label: string, className: string) => (
      <AgentFavicon agentId={agentId} label={label} className={className} />
    ),
    []
  );
  const formatDateValue = useCallback(
    (value: number | string | null | undefined) => dateValueFormatter.format(value),
    [dateValueFormatter]
  );
  const threadListPaneProperties = useThreadListPaneProperties({
    threadListState,
    threads,
    isCoreLoading,
    availableAgentIds,
    selectedAgentDescriptor,
    selectedAgentLabel,
    agentsById,
    isBusy,
    activeProjectGroups,
    selectedThreadId,
    collapsedThreadProjectGroups,
    unreadThreadIds,
    isGenerating,
    setCollapsedThreadProjectGroups,
    createThreadForSingleAgent,
    createNewThread,
    setSelectedThreadId,
    setMobileSidebarOpen,
    archiveThread: runArchiveThread,
    isArchivedThreadsOpen,
    setIsArchivedThreadsOpen,
    isArchivedThreadsLoading,
    hasLoadedArchivedThreads,
    archivedSectionThreadCount,
    archivedThreadsTruncated,
    archivedProjectGroups,
    collapsedArchivedProjectGroups,
    archivedThreadIds,
    setCollapsedArchivedProjectGroups,
    unarchiveThread: runUnarchiveThread,
    formatDate: formatDateValue,
    renderAgentFavicon
  });
  const chatModeToolbarProperties = useChatModeToolbarProperties({
    canSetCollaborationMode,
    canListCollaborationModes,
    canListModels,
    planModeOption,
    defaultModeKey: defaultModeOption?.mode ?? null,
    isPlanModeEnabled,
    selectedThreadId,
    appDefaultValue: APP_DEFAULT_VALUE,
    appDefaultModel,
    appDefaultReasoningEffort,
    selectedModelId,
    selectedReasoningEffort,
    selectedModeKey,
    modelOptionsWithoutAssumedDefault,
    effortOptionsWithoutAssumedDefault,
    isModeSyncing,
    pendingRequestCount: pendingRequests.length,
    setSelectedModeKey,
    setSelectedModelId,
    setSelectedReasoningEffort,
    applyModeDraft
  });
  const {
    threadSidebarHealthState,
    applicationHeaderBarProperties,
    debugStatusBannersProperties,
    chatWorkspacePaneProperties,
    debugWorkspacePaneProperties,
    apiSessionBootstrapOverlayProperties
  } = useApplicationShellViewProperties({
    health,
    activeTab,
    desktopSidebarOpen,
    selectedThreadLabel,
    hasSelectedThread: selectedThread !== null,
    activeThreadAgentId,
    activeAgentLabel,
    isGenerating,
    pushClientState,
    isEnablingPushNotifications,
    isBusy,
    theme,
    setMobileSidebarOpen,
    setDesktopSidebarOpen,
    enablePushNotificationsFromToolbar,
    refreshAll,
    setActiveTab,
    toggleTheme,
    renderAgentFavicon,
    errorMessage: error,
    errorBannerDetails,
    openDebugFromErrorBanner,
    setErrorMessage: setError,
    liveStateReductionError,
    chatSurfaceState,
    selectedThreadId,
    isCoreLoading,
    isSelectedThreadLoading,
    availableAgentIds,
    turnCount: turns.length,
    scrollRef,
    chatContentRef,
    visibleConversationItems,
    hasHiddenChatItems,
    firstVisibleChatItemIndex,
    setVisibleChatItemLimit,
    conversationItemCount,
    visibleChatItemsStep: VISIBLE_CHAT_ITEMS_STEP,
    isChatAtBottom,
    chatScrollStateCoordinator,
    setIsChatAtBottom,
    activeRequest,
    canSubmitUserInputForActiveAgent,
    answerDraft,
    handleAnswerChange,
    submitPendingRequest,
    skipPendingRequest,
    selectedAgentLabel,
    runInterrupt,
    submitMessage,
    chatModeToolbarProperties,
    debugWorkspaceSection,
    setDebugWorkspaceSection,
    debugErrorIssueCount: debugErrorIssues.length,
    debugWarningIssueCount: debugWarningIssues.length,
    filteredDebugIssues,
    selectedDebugIssue,
    selectedDebugIssueId,
    debugIssueSeverityFilter,
    debugIssueFilterQuery,
    debugErrorSessionId,
    debugErrorSessionLogPath,
    setSelectedDebugIssueId,
    setDebugIssueSeverityFilter,
    setDebugIssueFilterQuery,
    debugHistoryEntryListItems,
    selectedHistoryId,
    selectedHistoryDetailId: historyDetail?.entry.id ?? null,
    historyDetailPayloadText,
    waitForReplayResponse,
    setSelectedHistoryId,
    setWaitForReplayResponse,
    replayHistoryEntryFromDetail,
    streamEventCount: streamEvents.length,
    streamEventCards,
    isTraceRecording: traceStatus?.active !== null,
    traceLabel,
    traceNote,
    setTraceLabel,
    setTraceNote,
    startTraceFromDebugPanel,
    markTraceFromDebugPanel,
    stopTraceFromDebugPanel,
    recentTraceSummaries,
    apiSessionTokenDraft,
    setApiSessionTokenDraft,
    apiSessionBootstrapError,
    setApiSessionBootstrapError,
    submitApiSessionToken,
    isApiSessionBootstrapPending
  });

  return (
    <TooltipProvider delayDuration={120}>
      <ApplicationShellLayout
        applicationShellElementRef={applicationShellElementRef}
        onAppShellTouchStart={handleAppShellTouchStart}
        onAppShellTouchMove={handleAppShellTouchMove}
        onEndSidebarSwipeTracking={endSidebarSwipeTracking}
        mobileSidebarOpen={mobileSidebarOpen}
        desktopSidebarOpen={desktopSidebarOpen}
        onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        onHideDesktopSidebar={() => setDesktopSidebarOpen(false)}
        threadListPaneProperties={threadListPaneProperties}
        allSystemsReady={allSystemsReady}
        hasAnySystemFailure={hasAnySystemFailure}
        commitLabel={commitLabel}
        agentDescriptors={agentDescriptors}
        codexConfigured={codexConfigured}
        threadSidebarHealthState={threadSidebarHealthState}
        activeTab={activeTab}
        applicationHeaderBarProperties={applicationHeaderBarProperties}
        debugStatusBannersProperties={debugStatusBannersProperties}
        chatWorkspacePaneProperties={chatWorkspacePaneProperties}
        debugWorkspacePaneProperties={debugWorkspacePaneProperties}
        showApiSessionBootstrapOverlay={requiresApiSessionToken}
        apiSessionBootstrapOverlayProperties={apiSessionBootstrapOverlayProperties}
      />
    </TooltipProvider>
  );
}
