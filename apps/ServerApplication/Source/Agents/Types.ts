import type {
  AppServerCollaborationModeListResponse,
  AppServerListModelsResponse,
  AppServerListThreadsResponse,
  AppServerReadThreadResponse,
  AppServerStartThreadResponse,
  CollaborationMode,
  IpcFrame,
  UserInputResponsePayload
} from "@farfield/protocol";

/**
 * Owns canonical cross-adapter server contracts used by routing, thread ownership,
 * and runtime composition modules.
 */
export type AgentId = "codex" | "opencode";

// Agent identifiers are shared across route parsing, adapter selection, and ownership caches.
// Keep the literals centralized in this contract owner to prevent drift.
export const AgentIdentifierByName: {
  codex: AgentId;
  opencode: AgentId;
} = {
  codex: "codex",
  opencode: "opencode"
};

export const AgentIdentifierValues: ReadonlyArray<AgentId> = [
  AgentIdentifierByName.codex,
  AgentIdentifierByName.opencode
];

export type AgentThreadListSortKey = "created_at" | "updated_at";

export const AgentThreadListSortKeyByName: {
  createdAt: AgentThreadListSortKey;
  updatedAt: AgentThreadListSortKey;
} = {
  createdAt: "created_at",
  updatedAt: "updated_at"
};

export const AgentThreadListSortKeyValues: ReadonlyArray<AgentThreadListSortKey> = [
  AgentThreadListSortKeyByName.createdAt,
  AgentThreadListSortKeyByName.updatedAt
];

export interface AgentCapabilities {
  canListModels: boolean;
  canListCollaborationModes: boolean;
  canSetCollaborationMode: boolean;
  canSubmitUserInput: boolean;
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
}

export interface AgentListThreadsInput {
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
  cursor: string | null;
  sortKey: AgentThreadListSortKey;
  cwd: string | null;
}

export interface AgentCreateThreadInput {
  cwd?: string;
  model?: string;
  modelProvider?: string;
  personality?: string;
  sandbox?: string;
  approvalPolicy?: string;
  ephemeral?: boolean;
}

export type AgentThreadListItem = AppServerListThreadsResponse["data"][number];
export type AgentThreadConversationState = AppServerReadThreadResponse["thread"];
export type AgentCreatedThread = AppServerStartThreadResponse["thread"];
export type AgentCreatedThreadModel = AppServerStartThreadResponse["model"];
export type AgentCreatedThreadModelProvider = AppServerStartThreadResponse["modelProvider"];
export type AgentCreatedThreadWorkingDirectory = AppServerStartThreadResponse["cwd"];
export type AgentCreatedThreadApprovalPolicy = AppServerStartThreadResponse["approvalPolicy"];
export type AgentCreatedThreadSandbox = AppServerStartThreadResponse["sandbox"];
export type AgentCreatedThreadReasoningEffort = AppServerStartThreadResponse["reasoningEffort"];

export interface AgentListThreadsResult {
  data: AgentThreadListItem[];
  nextCursor: string | null;
  pages?: number;
  truncated?: boolean;
}

export interface AgentCreateThreadResult {
  threadId: string;
  thread: AgentCreatedThread;
  model?: AgentCreatedThreadModel;
  modelProvider?: AgentCreatedThreadModelProvider;
  cwd?: AgentCreatedThreadWorkingDirectory;
  approvalPolicy?: AgentCreatedThreadApprovalPolicy;
  sandbox?: AgentCreatedThreadSandbox;
  reasoningEffort?: AgentCreatedThreadReasoningEffort;
}

export interface AgentReadThreadResult {
  thread: AgentThreadConversationState;
}

export interface AgentReadThreadInput {
  threadId: string;
  includeTurns: boolean;
}

export interface AgentSendMessageInput {
  threadId: string;
  text: string;
  ownerClientId?: string;
  cwd?: string;
  isSteering?: boolean;
}

export interface AgentSetCollaborationModeInput {
  threadId: string;
  ownerClientId?: string;
  collaborationMode: CollaborationMode;
}

export interface AgentSubmitUserInputInput {
  threadId: string;
  ownerClientId?: string;
  requestId: number;
  response: UserInputResponsePayload;
}

export interface AgentInterruptInput {
  threadId: string;
  ownerClientId?: string;
}

export interface AgentArchiveThreadInput {
  threadId: string;
}

export interface AgentUnarchiveThreadInput {
  threadId: string;
}

export type AgentThreadLiveStateErrorKind = "reductionFailed";

export const AgentThreadLiveStateErrorKindByName: {
  reductionFailed: AgentThreadLiveStateErrorKind;
} = {
  reductionFailed: "reductionFailed"
};

export interface AgentThreadLiveStateError {
  kind: AgentThreadLiveStateErrorKind;
  message: string;
  eventIndex: number | null;
  patchIndex: number | null;
}

export interface AgentThreadLiveState {
  ownerClientId: string | null;
  conversationState: AgentThreadConversationState | null;
  liveStateError: AgentThreadLiveStateError | null;
}

export interface AgentThreadStreamEvents {
  ownerClientId: string | null;
  events: IpcFrame[];
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

export interface AgentReadStreamEventsInput {
  limit: number;
  sinceSequence: number | null;
}

export interface AgentDescriptor {
  id: AgentId;
  label: string;
  enabled: boolean;
  connected: boolean;
  capabilities: AgentCapabilities;
  projectDirectories: string[];
}

export interface AgentConfigDefaults {
  model: string | null;
  reasoningEffort: string | null;
}

export interface AgentSetCollaborationModeResult {
  ownerClientId: string;
}

export interface AgentSubmitUserInputResult {
  ownerClientId: string;
  requestId: number;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly label: string;
  readonly capabilities: AgentCapabilities;

  start(): Promise<void>;
  stop(): Promise<void>;
  isEnabled(): boolean;
  isConnected(): boolean;

  listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult>;
  createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult>;
  readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult>;
  sendMessage(input: AgentSendMessageInput): Promise<void>;
  interrupt(input: AgentInterruptInput): Promise<void>;
  archiveThread?(input: AgentArchiveThreadInput): Promise<void>;
  unarchiveThread?(input: AgentUnarchiveThreadInput): Promise<void>;

  listModels?(limit: number): Promise<AppServerListModelsResponse>;
  listCollaborationModes?(): Promise<AppServerCollaborationModeListResponse>;
  setCollaborationMode?(input: AgentSetCollaborationModeInput): Promise<AgentSetCollaborationModeResult>;
  submitUserInput?(input: AgentSubmitUserInputInput): Promise<AgentSubmitUserInputResult>;
  readLiveState?(threadId: string): Promise<AgentThreadLiveState>;
  readStreamEvents?(threadId: string, input: AgentReadStreamEventsInput): Promise<AgentThreadStreamEvents>;
  listProjectDirectories?(): Promise<string[]>;
  readConfigDefaults?(): Promise<AgentConfigDefaults>;
}
