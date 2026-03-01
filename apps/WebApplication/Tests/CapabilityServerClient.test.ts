import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../Source/Features/Capabilities/DataAccess/CapabilityApi", () => ({
  cancelAccountLogin: vi.fn(),
  getAccount: vi.fn(),
  getAccountRateLimits: vi.fn(),
  getConfigRequirements: vi.fn(),
  getConfigDefaults: vi.fn(),
  getHealth: vi.fn(),
  listApps: vi.fn(),
  listAgents: vi.fn(),
  listCollaborationModes: vi.fn(),
  listExperimentalFeatures: vi.fn(),
  listMcpServers: vi.fn(),
  listModels: vi.fn(),
  listSkills: vi.fn(),
  logoutAccount: vi.fn(),
  reloadMcpServerConfig: vi.fn(),
  startAccountLogin: vi.fn(),
}));

vi.mock("../Source/Features/Capabilities/DataAccess/CapabilityCoverageMutationApi", () => ({
  executeCommand: vi.fn(),
  exportRemoteSkill: vi.fn(),
  listRemoteSkills: vi.fn(),
  startMcpServerOauthLogin: vi.fn(),
  writeSkillsConfig: vi.fn(),
}));

import {
  cancelAccountLogin,
  getAccount,
  getAccountRateLimits,
  getConfigDefaults,
  getConfigRequirements,
  getHealth,
  listAgents,
  listApps,
  listCollaborationModes,
  listExperimentalFeatures,
  listMcpServers,
  listModels,
  listSkills,
  logoutAccount,
  reloadMcpServerConfig,
  startAccountLogin,
} from "../Source/Features/Capabilities/DataAccess/CapabilityApi";
import {
  executeCommand,
  exportRemoteSkill,
  listRemoteSkills,
  startMcpServerOauthLogin,
  writeSkillsConfig,
} from "../Source/Features/Capabilities/DataAccess/CapabilityCoverageMutationApi";
import {
  type CapabilityAccountLoginCancelResponse,
  type CapabilityAccountLoginStartResponse,
  type CapabilityAccountRateLimitsResponse,
  type CapabilityAccountResponse,
  type CapabilityAgentsResponse,
  type CapabilityAppsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityCommandExecutionResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityConfigRequirementsResponse,
  type CapabilityExperimentalFeaturesResponse,
  type CapabilityHealthResponse,
  type CapabilityMcpServerOauthLoginResponse,
  type CapabilityMcpServersResponse,
  type CapabilityModelsResponse,
  type CapabilityMutationSuccessResponse,
  type CapabilityRemoteSkillExportResponse,
  type CapabilityRemoteSkillsListResponse,
  CapabilityServerClient,
  type CapabilitySkillsConfigWriteResponse,
  type CapabilitySkillsResponse,
} from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";

const HEALTH_RESPONSE: CapabilityHealthResponse = {
  ok: true,
  state: {
    appReady: true,
    ipcConnected: true,
    ipcInitialized: true,
    lastError: null,
    historyCount: 0,
    threadOwnerCount: 0,
  },
};

const AGENTS_RESPONSE: CapabilityAgentsResponse = {
  ok: true,
  agents: [
    {
      id: "codex",
      label: "Codex",
      enabled: true,
      connected: true,
      capabilities: {
        canListModels: true,
        canListCollaborationModes: true,
        canReadConfigRequirements: true,
        canListExperimentalFeatures: true,
        canListMcpServerStatuses: true,
        canListApps: true,
        canListSkills: true,
        canReadAccount: true,
        canReadAccountRateLimits: true,
        canExecuteCommand: true,
        canStartAccountLogin: true,
        canCancelAccountLogin: true,
        canLogoutAccount: true,
        canReloadMcpServerConfig: true,
        canStartMcpServerOauthLogin: true,
        canWriteSkillsConfig: true,
        canSetCollaborationMode: true,
        canSubmitUserInput: true,
        canReadLiveState: true,
        canReadStreamEvents: true,
      },
      projectDirectories: ["/tmp/project"],
    },
  ],
  defaultAgentId: "codex",
};

