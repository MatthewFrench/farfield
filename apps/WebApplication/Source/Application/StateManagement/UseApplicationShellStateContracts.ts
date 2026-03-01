import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { type ApplicationRouteState } from "@/Application/DomainModel/ApplicationRouteStateMapper";
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
import { type LoadSelectedThreadOptions } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";
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
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";
import { type SettingsWorkspaceSection } from "@/Features/Settings/DomainModel/SettingsWorkspaceSectionContracts";
import { type ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadSidebarRuntimeSummary,
} from "@/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { PendingThreadMaterializationCoordinator } from "@/Features/Threads/StateManagement/PendingThreadMaterializationCoordinator";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";

type AgentDescriptor = CapabilityAgentsResponse["agents"][number];
type ApplicationShellStateSetter<Value> = Dispatch<SetStateAction<Value>>;
type ApplicationShellMutableReference<Value> = MutableRefObject<Value>;
export type UnreadThreadIdentifierMap = Record<string, true>;
export interface AnswerDraftEntry {
  option: string;
  freeform: string;
}
export type AnswerDraftState = Record<string, AnswerDraftEntry>;
export type CollapsedProjectGroupMap = Record<string, boolean>;
export type ApplicationShellTab = "chat" | "debug";
export type CoreDataLoadFunction = () => Promise<void>;
export type SelectedThreadLoadFunction = (
  threadId: string,
  options?: LoadSelectedThreadOptions,
) => Promise<void>;
export type SignatureTokens = string[];

export interface UseApplicationShellStateInput {
  initialUiState: ApplicationRouteState;
  unsupportedPushClientState: PushClientState;
  initialVisibleChatItems: number;
}

