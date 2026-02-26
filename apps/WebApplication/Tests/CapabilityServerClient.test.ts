import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../Source/Features/Capabilities/DataAccess/CapabilityApi", () => ({
  getConfigDefaults: vi.fn(),
  getHealth: vi.fn(),
  listAgents: vi.fn(),
  listCollaborationModes: vi.fn(),
  listModels: vi.fn()
}));

import {
  getConfigDefaults,
  getHealth,
  listAgents,
  listCollaborationModes,
  listModels
} from "../Source/Features/Capabilities/DataAccess/CapabilityApi";
import {
  CapabilityServerClient,
  type CapabilityAgentsResponse,
  type CapabilityCollaborationModesResponse,
  type CapabilityConfigDefaultsResponse,
  type CapabilityHealthResponse,
  type CapabilityModelsResponse
} from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";

const HEALTH_RESPONSE: CapabilityHealthResponse = {
  ok: true,
  state: {
    appReady: true,
    ipcConnected: true,
    ipcInitialized: true,
    lastError: null,
    historyCount: 0,
    threadOwnerCount: 0
  }
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
        canSetCollaborationMode: true,
        canSubmitUserInput: true,
        canReadLiveState: true,
        canReadStreamEvents: true
      },
      projectDirectories: ["/tmp/project"]
    }
  ],
  defaultAgentId: "codex"
};

const COLLABORATION_MODES_RESPONSE: CapabilityCollaborationModesResponse = {
  data: [
    {
      name: "Balanced",
      mode: "default",
      model: "gpt-5",
      reasoning_effort: "medium"
    }
  ]
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
          description: "Balanced reasoning"
        }
      ],
      inputModalities: ["text", "image"],
      supportsPersonality: false
    }
  ],
  nextCursor: null
};

const CONFIG_DEFAULTS_RESPONSE: CapabilityConfigDefaultsResponse = {
  ok: true,
  agentId: "codex",
  model: "gpt-5",
  reasoningEffort: "medium"
};

describe("CapabilityServerClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getHealth).mockResolvedValue(HEALTH_RESPONSE);
    vi.mocked(listAgents).mockResolvedValue(AGENTS_RESPONSE);
    vi.mocked(listCollaborationModes).mockResolvedValue(COLLABORATION_MODES_RESPONSE);
    vi.mocked(listModels).mockResolvedValue(MODELS_RESPONSE);
    vi.mocked(getConfigDefaults).mockResolvedValue(CONFIG_DEFAULTS_RESPONSE);
  });

  it("delegates reads to CapabilityApi with typed contracts", async () => {
    const capabilityServerClient = new CapabilityServerClient();
    const healthOptions = {
      actionId: "action-health",
      actionName: "read-health"
    };
    const agentOptions = {
      actionId: "action-agents",
      actionName: "list-agents"
    };
    const collaborationModeOptions = {
      actionId: "action-collaboration-modes",
      actionName: "list-collaboration-modes"
    };
    const modelOptions = {
      actionId: "action-models",
      actionName: "list-models"
    };
    const configDefaultsOptions = {
      agentId: "codex" as const,
      actionId: "action-config-defaults",
      actionName: "read-config-defaults"
    };

    const healthResponse = await capabilityServerClient.readHealthStatus(healthOptions);
    const agentsResponse = await capabilityServerClient.listAgents(agentOptions);
    const collaborationModesResponse = await capabilityServerClient.listCollaborationModes(
      collaborationModeOptions
    );
    const modelsResponse = await capabilityServerClient.listModels(modelOptions);
    const configDefaultsResponse = await capabilityServerClient.readConfigDefaults(configDefaultsOptions);

    expect(getHealth).toHaveBeenCalledWith(healthOptions);
    expect(listAgents).toHaveBeenCalledWith(agentOptions);
    expect(listCollaborationModes).toHaveBeenCalledWith(collaborationModeOptions);
    expect(listModels).toHaveBeenCalledWith(modelOptions);
    expect(getConfigDefaults).toHaveBeenCalledWith(configDefaultsOptions);
    expect(healthResponse).toEqual(HEALTH_RESPONSE);
    expect(agentsResponse).toEqual(AGENTS_RESPONSE);
    expect(collaborationModesResponse).toEqual(COLLABORATION_MODES_RESPONSE);
    expect(modelsResponse).toEqual(MODELS_RESPONSE);
    expect(configDefaultsResponse).toEqual(CONFIG_DEFAULTS_RESPONSE);
  });
});
