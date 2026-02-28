import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../Source/Features/Capabilities/DataAccess/CapabilityApi", () => ({
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
}));

import {
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
} from "../Source/Features/Capabilities/DataAccess/CapabilityApi";
import {
  type CapabilityAgentsResponse,
  type CapabilityAppsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityConfigRequirementsResponse,
  type CapabilityExperimentalFeaturesResponse,
  type CapabilityHealthResponse,
  type CapabilityMcpServersResponse,
  type CapabilityModelsResponse,
  CapabilityServerClient,
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
    expect(experimentalFeaturesResponse).toEqual(EXPERIMENTAL_FEATURES_RESPONSE);
    expect(mcpServersResponse).toEqual(MCP_SERVERS_RESPONSE);
    expect(appsResponse).toEqual(APPS_RESPONSE);
    expect(skillsResponse).toEqual(SKILLS_RESPONSE);
  });
});
