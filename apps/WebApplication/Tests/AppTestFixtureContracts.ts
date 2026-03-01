import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

/**
 * App shell integration-test fixture contracts.
 * These mirror API response payloads consumed by the web-shell owners.
 */
type AgentIdentifier = "codex" | "opencode";

export interface CapabilityFixture {
  canListModels: boolean;
  canListCollaborationModes: boolean;
  canReadConfigRequirements: boolean;
  canListExperimentalFeatures: boolean;
  canListMcpServerStatuses: boolean;
  canListApps: boolean;
  canListSkills: boolean;
  canReadAccount: boolean;
  canReadAccountRateLimits: boolean;
  canSearchFuzzyFiles: boolean;
  canExecuteCommand: boolean;
  canStartAccountLogin: boolean;
  canCancelAccountLogin: boolean;
  canLogoutAccount: boolean;
  canReloadMcpServerConfig: boolean;
  canStartMcpServerOauthLogin: boolean;
  canWriteConfigValue: boolean;
  canWriteSkillsConfig: boolean;
  canDetectExternalAgentConfig: boolean;
  canImportExternalAgentConfig: boolean;
  canSetCollaborationMode: boolean;
  canSubmitUserInput: boolean;
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
  canReadNotificationEvents: boolean;
}

export interface AgentFixture {
  id: AgentIdentifier;
  label: string;
  enabled: boolean;
  connected: boolean;
  capabilities: CapabilityFixture;
  projectDirectories: string[];
}

export interface AgentsFixture {
  ok: true;
  agents: AgentFixture[];
  defaultAgentId: AgentIdentifier;
}

export interface ThreadListItemFixture {
  id: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  cwd?: string;
  source: "opencode";
  agentId: AgentIdentifier;
}

export interface ThreadListFixture {
  ok: true;
  data: ThreadListItemFixture[];
  nextCursor: null;
  pages: number;
  truncated: boolean;
}

export interface CollaborationModeFixture {
  name: string;
  mode: string;
  model: string | null;
  reasoning_effort: string;
  developer_instructions: string | null;
}

export interface CollaborationModesFixture {
  ok: true;
  data: CollaborationModeFixture[];
}

export interface ModelReasoningEffortFixture {
  reasoningEffort: string;
  description: string;
}

export interface ModelFixture {
  id: string;
  model: string;
  upgrade: null;
  displayName: string;
  description: string;
  supportedReasoningEfforts: ModelReasoningEffortFixture[];
  defaultReasoningEffort: string;
  inputModalities: string[];
  supportsPersonality: boolean;
  isDefault: boolean;
  hidden: boolean;
}

export interface ModelsFixture {
  ok: true;
  data: ModelFixture[];
  nextCursor: null;
}

export interface DebugErrorFixture {
  errorId: string;
  sessionId: string;
  origin: "client" | "server";
  source: string;
  operation: string;
  message: string;
  severity: "error" | "warning";
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  url: string | null;
  occurredAt: string;
  recordedAt: string;
  details: Record<string, string | number | boolean | null>;
}

export interface DebugErrorsFixture {
  ok: true;
  data: DebugErrorFixture[];
  sessionId: string;
  sessionLogPath: string;
}

export interface ConfigDefaultsFixture {
  ok: true;
  agentId: AgentIdentifier | null;
  model: string | null;
  reasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | null;
}

export interface ConversationStateFixture {
  id: string;
  turns: Array<{
    id: string;
    status: string;
    items: [];
  }>;
  requests: [];
  updatedAt: number;
  latestModel: string;
  latestReasoningEffort: string;
  latestCollaborationMode: {
    mode: string;
    settings: {
      model: string;
      reasoning_effort: string;
      developer_instructions: null;
    };
  };
}

type ThreadConversationStructuredValue = {
  [key: string]: StructuredDataValue;
};

type ThreadConversationPayload = ConversationStateFixture | ThreadConversationStructuredValue;

export interface ReadThreadFixture {
  ok: true;
  thread: ThreadConversationPayload;
  agentId: AgentIdentifier;
}