const COLLABORATION_MODES_RESPONSE: CapabilityCollaborationModesResponse = {
  data: [
    {
      name: "Balanced",
      mode: "default",
      model: "gpt-5",
      reasoning_effort: "medium",
    },
  ],
};

const MODELS_RESPONSE: CapabilityModelsResponse = {
  data: [
    {
      id: "gpt-5",
      model: "gpt-5",
      displayName: "GPT-5",
      description: "General model",
      hidden: false,
      isDefault: true,
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: [
        {
          reasoningEffort: "medium",
          description: "Balanced reasoning",
        },
      ],
      inputModalities: ["text", "image"],
      supportsPersonality: false,
    },
  ],
  nextCursor: null,
};

const CONFIG_DEFAULTS_RESPONSE: CapabilityConfigDefaultsResponse = {
  ok: true,
  agentId: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
};

const CONFIG_REQUIREMENTS_RESPONSE: CapabilityConfigRequirementsResponse = {
  ok: true,
  requirements: {
    allowedApprovalPolicies: ["on-request"],
    allowedSandboxModes: null,
    allowedWebSearchModes: null,
    enforceResidency: "us",
    network: null,
  },
};

const ACCOUNT_RESPONSE: CapabilityAccountResponse = {
  ok: true,
  account: {
    type: "chatgpt",
    email: "dev@example.com",
    planType: "pro",
  },
  requiresOpenaiAuth: false,
};

const ACCOUNT_RATE_LIMITS_RESPONSE: CapabilityAccountRateLimitsResponse = {
  ok: true,
  rateLimits: {
    credits: null,
    limitId: "codex",
    limitName: "Codex",
    planType: "pro",
    primary: {
      resetsAt: 1_700_000_000,
      usedPercent: 42,
      windowDurationMins: 60,
    },
    secondary: null,
  },
  rateLimitsByLimitId: null,
};

const ACCOUNT_LOGIN_START_RESPONSE: CapabilityAccountLoginStartResponse = {
  ok: true,
  type: "chatgpt",
  loginId: "login-1",
  authUrl: "https://example.com/oauth/start",
};

const ACCOUNT_LOGIN_CANCEL_RESPONSE: CapabilityAccountLoginCancelResponse = {
  ok: true,
  status: "canceled",
};

const MUTATION_SUCCESS_RESPONSE: CapabilityMutationSuccessResponse = {
  ok: true,
};

const MCP_SERVER_OAUTH_LOGIN_RESPONSE: CapabilityMcpServerOauthLoginResponse = {
  ok: true,
  authorizationUrl: "https://example.com/oauth/mcp/github",
};

const COMMAND_EXECUTION_RESPONSE: CapabilityCommandExecutionResponse = {
  ok: true,
  exitCode: 0,
  stdout: "/tmp/project\n",
  stderr: "",
};

const SKILLS_CONFIG_WRITE_RESPONSE: CapabilitySkillsConfigWriteResponse = {
  ok: true,
  effectiveEnabled: false,
};

const REMOTE_SKILLS_LIST_RESPONSE: CapabilityRemoteSkillsListResponse = {
  ok: true,
  data: [
    {
      id: "remote-skill-1",
      name: "Repository checks",
      description: "Run repository checks before review",
    },
  ],
};

const REMOTE_SKILL_EXPORT_RESPONSE: CapabilityRemoteSkillExportResponse = {
  ok: true,
  id: "remote-skill-1",
  path: "/tmp/project/.codex/skills/repository-checks/SKILL.md",
};

const EXPERIMENTAL_FEATURES_RESPONSE: CapabilityExperimentalFeaturesResponse = {
  ok: true,
  data: [
    {
      name: "advanced-diff-view",
      stage: "beta",
      displayName: "Advanced Diff View",
      description: "Detailed diff review controls",
      announcement: null,
      enabled: true,
      defaultEnabled: false,
    },
  ],
  nextCursor: null,
};

const MCP_SERVERS_RESPONSE: CapabilityMcpServersResponse = {
  ok: true,
  data: [
    {
      name: "github",
      authStatus: "authenticated",
      toolCount: 4,
      resourceCount: 2,
      resourceTemplateCount: 1,
    },
  ],
  nextCursor: null,
};

