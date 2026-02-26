import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import {
  type DebugIssue,
  type ErrorBannerDetails
} from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import {
  type ThreadListPaneProperties
} from "@/Features/Threads/UserInterface/ThreadListPane";
import {
  type CapabilityAgentsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityHealthResponse,
  type CapabilityModelsResponse
} from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type ChatLiveStateResponse,
  type ChatReadThreadResponse
} from "@/Features/Chat/DataAccess/ChatServerClient";
import {
  type FlattenedConversationItem,
  type ConversationItemFlattener
} from "@/Features/Chat/DomainModel/ConversationItemFlattener";
import { ModeSelectionStateResolver } from "@/Features/Chat/DomainModel/ModeSelectionStateResolver";
import {
  type PendingUserInputRequest,
  type PendingUserInputRequestSelector
} from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";
import { ConversationSyncSignatureBuilder } from "@/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { type ChatWorkspacePaneProps } from "@/Features/Chat/UserInterface/ChatWorkspacePane";
import {
  type DebugErrorListResponse,
  type DebugHistoryDetailResponse,
  type DebugHistoryResponse,
  type DebugTraceStatusResponse
} from "@/Features/Debugging/DataAccess/DebugServerClient";
import {
  DebugIssueStateResolver,
  type DebugIssueSeverityFilter
} from "@/Features/Debugging/DomainModel/DebugIssueStateResolver";
import { type DebugHistoryEntryListItem } from "@/Features/Debugging/UserInterface/DebugHistoryPanel";
import { type DebugTraceSummary } from "@/Features/Debugging/UserInterface/DebugTracePanel";
import type { ThreadListItem } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import {
  type ReadThreadListPresentationStateResult,
  type ThreadListStateController
} from "@/Features/Threads/StateManagement/ThreadListStateController";

type Health = CapabilityHealthResponse;
type ConfigDefaults = CapabilityConfigDefaultsResponse;
type ModesResponse = CapabilityCollaborationModesResponse;
type ModelsResponse = CapabilityModelsResponse;
type LiveStateResponse = ChatLiveStateResponse;
type ReadThreadResponse = ChatReadThreadResponse;
type AgentsResponse = CapabilityAgentsResponse;
type TraceStatus = DebugTraceStatusResponse;
type HistoryResponse = DebugHistoryResponse;
type HistoryDetail = DebugHistoryDetailResponse;
type DebugErrorsResponse = DebugErrorListResponse;
type PendingRequest = PendingUserInputRequest;
type Thread = ThreadListItem;
type AgentDescriptor = AgentsResponse["agents"][number];
type AgentDescriptorById = Partial<Record<AgentId, AgentDescriptor>>;
type ConversationState = NonNullable<LiveStateResponse["conversationState"]>;
type ModeOption = ModesResponse["data"][number];
type ModelOption = {
  id: string;
  label: string;
};

export type ApplicationConversationState = ConversationState;
export type ApplicationPendingRequest = PendingRequest;
export type ApplicationModeOption = ModeOption;
export type ApplicationModelOption = ModelOption;
export type ApplicationThreadListState = ThreadListPaneProperties["threadListState"];
export type ApplicationChatSurfaceState = ChatWorkspacePaneProps["chatSurfaceState"];
export type ApplicationHealthState = Health | null;

export interface UseApplicationDerivedStateInput {
  threads: Thread[];
  archivedThreads: Thread[];
  selectedThreadId: string | null;
  selectedRequestId: number | null;
  selectedAgentId: AgentId;
  selectedModeKey: string;
  selectedModelId: string;
  selectedReasoningEffort: string;
  visibleChatItemLimit: number;
  isCoreLoading: boolean;
  isSelectedThreadLoading: boolean;
  debugIssueSeverityFilter: DebugIssueSeverityFilter;
  debugIssueFilterQuery: string;
  selectedDebugIssueId: string;
  health: Health | null;
  configDefaults: ConfigDefaults | null;
  liveState: LiveStateResponse | null;
  readThreadState: ReadThreadResponse | null;
  modes: ModesResponse["data"];
  models: ModelsResponse["data"];
  agentDescriptors: AgentDescriptor[];
  history: HistoryResponse["history"];
  historyDetail: HistoryDetail | null;
  debugErrors: DebugErrorsResponse["data"];
  traceStatus: TraceStatus | null;
  errorMessage: string;
  defaultEffortOptions: readonly string[];
  assumedAppDefaultModelIdentifier: string;
  assumedAppDefaultReasoningEffort: string;
  modeSelectionStateResolver: ModeSelectionStateResolver;
  conversationSyncSignatureBuilder: ConversationSyncSignatureBuilder;
  pendingUserInputRequestSelector: PendingUserInputRequestSelector;
  conversationItemFlattener: ConversationItemFlattener;
  debugIssueStateResolver: DebugIssueStateResolver;
  threadListStateController: ThreadListStateController;
}

