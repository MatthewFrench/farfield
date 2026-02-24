import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { type ApplicationRouteState } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
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
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
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
