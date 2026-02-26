import {
  useRef,
  useState
} from "react";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
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
import { type DebugWorkspaceSection } from "@/Features/Debugging/DomainModel/DebugWorkspaceSectionContracts";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import { type ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { useApplicationArchivedThreadState } from "./UseApplicationArchivedThreadState";
import { useApplicationPushState } from "./UseApplicationPushState";
import {
  type ApplicationShellState,
  type UseApplicationShellStateInput
} from "./UseApplicationShellStateContracts";

type AgentDescriptor = CapabilityAgentsResponse["agents"][number];

export type { ApplicationShellState, UseApplicationShellStateInput } from "./UseApplicationShellStateContracts";

export function useApplicationShellState(input: UseApplicationShellStateInput): ApplicationShellState {
  const [error, setError] = useState("");
  const [health, setHealth] = useState<CapabilityHealthResponse | null>(null);
  const [configDefaults, setConfigDefaults] = useState<CapabilityConfigDefaultsResponse | null>(null);
  const [threads, setThreads] = useState<ThreadListResponse["data"]>([]);
  const [unreadThreadIds, setUnreadThreadIds] = useState<Record<string, true>>({});
  const applicationArchivedThreadState = useApplicationArchivedThreadState();
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
  const applicationPushState = useApplicationPushState({
    unsupportedPushClientState: input.unsupportedPushClientState
  });
  const [activeTab, setActiveTab] = useState<"chat" | "debug">(input.initialUiState.tab);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);
  const [visibleChatItemLimit, setVisibleChatItemLimit] = useState(input.initialVisibleChatItems);
  const [hasHydratedModeFromLiveState, setHasHydratedModeFromLiveState] = useState(false);
  const [isModeSyncing, setIsModeSyncing] = useState(false);
  const [collapsedThreadProjectGroups, setCollapsedThreadProjectGroups] = useState<Record<string, boolean>>({});
  const [debugWorkspaceSection, setDebugWorkspaceSection] = useState<DebugWorkspaceSection>("issues");
  const [selectedDebugIssueId, setSelectedDebugIssueId] = useState("");
  const [debugIssueSeverityFilter, setDebugIssueSeverityFilter] = useState<DebugIssueSeverityFilter>("all");
  const [debugIssueFilterQuery, setDebugIssueFilterQuery] = useState("");
  const selectedThreadIdRef = useRef<string | null>(input.initialUiState.threadId);
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
  const pendingThreadMaterializationCoordinatorRef = useRef(
    new PendingThreadMaterializationCoordinator()
  );
  const pendingThreadMaterializationCoordinator = pendingThreadMaterializationCoordinatorRef.current;
  const debugErrorsSignatureRef = useRef<string[]>([]);
  const modesSignatureRef = useRef<string[]>([]);
  const modelsSignatureRef = useRef<string[]>([]);
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
    keyboardOpenScrollRafRef
  };
}
