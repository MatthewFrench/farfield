import { useRef, useState } from "react";
import {
  type CapabilityAgentsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityHealthResponse,
  type CapabilityModelsResponse,
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  type ChatStreamEventsResponse,
} from "@/Features/Chat/DataAccess/ChatServerClient";
import {
  type DebugErrorListResponse,
  type DebugHistoryDetailResponse,
  type DebugHistoryResponse,
  type DebugTraceStatusResponse,
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import { type SuccessBannerDetails } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { type DebugIssueSeverityFilter } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import {
  type PushLocalCertificateAuthorityStatusResponse,
  type PushReceiptLatestResponse,
  type PushSendLatestResponse,
  type PushStatusResponse,
  type PushTestResponse,
} from "@/Features/PushNotifications/DataAccess/PushServerClient";
import { type SettingsWorkspaceSection } from "@/Features/Settings/DomainModel/SettingsWorkspaceSectionContracts";
import { type ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadSidebarRuntimeSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { useApplicationArchivedThreadState } from "./UseApplicationArchivedThreadState";
import { useApplicationPushState } from "./UseApplicationPushState";
import {
  type AnswerDraftState,
  type ApplicationShellState,
  type ApplicationShellTab,
  type CollapsedProjectGroupMap,
  type CoreDataLoadFunction,
  type SelectedThreadLoadFunction,
  type SignatureTokens,
  type UnreadThreadIdentifierMap,
  type UseApplicationShellStateInput,
} from "./UseApplicationShellStateContracts";

type AgentDescriptor = CapabilityAgentsResponse["agents"][number];
interface ShellInitialFlags {
  isBusy: boolean;
  isCoreLoading: boolean;
  waitForReplayResponse: boolean;
  mobileSidebarOpen: boolean;
  desktopSidebarOpen: boolean;
  isChatAtBottom: boolean;
  hasHydratedModeFromLiveState: boolean;
  isModeSyncing: boolean;
  isRefreshingPushSettings: boolean;
  isSendingPushTestNotification: boolean;
  eventsConnected: boolean;
  hasHydratedAgentSelection: boolean;
}

interface RouteSeededShellState {
  selectedThreadIdentifier: string | null;
  activeTab: ApplicationShellTab;
  settingsWorkspaceSection: SettingsWorkspaceSection;
  isSelectedThreadLoading: boolean;
}

const INITIAL_TEXT_VALUE = "";
const INITIAL_TRACE_LABEL = "capture";
const INITIAL_DEBUG_WORKSPACE_SECTION: DebugWorkspaceSection = "issues";
const INITIAL_DEBUG_ISSUE_SEVERITY_FILTER: DebugIssueSeverityFilter = "all";
const INITIAL_NUMBER_VALUE = 0;
const INITIAL_NULLABLE_NUMBER_VALUE: number | null = null;
const DEFAULT_SELECTED_AGENT_IDENTIFIER: AgentId = "codex";
const INITIAL_SHELL_FLAGS: ShellInitialFlags = {
  isBusy: false,
  isCoreLoading: true,
  waitForReplayResponse: false,
  mobileSidebarOpen: false,
  desktopSidebarOpen: true,
  isChatAtBottom: true,
  hasHydratedModeFromLiveState: false,
  isModeSyncing: false,
  isRefreshingPushSettings: false,
  isSendingPushTestNotification: false,
  eventsConnected: false,
  hasHydratedAgentSelection: false,
};

function readRouteSeededShellState(input: UseApplicationShellStateInput): RouteSeededShellState {
  const selectedThreadIdentifier = input.initialUiState.threadId;
  return {
    selectedThreadIdentifier,
    activeTab: input.initialUiState.tab,
    settingsWorkspaceSection: input.initialUiState.settingsWorkspaceSection,
    isSelectedThreadLoading: selectedThreadIdentifier !== null,
  };
}

function createInitialThreadCollection(): ThreadListResponse["data"] {
  return [];
}

function createInitialUnreadThreadIdentifierMap(): UnreadThreadIdentifierMap {
  return {};
}

function createInitialThreadRuntimeStatusByThreadIdentifier(): ThreadRuntimeStatusByThreadIdentifier {
  return {};
}

function createInitialThreadSidebarRuntimeSummary(): ThreadSidebarRuntimeSummary {
  return {
    account: null,
    rateLimits: null,
    apps: null,
  };
}

function createInitialStreamEvents(): ChatStreamEventsResponse["events"] {
  return [];
}

function createInitialModes(): CapabilityCollaborationModesResponse["data"] {
  return [];
}

function createInitialModels(): CapabilityModelsResponse["data"] {
  return [];
}

function createInitialHistoryEntries(): DebugHistoryResponse["history"] {
  return [];
}

function createInitialDebugErrors(): DebugErrorListResponse["data"] {
  return [];
}

function createInitialAnswerDraftState(): AnswerDraftState {
  return {};
}

function createInitialAgentDescriptors(): AgentDescriptor[] {
  return [];
}

function createInitialCollapsedProjectGroupMap(): CollapsedProjectGroupMap {
  return {};
}

function createInitialSignatureTokens(): SignatureTokens {
  return [];
}

function createPendingThreadMaterializationCoordinator(): PendingThreadMaterializationCoordinator {
  return new PendingThreadMaterializationCoordinator();
}

export type {
  ApplicationShellState,
  UseApplicationShellStateInput,
} from "./UseApplicationShellStateContracts";

export function useApplicationShellState(
  input: UseApplicationShellStateInput,
): ApplicationShellState {
  // Invariant: route-seeded state and refs must initialize from one snapshot to avoid first-render divergence.
  const routeSeededShellState = readRouteSeededShellState(input);

  const [error, setError] = useState(INITIAL_TEXT_VALUE);
  const [successBannerDetails, setSuccessBannerDetails] = useState<SuccessBannerDetails | null>(
    null,
  );
  const [health, setHealth] = useState<CapabilityHealthResponse | null>(null);
  const [configDefaults, setConfigDefaults] = useState<CapabilityConfigDefaultsResponse | null>(
    null,
  );
  const [threads, setThreads] = useState<ThreadListResponse["data"]>(createInitialThreadCollection);
  const [unreadThreadIds, setUnreadThreadIds] = useState<UnreadThreadIdentifierMap>(
    createInitialUnreadThreadIdentifierMap,
  );
  const [threadRuntimeStatusByThreadIdentifier, setThreadRuntimeStatusByThreadIdentifier] =
    useState<ThreadRuntimeStatusByThreadIdentifier>(
      createInitialThreadRuntimeStatusByThreadIdentifier,
    );
  const [threadSidebarRuntimeSummary, setThreadSidebarRuntimeSummary] =
    useState<ThreadSidebarRuntimeSummary>(createInitialThreadSidebarRuntimeSummary);
  const applicationArchivedThreadState = useApplicationArchivedThreadState();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    routeSeededShellState.selectedThreadIdentifier,
  );
  const [liveState, setLiveState] = useState<ChatLiveStateResponse | null>(null);
  const [readThreadState, setReadThreadState] = useState<ChatReadThreadResponse | null>(null);
  const [isSelectedThreadLoading, setIsSelectedThreadLoading] = useState(
    routeSeededShellState.isSelectedThreadLoading,
  );
  const [streamEvents, setStreamEvents] =
    useState<ChatStreamEventsResponse["events"]>(createInitialStreamEvents);
  const [modes, setModes] =
    useState<CapabilityCollaborationModesResponse["data"]>(createInitialModes);
  const [models, setModels] = useState<CapabilityModelsResponse["data"]>(createInitialModels);
  const [selectedModeKey, setSelectedModeKey] = useState(INITIAL_TEXT_VALUE);
  const [selectedModelId, setSelectedModelId] = useState(INITIAL_TEXT_VALUE);
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState(INITIAL_TEXT_VALUE);
  const [isBusy, setIsBusy] = useState(INITIAL_SHELL_FLAGS.isBusy);
  const [traceStatus, setTraceStatus] = useState<DebugTraceStatusResponse | null>(null);
  const [traceLabel, setTraceLabel] = useState(INITIAL_TRACE_LABEL);
  const [traceNote, setTraceNote] = useState(INITIAL_TEXT_VALUE);
  const [history, setHistory] = useState<DebugHistoryResponse["history"]>(
    createInitialHistoryEntries,
  );
  const [debugErrors, setDebugErrors] =
    useState<DebugErrorListResponse["data"]>(createInitialDebugErrors);
  const [debugErrorSessionId, setDebugErrorSessionId] = useState(INITIAL_TEXT_VALUE);
  const [debugErrorSessionLogPath, setDebugErrorSessionLogPath] = useState(INITIAL_TEXT_VALUE);
  const [selectedHistoryId, setSelectedHistoryId] = useState(INITIAL_TEXT_VALUE);
  const [historyDetail, setHistoryDetail] = useState<DebugHistoryDetailResponse | null>(null);
  const [isCoreLoading, setIsCoreLoading] = useState(INITIAL_SHELL_FLAGS.isCoreLoading);
  const [waitForReplayResponse, setWaitForReplayResponse] = useState(
    INITIAL_SHELL_FLAGS.waitForReplayResponse,
  );
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(
    INITIAL_NULLABLE_NUMBER_VALUE,
  );
  const [answerDraft, setAnswerDraft] = useState<AnswerDraftState>(createInitialAnswerDraftState);
  const [agentDescriptors, setAgentDescriptors] = useState<AgentDescriptor[]>(
    createInitialAgentDescriptors,
  );
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>(
    DEFAULT_SELECTED_AGENT_IDENTIFIER,
  );
  const applicationPushState = useApplicationPushState({
    unsupportedPushClientState: input.unsupportedPushClientState,
  });
  const [pushStatus, setPushStatus] = useState<PushStatusResponse | null>(null);
  const [latestPushReceipt, setLatestPushReceipt] = useState<PushReceiptLatestResponse | null>(
    null,
  );
  const [latestPushSend, setLatestPushSend] = useState<PushSendLatestResponse | null>(null);
  const [pushLocalCertificateAuthorityStatus, setPushLocalCertificateAuthorityStatus] =
    useState<PushLocalCertificateAuthorityStatusResponse | null>(null);
  const [pushSettingsErrorMessage, setPushSettingsErrorMessage] = useState(INITIAL_TEXT_VALUE);
  const [pushTestResult, setPushTestResult] = useState<PushTestResponse | null>(null);
  const [isRefreshingPushSettings, setIsRefreshingPushSettings] = useState(
    INITIAL_SHELL_FLAGS.isRefreshingPushSettings,
  );
  const [isSendingPushTestNotification, setIsSendingPushTestNotification] = useState(
    INITIAL_SHELL_FLAGS.isSendingPushTestNotification,
  );
  const [activeTab, setActiveTab] = useState<ApplicationShellTab>(routeSeededShellState.activeTab);
  const [settingsWorkspaceSection, setSettingsWorkspaceSection] =
    useState<SettingsWorkspaceSection>(routeSeededShellState.settingsWorkspaceSection);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(INITIAL_SHELL_FLAGS.mobileSidebarOpen);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(
    INITIAL_SHELL_FLAGS.desktopSidebarOpen,
  );
  const [isChatAtBottom, setIsChatAtBottom] = useState(INITIAL_SHELL_FLAGS.isChatAtBottom);
  const [visibleChatItemLimit, setVisibleChatItemLimit] = useState(input.initialVisibleChatItems);
  const [hasHydratedModeFromLiveState, setHasHydratedModeFromLiveState] = useState(
    INITIAL_SHELL_FLAGS.hasHydratedModeFromLiveState,
  );
  const [isModeSyncing, setIsModeSyncing] = useState(INITIAL_SHELL_FLAGS.isModeSyncing);
  const [collapsedThreadProjectGroups, setCollapsedThreadProjectGroups] =
    useState<CollapsedProjectGroupMap>(createInitialCollapsedProjectGroupMap);
  const [debugWorkspaceSection, setDebugWorkspaceSection] = useState<DebugWorkspaceSection>(
    INITIAL_DEBUG_WORKSPACE_SECTION,
  );
  const [selectedDebugIssueId, setSelectedDebugIssueId] = useState(INITIAL_TEXT_VALUE);
  const [debugIssueSeverityFilter, setDebugIssueSeverityFilter] =
    useState<DebugIssueSeverityFilter>(INITIAL_DEBUG_ISSUE_SEVERITY_FILTER);
  const [debugIssueFilterQuery, setDebugIssueFilterQuery] = useState(INITIAL_TEXT_VALUE);
  const selectedThreadIdRef = useRef<string | null>(routeSeededShellState.selectedThreadIdentifier);
  const activeTabRef = useRef<ApplicationShellTab>(routeSeededShellState.activeTab);
  const coreRefreshIntervalRef = useRef<number | null>(INITIAL_NULLABLE_NUMBER_VALUE);
  const eventsConnectedRef = useRef(INITIAL_SHELL_FLAGS.eventsConnected);
  const lastCoreRefreshAtRef = useRef(INITIAL_NUMBER_VALUE);
  const applicationShellElementRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const isChatAtBottomRef = useRef(INITIAL_SHELL_FLAGS.isChatAtBottom);
  const lastAppliedModeSignatureRef = useRef(INITIAL_TEXT_VALUE);
  const unreadThreadIdsRef = useRef<UnreadThreadIdentifierMap>(
    createInitialUnreadThreadIdentifierMap(),
  );
  const hasHydratedAgentSelectionRef = useRef(INITIAL_SHELL_FLAGS.hasHydratedAgentSelection);
  const pendingThreadMaterializationCoordinatorRef = useRef(
    createPendingThreadMaterializationCoordinator(),
  );
  const pendingThreadMaterializationCoordinator =
    pendingThreadMaterializationCoordinatorRef.current;
  const debugErrorsSignatureRef = useRef<SignatureTokens>(createInitialSignatureTokens());
  const modesSignatureRef = useRef<SignatureTokens>(createInitialSignatureTokens());
  const modelsSignatureRef = useRef<SignatureTokens>(createInitialSignatureTokens());
  const selectedThreadLoadTokenRef = useRef(INITIAL_NUMBER_VALUE);
  const loadCoreDataTrackedRef = useRef<CoreDataLoadFunction | null>(null);
  const loadSelectedThreadRef = useRef<SelectedThreadLoadFunction | null>(null);
  const viewportKeyboardStateRef = useRef<boolean | null>(null);
  const viewportTelemetryLastReportedAtRef = useRef(INITIAL_NUMBER_VALUE);
  const keyboardOpenScrollRafRef = useRef<number | null>(INITIAL_NULLABLE_NUMBER_VALUE);

  return {
    error,
    setError,
    successBannerDetails,
    setSuccessBannerDetails,
    health,
    setHealth,
    configDefaults,
    setConfigDefaults,
    threads,
    setThreads,
    unreadThreadIds,
    setUnreadThreadIds,
    threadRuntimeStatusByThreadIdentifier,
    setThreadRuntimeStatusByThreadIdentifier,
    threadSidebarRuntimeSummary,
    setThreadSidebarRuntimeSummary,
    ...applicationArchivedThreadState,
    selectedThreadId,
    setSelectedThreadId,
    liveState,
    setLiveState,
    readThreadState,
    setReadThreadState,
    isSelectedThreadLoading,
    setIsSelectedThreadLoading,
    streamEvents,
    setStreamEvents,
    modes,
    setModes,
    models,
    setModels,
    selectedModeKey,
    setSelectedModeKey,
    selectedModelId,
    setSelectedModelId,
    selectedReasoningEffort,
    setSelectedReasoningEffort,
    isBusy,
    setIsBusy,
    traceStatus,
    setTraceStatus,
    traceLabel,
    setTraceLabel,
    traceNote,
    setTraceNote,
    history,
    setHistory,
    debugErrors,
    setDebugErrors,
    debugErrorSessionId,
    setDebugErrorSessionId,
    debugErrorSessionLogPath,
    setDebugErrorSessionLogPath,
    selectedHistoryId,
    setSelectedHistoryId,
    historyDetail,
    setHistoryDetail,
    isCoreLoading,
    setIsCoreLoading,
    waitForReplayResponse,
    setWaitForReplayResponse,
    selectedRequestId,
    setSelectedRequestId,
    answerDraft,
    setAnswerDraft,
    agentDescriptors,
    setAgentDescriptors,
    selectedAgentId,
    setSelectedAgentId,
    ...applicationPushState,
    pushStatus,
    setPushStatus,
    latestPushReceipt,
    setLatestPushReceipt,
    latestPushSend,
    setLatestPushSend,
    pushLocalCertificateAuthorityStatus,
    setPushLocalCertificateAuthorityStatus,
    pushSettingsErrorMessage,
    setPushSettingsErrorMessage,
    pushTestResult,
    setPushTestResult,
    isRefreshingPushSettings,
    setIsRefreshingPushSettings,
    isSendingPushTestNotification,
    setIsSendingPushTestNotification,
    activeTab,
    setActiveTab,
    settingsWorkspaceSection,
    setSettingsWorkspaceSection,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    desktopSidebarOpen,
    setDesktopSidebarOpen,
    isChatAtBottom,
    setIsChatAtBottom,
    visibleChatItemLimit,
    setVisibleChatItemLimit,
    hasHydratedModeFromLiveState,
    setHasHydratedModeFromLiveState,
    isModeSyncing,
    setIsModeSyncing,
    collapsedThreadProjectGroups,
    setCollapsedThreadProjectGroups,
    debugWorkspaceSection,
    setDebugWorkspaceSection,
    selectedDebugIssueId,
    setSelectedDebugIssueId,
    debugIssueSeverityFilter,
    setDebugIssueSeverityFilter,
    debugIssueFilterQuery,
    setDebugIssueFilterQuery,
    selectedThreadIdRef,
    activeTabRef,
    coreRefreshIntervalRef,
    eventsConnectedRef,
    lastCoreRefreshAtRef,
    applicationShellElementRef,
    scrollRef,
    chatContentRef,
    isChatAtBottomRef,
    lastAppliedModeSignatureRef,
    unreadThreadIdsRef,
    hasHydratedAgentSelectionRef,
    pendingThreadMaterializationCoordinator,
    debugErrorsSignatureRef,
    modesSignatureRef,
    modelsSignatureRef,
    selectedThreadLoadTokenRef,
    loadCoreDataTrackedRef,
    loadSelectedThreadRef,
    viewportKeyboardStateRef,
    viewportTelemetryLastReportedAtRef,
    keyboardOpenScrollRafRef,
  };
}