export interface ApplicationShellState {
  error: string;
  setError: ApplicationShellStateSetter<string>;
  successBannerDetails: SuccessBannerDetails | null;
  setSuccessBannerDetails: ApplicationShellStateSetter<SuccessBannerDetails | null>;
  health: CapabilityHealthResponse | null;
  setHealth: ApplicationShellStateSetter<CapabilityHealthResponse | null>;
  configDefaults: CapabilityConfigDefaultsResponse | null;
  setConfigDefaults: ApplicationShellStateSetter<CapabilityConfigDefaultsResponse | null>;
  threads: ThreadListResponse["data"];
  setThreads: ApplicationShellStateSetter<ThreadListResponse["data"]>;
  unreadThreadIds: UnreadThreadIdentifierMap;
  setUnreadThreadIds: ApplicationShellStateSetter<UnreadThreadIdentifierMap>;
  threadRuntimeStatusByThreadIdentifier: ThreadRuntimeStatusByThreadIdentifier;
  setThreadRuntimeStatusByThreadIdentifier: ApplicationShellStateSetter<ThreadRuntimeStatusByThreadIdentifier>;
  threadSidebarRuntimeSummary: ThreadSidebarRuntimeSummary;
  setThreadSidebarRuntimeSummary: ApplicationShellStateSetter<ThreadSidebarRuntimeSummary>;
  archivedThreads: ThreadListResponse["data"];
  setArchivedThreads: ApplicationShellStateSetter<ThreadListResponse["data"]>;
  hasLoadedArchivedThreads: boolean;
  setHasLoadedArchivedThreads: ApplicationShellStateSetter<boolean>;
  archivedThreadsTruncated: boolean;
  setArchivedThreadsTruncated: ApplicationShellStateSetter<boolean>;
  isArchivedThreadsOpen: boolean;
  setIsArchivedThreadsOpen: ApplicationShellStateSetter<boolean>;
  isArchivedThreadsLoading: boolean;
  setIsArchivedThreadsLoading: ApplicationShellStateSetter<boolean>;
  selectedThreadId: string | null;
  setSelectedThreadId: ApplicationShellStateSetter<string | null>;
  liveState: ChatLiveStateResponse | null;
  setLiveState: ApplicationShellStateSetter<ChatLiveStateResponse | null>;
  readThreadState: ChatReadThreadResponse | null;
  setReadThreadState: ApplicationShellStateSetter<ChatReadThreadResponse | null>;
  isSelectedThreadLoading: boolean;
  setIsSelectedThreadLoading: ApplicationShellStateSetter<boolean>;
  streamEvents: ChatStreamEventsResponse["events"];
  setStreamEvents: ApplicationShellStateSetter<ChatStreamEventsResponse["events"]>;
  modes: CapabilityCollaborationModesResponse["data"];
  setModes: ApplicationShellStateSetter<CapabilityCollaborationModesResponse["data"]>;
  models: CapabilityModelsResponse["data"];
  setModels: ApplicationShellStateSetter<CapabilityModelsResponse["data"]>;
  selectedModeKey: string;
  setSelectedModeKey: ApplicationShellStateSetter<string>;
  selectedModelId: string;
  setSelectedModelId: ApplicationShellStateSetter<string>;
  selectedReasoningEffort: string;
  setSelectedReasoningEffort: ApplicationShellStateSetter<string>;
  isBusy: boolean;
  setIsBusy: ApplicationShellStateSetter<boolean>;
  traceStatus: DebugTraceStatusResponse | null;
  setTraceStatus: ApplicationShellStateSetter<DebugTraceStatusResponse | null>;
  traceLabel: string;
  setTraceLabel: ApplicationShellStateSetter<string>;
  traceNote: string;
  setTraceNote: ApplicationShellStateSetter<string>;
  history: DebugHistoryResponse["history"];
  setHistory: ApplicationShellStateSetter<DebugHistoryResponse["history"]>;
  debugErrors: DebugErrorListResponse["data"];
  setDebugErrors: ApplicationShellStateSetter<DebugErrorListResponse["data"]>;
  debugErrorSessionId: string;
  setDebugErrorSessionId: ApplicationShellStateSetter<string>;
  debugErrorSessionLogPath: string;
  setDebugErrorSessionLogPath: ApplicationShellStateSetter<string>;
  selectedHistoryId: string;
  setSelectedHistoryId: ApplicationShellStateSetter<string>;
  historyDetail: DebugHistoryDetailResponse | null;
  setHistoryDetail: ApplicationShellStateSetter<DebugHistoryDetailResponse | null>;
  isCoreLoading: boolean;
  setIsCoreLoading: ApplicationShellStateSetter<boolean>;
  waitForReplayResponse: boolean;
  setWaitForReplayResponse: ApplicationShellStateSetter<boolean>;
  selectedRequestId: number | null;
  setSelectedRequestId: ApplicationShellStateSetter<number | null>;
  answerDraft: AnswerDraftState;
  setAnswerDraft: ApplicationShellStateSetter<AnswerDraftState>;
  agentDescriptors: AgentDescriptor[];
  setAgentDescriptors: ApplicationShellStateSetter<AgentDescriptor[]>;
  selectedAgentId: AgentId;
  setSelectedAgentId: ApplicationShellStateSetter<AgentId>;
  pushClientState: PushClientState;
  setPushClientState: ApplicationShellStateSetter<PushClientState>;
  pushStatus: PushStatusResponse | null;
  setPushStatus: ApplicationShellStateSetter<PushStatusResponse | null>;
  latestPushReceipt: PushReceiptLatestResponse | null;
  setLatestPushReceipt: ApplicationShellStateSetter<PushReceiptLatestResponse | null>;
  latestPushSend: PushSendLatestResponse | null;
  setLatestPushSend: ApplicationShellStateSetter<PushSendLatestResponse | null>;
  pushLocalCertificateAuthorityStatus: PushLocalCertificateAuthorityStatusResponse | null;
  setPushLocalCertificateAuthorityStatus: ApplicationShellStateSetter<PushLocalCertificateAuthorityStatusResponse | null>;
  pushSettingsErrorMessage: string;
  setPushSettingsErrorMessage: ApplicationShellStateSetter<string>;
  pushTestResult: PushTestResponse | null;
  setPushTestResult: ApplicationShellStateSetter<PushTestResponse | null>;
  isRefreshingPushSettings: boolean;
  setIsRefreshingPushSettings: ApplicationShellStateSetter<boolean>;
  isSendingPushTestNotification: boolean;
  setIsSendingPushTestNotification: ApplicationShellStateSetter<boolean>;
  isEnablingPushNotifications: boolean;
  setIsEnablingPushNotifications: ApplicationShellStateSetter<boolean>;
  requiresApiSessionToken: boolean;
  setRequiresApiSessionToken: ApplicationShellStateSetter<boolean>;
  apiSessionTokenDraft: string;
  setApiSessionTokenDraft: ApplicationShellStateSetter<string>;
  apiSessionBootstrapError: string;
  setApiSessionBootstrapError: ApplicationShellStateSetter<string>;
  isApiSessionBootstrapPending: boolean;
  setIsApiSessionBootstrapPending: ApplicationShellStateSetter<boolean>;
  activeTab: ApplicationShellTab;
  setActiveTab: ApplicationShellStateSetter<ApplicationShellTab>;
  settingsWorkspaceSection: SettingsWorkspaceSection;
  setSettingsWorkspaceSection: ApplicationShellStateSetter<SettingsWorkspaceSection>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: ApplicationShellStateSetter<boolean>;
  desktopSidebarOpen: boolean;
  setDesktopSidebarOpen: ApplicationShellStateSetter<boolean>;
  isChatAtBottom: boolean;
  setIsChatAtBottom: ApplicationShellStateSetter<boolean>;
  visibleChatItemLimit: number;
  setVisibleChatItemLimit: ApplicationShellStateSetter<number>;
  hasHydratedModeFromLiveState: boolean;
  setHasHydratedModeFromLiveState: ApplicationShellStateSetter<boolean>;
  isModeSyncing: boolean;
  setIsModeSyncing: ApplicationShellStateSetter<boolean>;
  collapsedThreadProjectGroups: CollapsedProjectGroupMap;
  setCollapsedThreadProjectGroups: ApplicationShellStateSetter<CollapsedProjectGroupMap>;
  collapsedArchivedProjectGroups: CollapsedProjectGroupMap;
  setCollapsedArchivedProjectGroups: ApplicationShellStateSetter<CollapsedProjectGroupMap>;
  debugWorkspaceSection: DebugWorkspaceSection;
  setDebugWorkspaceSection: ApplicationShellStateSetter<DebugWorkspaceSection>;
  selectedDebugIssueId: string;
  setSelectedDebugIssueId: ApplicationShellStateSetter<string>;
  debugIssueSeverityFilter: DebugIssueSeverityFilter;
  setDebugIssueSeverityFilter: ApplicationShellStateSetter<DebugIssueSeverityFilter>;
  debugIssueFilterQuery: string;
  setDebugIssueFilterQuery: ApplicationShellStateSetter<string>;
  selectedThreadIdRef: ApplicationShellMutableReference<string | null>;
  activeTabRef: ApplicationShellMutableReference<ApplicationShellTab>;
  coreRefreshIntervalRef: ApplicationShellMutableReference<number | null>;
  eventsConnectedRef: ApplicationShellMutableReference<boolean>;
  lastCoreRefreshAtRef: ApplicationShellMutableReference<number>;
  applicationShellElementRef: ApplicationShellMutableReference<HTMLDivElement | null>;
  scrollRef: ApplicationShellMutableReference<HTMLDivElement | null>;
  chatContentRef: ApplicationShellMutableReference<HTMLDivElement | null>;
  isChatAtBottomRef: ApplicationShellMutableReference<boolean>;
  lastAppliedModeSignatureRef: ApplicationShellMutableReference<string>;
  unreadThreadIdsRef: ApplicationShellMutableReference<UnreadThreadIdentifierMap>;
  hasHydratedAgentSelectionRef: ApplicationShellMutableReference<boolean>;
  pendingThreadMaterializationCoordinator: PendingThreadMaterializationCoordinator;
  debugErrorsSignatureRef: ApplicationShellMutableReference<SignatureTokens>;
  modesSignatureRef: ApplicationShellMutableReference<SignatureTokens>;
  modelsSignatureRef: ApplicationShellMutableReference<SignatureTokens>;
  isArchivedThreadsOpenRef: ApplicationShellMutableReference<boolean>;
  hasLoadedArchivedThreadsRef: ApplicationShellMutableReference<boolean>;
  selectedThreadLoadTokenRef: ApplicationShellMutableReference<number>;
  loadCoreDataTrackedRef: ApplicationShellMutableReference<CoreDataLoadFunction | null>;
  loadSelectedThreadRef: ApplicationShellMutableReference<SelectedThreadLoadFunction | null>;
  viewportKeyboardStateRef: ApplicationShellMutableReference<boolean | null>;
  viewportTelemetryLastReportedAtRef: ApplicationShellMutableReference<number>;
  keyboardOpenScrollRafRef: ApplicationShellMutableReference<number | null>;
}
