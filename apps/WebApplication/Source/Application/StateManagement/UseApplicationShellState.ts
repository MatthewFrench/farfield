import {
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react";
import { type ApplicationRouteState } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { type PushClientState } from "@/SharedUtilities/Push";
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
import { type LoadSelectedThreadOptions } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
import {
  type DebugErrorListResponse,
  type DebugHistoryDetailResponse,
  type DebugHistoryResponse,
  type DebugTraceStatusResponse
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import { type DebugIssueSeverityFilter } from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { type DebugWorkspaceSection } from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import { type ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

type AgentDescriptor = CapabilityAgentsResponse["agents"][number];

export interface UseApplicationShellStateInput {
  initialUiState: ApplicationRouteState;
  unsupportedPushClientState: PushClientState;
  initialVisibleChatItems: number;
}

export interface ApplicationShellState {
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  health: CapabilityHealthResponse | null;
  setHealth: Dispatch<SetStateAction<CapabilityHealthResponse | null>>;
  configDefaults: CapabilityConfigDefaultsResponse | null;
  setConfigDefaults: Dispatch<SetStateAction<CapabilityConfigDefaultsResponse | null>>;
  threads: ThreadListResponse["data"];
  setThreads: Dispatch<SetStateAction<ThreadListResponse["data"]>>;
  unreadThreadIds: Record<string, true>;
  setUnreadThreadIds: Dispatch<SetStateAction<Record<string, true>>>;
  archivedThreads: ThreadListResponse["data"];
  setArchivedThreads: Dispatch<SetStateAction<ThreadListResponse["data"]>>;
  hasLoadedArchivedThreads: boolean;
  setHasLoadedArchivedThreads: Dispatch<SetStateAction<boolean>>;
  archivedThreadsTruncated: boolean;
  setArchivedThreadsTruncated: Dispatch<SetStateAction<boolean>>;
  isArchivedThreadsOpen: boolean;
  setIsArchivedThreadsOpen: Dispatch<SetStateAction<boolean>>;
  isArchivedThreadsLoading: boolean;
  setIsArchivedThreadsLoading: Dispatch<SetStateAction<boolean>>;
  selectedThreadId: string | null;
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>;
  liveState: ChatLiveStateResponse | null;
  setLiveState: Dispatch<SetStateAction<ChatLiveStateResponse | null>>;
  readThreadState: ChatReadThreadResponse | null;
  setReadThreadState: Dispatch<SetStateAction<ChatReadThreadResponse | null>>;
  isSelectedThreadLoading: boolean;
  setIsSelectedThreadLoading: Dispatch<SetStateAction<boolean>>;
  streamEvents: ChatStreamEventsResponse["events"];
  setStreamEvents: Dispatch<SetStateAction<ChatStreamEventsResponse["events"]>>;
  modes: CapabilityCollaborationModesResponse["data"];
  setModes: Dispatch<SetStateAction<CapabilityCollaborationModesResponse["data"]>>;
  models: CapabilityModelsResponse["data"];
  setModels: Dispatch<SetStateAction<CapabilityModelsResponse["data"]>>;
  selectedModeKey: string;
  setSelectedModeKey: Dispatch<SetStateAction<string>>;
  selectedModelId: string;
  setSelectedModelId: Dispatch<SetStateAction<string>>;
  selectedReasoningEffort: string;
  setSelectedReasoningEffort: Dispatch<SetStateAction<string>>;
  isBusy: boolean;
  setIsBusy: Dispatch<SetStateAction<boolean>>;
  traceStatus: DebugTraceStatusResponse | null;
  setTraceStatus: Dispatch<SetStateAction<DebugTraceStatusResponse | null>>;
  traceLabel: string;
  setTraceLabel: Dispatch<SetStateAction<string>>;
  traceNote: string;
  setTraceNote: Dispatch<SetStateAction<string>>;
  history: DebugHistoryResponse["history"];
  setHistory: Dispatch<SetStateAction<DebugHistoryResponse["history"]>>;
  debugErrors: DebugErrorListResponse["data"];
  setDebugErrors: Dispatch<SetStateAction<DebugErrorListResponse["data"]>>;
  debugErrorSessionId: string;
  setDebugErrorSessionId: Dispatch<SetStateAction<string>>;
  debugErrorSessionLogPath: string;
  setDebugErrorSessionLogPath: Dispatch<SetStateAction<string>>;
  selectedHistoryId: string;
  setSelectedHistoryId: Dispatch<SetStateAction<string>>;
  historyDetail: DebugHistoryDetailResponse | null;
  setHistoryDetail: Dispatch<SetStateAction<DebugHistoryDetailResponse | null>>;
  isCoreLoading: boolean;
  setIsCoreLoading: Dispatch<SetStateAction<boolean>>;
  waitForReplayResponse: boolean;
  setWaitForReplayResponse: Dispatch<SetStateAction<boolean>>;
  selectedRequestId: number | null;
  setSelectedRequestId: Dispatch<SetStateAction<number | null>>;
  answerDraft: Record<string, { option: string; freeform: string }>;
  setAnswerDraft: Dispatch<SetStateAction<Record<string, { option: string; freeform: string }>>>;
  agentDescriptors: AgentDescriptor[];
  setAgentDescriptors: Dispatch<SetStateAction<AgentDescriptor[]>>;
  selectedAgentId: AgentId;
  setSelectedAgentId: Dispatch<SetStateAction<AgentId>>;
  pushClientState: PushClientState;
  setPushClientState: Dispatch<SetStateAction<PushClientState>>;
  isEnablingPushNotifications: boolean;
  setIsEnablingPushNotifications: Dispatch<SetStateAction<boolean>>;
  requiresApiSessionToken: boolean;
  setRequiresApiSessionToken: Dispatch<SetStateAction<boolean>>;
  apiSessionTokenDraft: string;
  setApiSessionTokenDraft: Dispatch<SetStateAction<string>>;
  apiSessionBootstrapError: string;
  setApiSessionBootstrapError: Dispatch<SetStateAction<string>>;
  isApiSessionBootstrapPending: boolean;
  setIsApiSessionBootstrapPending: Dispatch<SetStateAction<boolean>>;
  activeTab: "chat" | "debug";
  setActiveTab: Dispatch<SetStateAction<"chat" | "debug">>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  desktopSidebarOpen: boolean;
  setDesktopSidebarOpen: Dispatch<SetStateAction<boolean>>;
  isChatAtBottom: boolean;
  setIsChatAtBottom: Dispatch<SetStateAction<boolean>>;
  visibleChatItemLimit: number;
  setVisibleChatItemLimit: Dispatch<SetStateAction<number>>;
  hasHydratedModeFromLiveState: boolean;
  setHasHydratedModeFromLiveState: Dispatch<SetStateAction<boolean>>;
  isModeSyncing: boolean;
  setIsModeSyncing: Dispatch<SetStateAction<boolean>>;
  collapsedThreadProjectGroups: Record<string, boolean>;
  setCollapsedThreadProjectGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  collapsedArchivedProjectGroups: Record<string, boolean>;
  setCollapsedArchivedProjectGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  debugWorkspaceSection: DebugWorkspaceSection;
  setDebugWorkspaceSection: Dispatch<SetStateAction<DebugWorkspaceSection>>;
  selectedDebugIssueId: string;
  setSelectedDebugIssueId: Dispatch<SetStateAction<string>>;
  debugIssueSeverityFilter: DebugIssueSeverityFilter;
  setDebugIssueSeverityFilter: Dispatch<SetStateAction<DebugIssueSeverityFilter>>;
  debugIssueFilterQuery: string;
  setDebugIssueFilterQuery: Dispatch<SetStateAction<string>>;
  selectedThreadIdRef: MutableRefObject<string | null>;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  coreRefreshIntervalRef: MutableRefObject<number | null>;
  eventsConnectedRef: MutableRefObject<boolean>;
  lastCoreRefreshAtRef: MutableRefObject<number>;
  applicationShellElementRef: MutableRefObject<HTMLDivElement | null>;
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  chatContentRef: MutableRefObject<HTMLDivElement | null>;
  isChatAtBottomRef: MutableRefObject<boolean>;
  lastAppliedModeSignatureRef: MutableRefObject<string>;
  unreadThreadIdsRef: MutableRefObject<Record<string, true>>;
  hasHydratedAgentSelectionRef: MutableRefObject<boolean>;
  pendingMaterializationThreadIdsRef: MutableRefObject<Set<string>>;
  debugErrorsSignatureRef: MutableRefObject<string[]>;
  modesSignatureRef: MutableRefObject<string[]>;
  modelsSignatureRef: MutableRefObject<string[]>;
  isArchivedThreadsOpenRef: MutableRefObject<boolean>;
  hasLoadedArchivedThreadsRef: MutableRefObject<boolean>;
  selectedThreadLoadTokenRef: MutableRefObject<number>;
  loadCoreDataTrackedRef: MutableRefObject<(() => Promise<void>) | null>;
  loadSelectedThreadRef: MutableRefObject<((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null>;
  viewportKeyboardStateRef: MutableRefObject<boolean | null>;
  viewportTelemetryLastReportedAtRef: MutableRefObject<number>;
  keyboardOpenScrollRafRef: MutableRefObject<number | null>;
}

export function useApplicationShellState(input: UseApplicationShellStateInput): ApplicationShellState {
  const [error, setError] = useState("");
  const [health, setHealth] = useState<CapabilityHealthResponse | null>(null);
  const [configDefaults, setConfigDefaults] = useState<CapabilityConfigDefaultsResponse | null>(null);
  const [threads, setThreads] = useState<ThreadListResponse["data"]>([]);
  const [unreadThreadIds, setUnreadThreadIds] = useState<Record<string, true>>({});
  const [archivedThreads, setArchivedThreads] = useState<ThreadListResponse["data"]>([]);
  const [hasLoadedArchivedThreads, setHasLoadedArchivedThreads] = useState(false);
  const [archivedThreadsTruncated, setArchivedThreadsTruncated] = useState(false);
  const [isArchivedThreadsOpen, setIsArchivedThreadsOpen] = useState(false);
  const [isArchivedThreadsLoading, setIsArchivedThreadsLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(input.initialUiState.threadId);
  const [liveState, setLiveState] = useState<ChatLiveStateResponse | null>(null);
  const [readThreadState, setReadThreadState] = useState<ChatReadThreadResponse | null>(null);
  const [isSelectedThreadLoading, setIsSelectedThreadLoading] = useState(Boolean(input.initialUiState.threadId));
  const [streamEvents, setStreamEvents] = useState<ChatStreamEventsResponse["events"]>([]);
  const [modes, setModes] = useState<CapabilityCollaborationModesResponse["data"]>([]);
  const [models, setModels] = useState<CapabilityModelsResponse["data"]>([]);
  const [selectedModeKey, setSelectedModeKey] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [traceStatus, setTraceStatus] = useState<DebugTraceStatusResponse | null>(null);
  const [traceLabel, setTraceLabel] = useState("capture");
  const [traceNote, setTraceNote] = useState("");
  const [history, setHistory] = useState<DebugHistoryResponse["history"]>([]);
  const [debugErrors, setDebugErrors] = useState<DebugErrorListResponse["data"]>([]);
  const [debugErrorSessionId, setDebugErrorSessionId] = useState("");
  const [debugErrorSessionLogPath, setDebugErrorSessionLogPath] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [historyDetail, setHistoryDetail] = useState<DebugHistoryDetailResponse | null>(null);
  const [isCoreLoading, setIsCoreLoading] = useState(true);
  const [waitForReplayResponse, setWaitForReplayResponse] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [answerDraft, setAnswerDraft] = useState<Record<string, { option: string; freeform: string }>>({});
  const [agentDescriptors, setAgentDescriptors] = useState<AgentDescriptor[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>("codex");
  const [pushClientState, setPushClientState] = useState<PushClientState>(input.unsupportedPushClientState);
  const [isEnablingPushNotifications, setIsEnablingPushNotifications] = useState(false);
  const [requiresApiSessionToken, setRequiresApiSessionToken] = useState(false);
  const [apiSessionTokenDraft, setApiSessionTokenDraft] = useState("");
  const [apiSessionBootstrapError, setApiSessionBootstrapError] = useState("");
  const [isApiSessionBootstrapPending, setIsApiSessionBootstrapPending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "debug">(input.initialUiState.tab);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);
  const [visibleChatItemLimit, setVisibleChatItemLimit] = useState(input.initialVisibleChatItems);
  const [hasHydratedModeFromLiveState, setHasHydratedModeFromLiveState] = useState(false);
  const [isModeSyncing, setIsModeSyncing] = useState(false);
  const [collapsedThreadProjectGroups, setCollapsedThreadProjectGroups] = useState<Record<string, boolean>>({});
  const [collapsedArchivedProjectGroups, setCollapsedArchivedProjectGroups] = useState<Record<string, boolean>>({});
  const [debugWorkspaceSection, setDebugWorkspaceSection] = useState<DebugWorkspaceSection>("issues");
  const [selectedDebugIssueId, setSelectedDebugIssueId] = useState("");
  const [debugIssueSeverityFilter, setDebugIssueSeverityFilter] = useState<DebugIssueSeverityFilter>("all");
  const [debugIssueFilterQuery, setDebugIssueFilterQuery] = useState("");
  const selectedThreadIdRef = useRef<string | null>(null);
  const activeTabRef = useRef<"chat" | "debug">(input.initialUiState.tab);
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
  const loadSelectedThreadRef = useRef<((threadId: string, options?: LoadSelectedThreadOptions) => Promise<void>) | null>(null);
  const viewportKeyboardStateRef = useRef<boolean | null>(null);
  const viewportTelemetryLastReportedAtRef = useRef(0);
  const keyboardOpenScrollRafRef = useRef<number | null>(null);

  return {
    error,
    setError,
    health,
    setHealth,
    configDefaults,
    setConfigDefaults,
    threads,
    setThreads,
    unreadThreadIds,
    setUnreadThreadIds,
    archivedThreads,
    setArchivedThreads,
    hasLoadedArchivedThreads,
    setHasLoadedArchivedThreads,
    archivedThreadsTruncated,
    setArchivedThreadsTruncated,
    isArchivedThreadsOpen,
    setIsArchivedThreadsOpen,
    isArchivedThreadsLoading,
    setIsArchivedThreadsLoading,
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
    pushClientState,
    setPushClientState,
    isEnablingPushNotifications,
    setIsEnablingPushNotifications,
    requiresApiSessionToken,
    setRequiresApiSessionToken,
    apiSessionTokenDraft,
    setApiSessionTokenDraft,
    apiSessionBootstrapError,
    setApiSessionBootstrapError,
    isApiSessionBootstrapPending,
    setIsApiSessionBootstrapPending,
    activeTab,
    setActiveTab,
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
    collapsedArchivedProjectGroups,
    setCollapsedArchivedProjectGroups,
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
    pendingMaterializationThreadIdsRef,
    debugErrorsSignatureRef,
    modesSignatureRef,
    modelsSignatureRef,
    isArchivedThreadsOpenRef,
    hasLoadedArchivedThreadsRef,
    selectedThreadLoadTokenRef,
    loadCoreDataTrackedRef,
    loadSelectedThreadRef,
    viewportKeyboardStateRef,
    viewportTelemetryLastReportedAtRef,
    keyboardOpenScrollRafRef
  };
}