export interface LiveStateFixture {
  ok: true;
  threadId: string;
  ownerClientId: string | null;
  conversationState: ThreadConversationPayload | null;
  liveStateError: null;
}

export type ReadThreadResolver = (
  threadId: string,
  includeTurns: boolean,
) => ReadThreadFixture | Promise<ReadThreadFixture | null> | null;
export type LiveStateResolver = (threadId: string) => LiveStateFixture;

export interface EventsSessionFixture {
  authRequired: boolean;
  bootstrapped: boolean;
  expiresAt: string | null;
  acceptedApiToken: string;
}

export interface AppTestEnvironment {
  renderApp: () => void;
  setPathname: (pathname: string) => void;
  setAgentsFixture: (fixture: AgentsFixture) => void;
  setThreadsFixture: (fixture: ThreadListFixture) => void;
  setCollaborationModesFixture: (fixture: CollaborationModesFixture) => void;
  setModelsFixture: (fixture: ModelsFixture) => void;
  setDebugErrorsFixture: (fixture: DebugErrorsFixture) => void;
  setConfigDefaultsFixture: (fixture: ConfigDefaultsFixture) => void;
  setReadThreadResolver: (resolver: ReadThreadResolver) => void;
  setLiveStateResolver: (resolver: LiveStateResolver) => void;
  setReadThreadDelayMilliseconds: (milliseconds: number) => void;
  setEventsSessionFixture: (fixture: EventsSessionFixture) => void;
  emitHistoryEventForThread: (threadId: string) => void;
  buildConversationStateFixture: (threadId: string, modelId: string) => ConversationStateFixture;
}

export const CODEX_CAPABILITIES: CapabilityFixture = {
  canListModels: true,
  canListCollaborationModes: true,
  canReadConfigRequirements: true,
  canListExperimentalFeatures: true,
  canListMcpServerStatuses: true,
  canListApps: true,
  canListSkills: true,
  canReadAccount: true,
  canReadAccountRateLimits: true,
  canSearchFuzzyFiles: true,
  canExecuteCommand: true,
  canStartAccountLogin: true,
  canCancelAccountLogin: true,
  canLogoutAccount: true,
  canReloadMcpServerConfig: true,
  canStartMcpServerOauthLogin: true,
  canWriteConfigValue: true,
  canWriteSkillsConfig: true,
  canDetectExternalAgentConfig: true,
  canImportExternalAgentConfig: true,
  canSetCollaborationMode: true,
  canSubmitUserInput: true,
  canReadLiveState: true,
  canReadStreamEvents: true,

  canReadNotificationEvents: true,
};

export const OPENCODE_CAPABILITIES: CapabilityFixture = {
  canListModels: false,
  canListCollaborationModes: false,
  canReadConfigRequirements: false,
  canListExperimentalFeatures: false,
  canListMcpServerStatuses: false,
  canListApps: false,
  canListSkills: false,
  canReadAccount: false,
  canReadAccountRateLimits: false,
  canSearchFuzzyFiles: false,
  canExecuteCommand: false,
  canStartAccountLogin: false,
  canCancelAccountLogin: false,
  canLogoutAccount: false,
  canReloadMcpServerConfig: false,
  canStartMcpServerOauthLogin: false,
  canWriteConfigValue: false,
  canWriteSkillsConfig: false,
  canDetectExternalAgentConfig: false,
  canImportExternalAgentConfig: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false,

  canReadNotificationEvents: false,
};

export function buildConversationStateFixture(
  threadId: string,
  modelId: string,
): ConversationStateFixture {
  return {
    id: threadId,
    turns: [
      {
        id: "turn-1",
        status: "completed",
        items: [],
      },
    ],
    requests: [],
    updatedAt: 1700000000,
    latestModel: modelId,
    latestReasoningEffort: "medium",
    latestCollaborationMode: {
      mode: "default",
      settings: {
        model: modelId,
        reasoning_effort: "medium",
        developer_instructions: null,
      },
    },
  };
}