const APPS_RESPONSE: CapabilityAppsResponse = {
  ok: true,
  data: [
    {
      id: "app-github",
      name: "GitHub",
      description: "GitHub connector",
      logoUrl: null,
      logoUrlDark: null,
      installUrl: null,
      isAccessible: true,
      isEnabled: true,
    },
  ],
  nextCursor: null,
};

const SKILLS_RESPONSE: CapabilitySkillsResponse = {
  ok: true,
  data: [
    {
      cwd: "/tmp/project",
      skills: [
        {
          name: "checks",
          description: "Run repository checks",
          shortDescription: "Checks",
          path: "/tmp/project/.codex/skills/checks/SKILL.md",
          scope: "repo",
          enabled: true,
        },
      ],
      errors: [],
    },
  ],
};

describe("CapabilityServerClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getHealth).mockResolvedValue(HEALTH_RESPONSE);
    vi.mocked(listAgents).mockResolvedValue(AGENTS_RESPONSE);
    vi.mocked(listCollaborationModes).mockResolvedValue(COLLABORATION_MODES_RESPONSE);
    vi.mocked(listModels).mockResolvedValue(MODELS_RESPONSE);
    vi.mocked(getConfigDefaults).mockResolvedValue(CONFIG_DEFAULTS_RESPONSE);
    vi.mocked(getConfigRequirements).mockResolvedValue(CONFIG_REQUIREMENTS_RESPONSE);
    vi.mocked(getAccount).mockResolvedValue(ACCOUNT_RESPONSE);
    vi.mocked(getAccountRateLimits).mockResolvedValue(ACCOUNT_RATE_LIMITS_RESPONSE);
    vi.mocked(startAccountLogin).mockResolvedValue(ACCOUNT_LOGIN_START_RESPONSE);
    vi.mocked(cancelAccountLogin).mockResolvedValue(ACCOUNT_LOGIN_CANCEL_RESPONSE);
    vi.mocked(logoutAccount).mockResolvedValue(MUTATION_SUCCESS_RESPONSE);
    vi.mocked(reloadMcpServerConfig).mockResolvedValue(MUTATION_SUCCESS_RESPONSE);
    vi.mocked(startMcpServerOauthLogin).mockResolvedValue(MCP_SERVER_OAUTH_LOGIN_RESPONSE);
    vi.mocked(executeCommand).mockResolvedValue(COMMAND_EXECUTION_RESPONSE);
    vi.mocked(writeSkillsConfig).mockResolvedValue(SKILLS_CONFIG_WRITE_RESPONSE);
    vi.mocked(listRemoteSkills).mockResolvedValue(REMOTE_SKILLS_LIST_RESPONSE);
    vi.mocked(exportRemoteSkill).mockResolvedValue(REMOTE_SKILL_EXPORT_RESPONSE);
    vi.mocked(listExperimentalFeatures).mockResolvedValue(EXPERIMENTAL_FEATURES_RESPONSE);
    vi.mocked(listMcpServers).mockResolvedValue(MCP_SERVERS_RESPONSE);
    vi.mocked(listApps).mockResolvedValue(APPS_RESPONSE);
    vi.mocked(listSkills).mockResolvedValue(SKILLS_RESPONSE);
  });

  it("delegates reads to CapabilityApi with typed contracts", async () => {
    const capabilityServerClient = new CapabilityServerClient();
    const healthOptions = {
      actionId: "action-health",
      actionName: "read-health",
    };
    const agentOptions = {
      actionId: "action-agents",
      actionName: "list-agents",
    };
    const collaborationModeOptions = {
      actionId: "action-collaboration-modes",
      actionName: "list-collaboration-modes",
    };
    const modelOptions = {
      actionId: "action-models",
      actionName: "list-models",
    };
    const configDefaultsOptions = {
      agentId: "codex" as const,
      actionId: "action-config-defaults",
      actionName: "read-config-defaults",
    };
    const configRequirementsOptions = {
      actionId: "action-config-requirements",
      actionName: "read-config-requirements",
    };
    const accountOptions = {
      actionId: "action-account",
      actionName: "read-account",
      refreshToken: true,
    };
    const accountRateLimitsOptions = {
      actionId: "action-account-rate-limits",
      actionName: "read-account-rate-limits",
    };
    const accountLoginStartOptions = {
      actionId: "action-account-login-start",
      actionName: "start-account-login",
    };
    const accountLoginCancelOptions = {
      actionId: "action-account-login-cancel",
      actionName: "cancel-account-login",
      loginId: "login-1",
    };
    const accountLogoutOptions = {
      actionId: "action-account-logout",
      actionName: "logout-account",
    };
    const reloadMcpServerConfigOptions = {
      actionId: "action-reload-mcp-server-config",
      actionName: "reload-mcp-server-config",
    };
    const mcpServerOauthLoginOptions = {
      actionId: "action-mcp-oauth-login",
      actionName: "start-mcp-oauth-login",
      name: "github",
      scopes: ["read:org", "repo"],
      timeoutSeconds: 180,
    };
    const commandExecutionOptions = {
      actionId: "action-command-execution",
      actionName: "execute-command",
      command: ["pwd"],
      timeoutMs: 1200,
      cwd: "/tmp/project",
    };
    const skillsConfigWriteOptions = {
      actionId: "action-skills-config-write",
      actionName: "write-skills-config",
      path: "/tmp/project/.codex/skills/checks/SKILL.md",
      enabled: false,
    };
    const listRemoteSkillsOptions = {
      actionId: "action-remote-skills-list",
      actionName: "list-remote-skills",
      hazelnutScope: "personal" as const,
      productSurface: "codex" as const,
      enabled: true,
    };
    const exportRemoteSkillOptions = {
      actionId: "action-remote-skill-export",
      actionName: "export-remote-skill",
      hazelnutId: "remote-skill-1",
    };
    const experimentalFeatureOptions = {
      actionId: "action-experimental-features",
      actionName: "list-experimental-features",
      limit: 20,
    };
    const mcpServerOptions = {
      actionId: "action-mcp-servers",
      actionName: "list-mcp-servers",
    };
    const appOptions = {
      actionId: "action-apps",
      actionName: "list-apps",
      forceRefetch: true,
      threadId: "thread-1",
    };
    const skillOptions = {
      actionId: "action-skills",
      actionName: "list-skills",
      forceReload: true,
    };

    const healthResponse = await capabilityServerClient.readHealthStatus(healthOptions);
    const agentsResponse = await capabilityServerClient.listAgents(agentOptions);
    const collaborationModesResponse =
      await capabilityServerClient.listCollaborationModes(collaborationModeOptions);
    const modelsResponse = await capabilityServerClient.listModels(modelOptions);
    const configDefaultsResponse =
      await capabilityServerClient.readConfigDefaults(configDefaultsOptions);
    const configRequirementsResponse =
      await capabilityServerClient.readConfigRequirements(configRequirementsOptions);
    const accountResponse = await capabilityServerClient.readAccount(accountOptions);
    const accountRateLimitsResponse =
      await capabilityServerClient.readAccountRateLimits(accountRateLimitsOptions);
    const accountLoginStartResponse =
      await capabilityServerClient.startAccountLogin(accountLoginStartOptions);
    const accountLoginCancelResponse =
      await capabilityServerClient.cancelAccountLogin(accountLoginCancelOptions);
    const accountLogoutResponse = await capabilityServerClient.logoutAccount(accountLogoutOptions);
    const reloadMcpServerConfigResponse = await capabilityServerClient.reloadMcpServerConfig(
      reloadMcpServerConfigOptions,
    );
    const mcpServerOauthLoginResponse = await capabilityServerClient.startMcpServerOauthLogin(
      mcpServerOauthLoginOptions,
    );
    const commandExecutionResponse =
      await capabilityServerClient.executeCommand(commandExecutionOptions);
    const skillsConfigWriteResponse =
      await capabilityServerClient.writeSkillsConfig(skillsConfigWriteOptions);
    const remoteSkillsListResponse =
      await capabilityServerClient.listRemoteSkills(listRemoteSkillsOptions);
    const remoteSkillExportResponse =
      await capabilityServerClient.exportRemoteSkill(exportRemoteSkillOptions);
    const experimentalFeaturesResponse = await capabilityServerClient.listExperimentalFeatures(
      experimentalFeatureOptions,
    );
    const mcpServersResponse = await capabilityServerClient.listMcpServers(mcpServerOptions);
    const appsResponse = await capabilityServerClient.listApps(appOptions);
    const skillsResponse = await capabilityServerClient.listSkills(skillOptions);

    expect(getHealth).toHaveBeenCalledWith(healthOptions);
    expect(listAgents).toHaveBeenCalledWith(agentOptions);
    expect(listCollaborationModes).toHaveBeenCalledWith(collaborationModeOptions);
    expect(listModels).toHaveBeenCalledWith(modelOptions);
    expect(getConfigDefaults).toHaveBeenCalledWith(configDefaultsOptions);
    expect(getConfigRequirements).toHaveBeenCalledWith(configRequirementsOptions);
    expect(getAccount).toHaveBeenCalledWith(accountOptions);
    expect(getAccountRateLimits).toHaveBeenCalledWith(accountRateLimitsOptions);
    expect(startAccountLogin).toHaveBeenCalledWith(accountLoginStartOptions);
    expect(cancelAccountLogin).toHaveBeenCalledWith(accountLoginCancelOptions);
    expect(logoutAccount).toHaveBeenCalledWith(accountLogoutOptions);
    expect(reloadMcpServerConfig).toHaveBeenCalledWith(reloadMcpServerConfigOptions);
    expect(startMcpServerOauthLogin).toHaveBeenCalledWith(mcpServerOauthLoginOptions);
    expect(executeCommand).toHaveBeenCalledWith(commandExecutionOptions);
    expect(writeSkillsConfig).toHaveBeenCalledWith(skillsConfigWriteOptions);
    expect(listRemoteSkills).toHaveBeenCalledWith(listRemoteSkillsOptions);
    expect(exportRemoteSkill).toHaveBeenCalledWith(exportRemoteSkillOptions);
    expect(listExperimentalFeatures).toHaveBeenCalledWith(experimentalFeatureOptions);
    expect(listMcpServers).toHaveBeenCalledWith(mcpServerOptions);
    expect(listApps).toHaveBeenCalledWith(appOptions);
    expect(listSkills).toHaveBeenCalledWith(skillOptions);
    expect(healthResponse).toEqual(HEALTH_RESPONSE);
    expect(agentsResponse).toEqual(AGENTS_RESPONSE);
    expect(collaborationModesResponse).toEqual(COLLABORATION_MODES_RESPONSE);
    expect(modelsResponse).toEqual(MODELS_RESPONSE);
    expect(configDefaultsResponse).toEqual(CONFIG_DEFAULTS_RESPONSE);
    expect(configRequirementsResponse).toEqual(CONFIG_REQUIREMENTS_RESPONSE);
    expect(accountResponse).toEqual(ACCOUNT_RESPONSE);
    expect(accountRateLimitsResponse).toEqual(ACCOUNT_RATE_LIMITS_RESPONSE);
    expect(accountLoginStartResponse).toEqual(ACCOUNT_LOGIN_START_RESPONSE);
    expect(accountLoginCancelResponse).toEqual(ACCOUNT_LOGIN_CANCEL_RESPONSE);
    expect(accountLogoutResponse).toEqual(MUTATION_SUCCESS_RESPONSE);
    expect(reloadMcpServerConfigResponse).toEqual(MUTATION_SUCCESS_RESPONSE);
    expect(mcpServerOauthLoginResponse).toEqual(MCP_SERVER_OAUTH_LOGIN_RESPONSE);
    expect(commandExecutionResponse).toEqual(COMMAND_EXECUTION_RESPONSE);
    expect(skillsConfigWriteResponse).toEqual(SKILLS_CONFIG_WRITE_RESPONSE);
    expect(remoteSkillsListResponse).toEqual(REMOTE_SKILLS_LIST_RESPONSE);
    expect(remoteSkillExportResponse).toEqual(REMOTE_SKILL_EXPORT_RESPONSE);
    expect(experimentalFeaturesResponse).toEqual(EXPERIMENTAL_FEATURES_RESPONSE);
    expect(mcpServersResponse).toEqual(MCP_SERVERS_RESPONSE);
    expect(appsResponse).toEqual(APPS_RESPONSE);
    expect(skillsResponse).toEqual(SKILLS_RESPONSE);
  });
});