export interface ConversationStateSelectionInput {
  liveConversationState: ApplicationConversationState | null;
  readConversationState: ApplicationConversationState | null;
  conversationSyncSignatureBuilder: UseApplicationDerivedStateInput["conversationSyncSignatureBuilder"];
}

export interface ActiveRequestSelectionInput {
  pendingRequests: ApplicationPendingRequest[];
  selectedRequestId: number | null;
}

export interface SelectedThreadLabelInput {
  selectedThread: Thread | null;
  selectedThreadId: string | null;
  isSelectedThreadLoading: boolean;
}

export interface ThreadListStateInput {
  isCoreLoading: boolean;
  threadCount: number;
}

export interface ChatSurfaceStateInput {
  selectedThreadId: string | null;
  isCoreLoading: boolean;
  isSelectedThreadLoading: boolean;
  turnCount: number;
}

export interface ModelOptionsInput {
  models: UseApplicationDerivedStateInput["models"];
  latestModel: string | null | undefined;
  selectedModelId: string;
}

export interface SystemHealthStatus {
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
}

export interface SystemHealthStatusInput {
  codexConfigured: boolean;
  openCodeConnected: boolean;
  health: ApplicationHealthState;
}

export interface ApplicationDerivedState {
  threadListPresentationState: ReadThreadListPresentationStateResult;
  selectedThread: Thread | null;
  agentsById: AgentDescriptorById;
  availableAgentIds: AgentId[];
  selectedAgentDescriptor: AgentDescriptor | null;
  appDefaultModel: string;
  appDefaultReasoningEffort: string;
  selectedAgentLabel: string;
  selectedAgentCapabilities: AgentDescriptor["capabilities"] | null;
  activeProjectGroups: ReadThreadListPresentationStateResult["activeProjectGroups"];
  archivedProjectGroups: ReadThreadListPresentationStateResult["archivedProjectGroups"];
  archivedThreadIds: ReadThreadListPresentationStateResult["archivedThreadIdentifiers"];
  archivedSectionThreadCount: number;
  conversationState: ConversationState | null;
  pendingRequests: PendingRequest[];
  liveStateReductionError: LiveStateResponse["liveStateError"] | null;
  activeRequest: PendingRequest | null;
  activeThreadAgentId: AgentId;
  activeAgentDescriptor: AgentDescriptor | null;
  selectedThreadLabel: string;
  historyDetailPayloadText: string;
  recentTraceSummaries: DebugTraceSummary[];
  debugHistoryEntryListItems: DebugHistoryEntryListItem[];
  activeAgentLabel: string;
  activeAgentCapabilities: AgentDescriptor["capabilities"] | null;
  canSetCollaborationMode: boolean;
  canListModels: boolean;
  canListCollaborationModes: boolean;
  canSubmitUserInputForActiveAgent: boolean;
  planModeOption: ApplicationModeOption | null;
  defaultModeOption: ApplicationModeOption | null;
  isPlanModeEnabled: boolean;
  effortOptions: string[];
  effortOptionsWithoutAssumedDefault: string[];
  modelOptions: ApplicationModelOption[];
  modelOptionsWithoutAssumedDefault: ApplicationModelOption[];
  deferredConversationState: ConversationState | null;
  turns: ConversationState["turns"];
  lastTurn: ConversationState["turns"][number] | undefined;
  isGenerating: boolean;
  threadListState: ApplicationThreadListState;
  chatSurfaceState: ApplicationChatSurfaceState;
  errorBannerDetails: ErrorBannerDetails;
  debugErrorIssues: DebugIssue[];
  debugWarningIssues: DebugIssue[];
  debugIssues: DebugIssue[];
  filteredDebugIssues: DebugIssue[];
  selectedDebugIssue: DebugIssue | null;
  flatConversationItems: FlattenedConversationItem[];
  conversationItemCount: number;
  firstVisibleChatItemIndex: number;
  hasHiddenChatItems: boolean;
  visibleConversationItems: FlattenedConversationItem[];
  commitLabel: string;
  codexConfigured: boolean;
  openCodeConnected: boolean;
  allSystemsReady: boolean;
  hasAnySystemFailure: boolean;
}
