import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentDescriptor,
  AgentId,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput
} from "../Source/Agents/Types.js";
import { handleAgentRoutes } from "../Source/Network/Routes/AgentRoutes.js";
import { logger } from "../Source/Shared/Logging/Logger.js";

const AgentIdentifierSchema = z.union([z.literal("codex"), z.literal("opencode")]);

const AgentCapabilitiesSchema = z
  .object({
    canListModels: z.boolean(),
    canListCollaborationModes: z.boolean(),
    canSetCollaborationMode: z.boolean(),
    canSubmitUserInput: z.boolean(),
    canReadLiveState: z.boolean(),
    canReadStreamEvents: z.boolean()
  })
  .strict();

const AgentDescriptorSchema = z
  .object({
    id: AgentIdentifierSchema,
    label: z.string(),
    enabled: z.boolean(),
    connected: z.boolean(),
    capabilities: AgentCapabilitiesSchema,
    projectDirectories: z.array(z.string())
  })
  .strict();

const AgentListResponseSchema = z
  .object({
    ok: z.literal(true),
    agents: z.array(AgentDescriptorSchema),
    defaultAgentId: AgentIdentifierSchema
  })
  .strict();

const AgentRouteWarningContextSchema = z
  .object({
    agentId: AgentIdentifierSchema,
    error: z.string().max(300)
  })
  .strict();

interface AgentRouteExecutionResult {
  handled: boolean;
  statusCode: number | null;
  body: object | null;
}

interface ExecuteAgentRouteInput {
  method?: "GET" | "POST";
  pathname: string;
  adapters?: AgentAdapter[];
  configuredAgentIds?: AgentId[];
}

interface MockAgentAdapterOptions {
  id: AgentId;
  enabled?: boolean;
  connected?: boolean;
  capabilities?: Partial<AgentCapabilities>;
  listProjectDirectories?: () => Promise<string[]>;
}

function createMockRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response
  };
}

function createDefaultCapabilities(overrides?: Partial<AgentCapabilities>): AgentCapabilities {
  return {
    canListModels: false,
    canListCollaborationModes: false,
    canSetCollaborationMode: false,
    canSubmitUserInput: false,
    canReadLiveState: false,
    canReadStreamEvents: false,
    ...overrides
  };
}

function createMockAgentAdapter(options: MockAgentAdapterOptions): AgentAdapter {
  const adapter: AgentAdapter = {
    id: options.id,
    label: options.id === "codex" ? "Codex" : "OpenCode",
    capabilities: createDefaultCapabilities(options.capabilities),
    async start(): Promise<void> {},
    async stop(): Promise<void> {},
    isEnabled(): boolean {
      return options.enabled ?? true;
    },
    isConnected(): boolean {
      return options.connected ?? true;
    },
    async listThreads(_input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
      return {
        data: [],
        nextCursor: null
      };
    },
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("Not used in AgentRoutes tests");
    },
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("Not used in AgentRoutes tests");
    },
    async sendMessage(_input: AgentSendMessageInput): Promise<void> {
      throw new Error("Not used in AgentRoutes tests");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("Not used in AgentRoutes tests");
    }
  };

  if (options.listProjectDirectories) {
    adapter.listProjectDirectories = options.listProjectDirectories;
  }

  return adapter;
}

function buildAgentDescriptor(adapter: AgentAdapter, projectDirectories: string[]): AgentDescriptor {
  return {
    id: adapter.id,
    label: adapter.label,
    enabled: adapter.isEnabled(),
    connected: adapter.isConnected(),
    capabilities: adapter.capabilities,
    projectDirectories
  };
}

function readRouteBody(result: AgentRouteExecutionResult): object {
  if (!result.body) {
    throw new Error("Expected AgentRoutes handler to return a JSON body");
  }
  return result.body;
}

async function executeAgentRoute(input: ExecuteAgentRouteInput): Promise<AgentRouteExecutionResult> {
  const { request, response } = createMockRequestResponsePair();
  request.method = input.method ?? "GET";

  let statusCode: number | null = null;
  let body: object | null = null;

  const handled = await handleAgentRoutes({
    req: request,
    res: response,
    pathname: input.pathname,
    registry: new AgentRegistry(input.adapters ?? []),
    configuredAgentIds: input.configuredAgentIds ?? ["codex"],
    buildAgentDescriptor,
    jsonResponse: (_response, nextStatusCode, nextBody) => {
      statusCode = nextStatusCode;
      body = nextBody;
    }
  });

  return {
    handled,
    statusCode,
    body
  };
}

describe("handleAgentRoutes", () => {
  it("returns false when list-agents route method does not match", async () => {
    const result = await executeAgentRoute({
      method: "POST",
      pathname: "/api/agents"
    });

    expect(result.handled).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.body).toBeNull();
  });

  it("returns a strict success response shape for the list-agents route", async () => {
    const codexAdapter = createMockAgentAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      capabilities: {
        canListModels: true
      },
      listProjectDirectories: async () => ["/workspace/codex", "/workspace/shared"]
    });
    const opencodeAdapter = createMockAgentAdapter({
      id: "opencode",
      enabled: false,
      connected: false
    });

    const result = await executeAgentRoute({
      pathname: "/api/agents",
      adapters: [codexAdapter, opencodeAdapter],
      configuredAgentIds: ["opencode"]
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedResponse = AgentListResponseSchema.parse(readRouteBody(result));
    expect(parsedResponse).toEqual({
      ok: true,
      agents: [
        {
          id: "codex",
          label: "Codex",
          enabled: true,
          connected: true,
          capabilities: {
            canListModels: true,
            canListCollaborationModes: false,
            canSetCollaborationMode: false,
            canSubmitUserInput: false,
            canReadLiveState: false,
            canReadStreamEvents: false
          },
          projectDirectories: ["/workspace/codex", "/workspace/shared"]
        },
        {
          id: "opencode",
          label: "OpenCode",
          enabled: false,
          connected: false,
          capabilities: {
            canListModels: false,
            canListCollaborationModes: false,
            canSetCollaborationMode: false,
            canSubmitUserInput: false,
            canReadLiveState: false,
            canReadStreamEvents: false
          },
          projectDirectories: []
        }
      ],
      defaultAgentId: "codex"
    });
  });

  it("keeps response deterministic and logs a warning when listProjectDirectories fails", async () => {
    const longErrorMessage = "project-directory-read-failed ".repeat(60);
    const codexAdapter = createMockAgentAdapter({
      id: "codex",
      enabled: true,
      connected: true,
      listProjectDirectories: async () => {
        throw new Error(longErrorMessage);
      }
    });

    const warningSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    try {
      const result = await executeAgentRoute({
        pathname: "/api/agents",
        adapters: [codexAdapter],
        configuredAgentIds: ["codex"]
      });

      expect(result.handled).toBe(true);
      expect(result.statusCode).toBe(200);
      const parsedResponse = AgentListResponseSchema.parse(readRouteBody(result));
      expect(parsedResponse.agents[0]?.projectDirectories).toEqual([]);

      expect(warningSpy).toHaveBeenCalledTimes(1);
      const firstWarningCall = warningSpy.mock.calls[0];
      if (!firstWarningCall) {
        throw new Error("Expected logger warning call for listProjectDirectories failure");
      }
      const warningContext = AgentRouteWarningContextSchema.parse(firstWarningCall[0]);
      expect(firstWarningCall[1]).toBe("agent-project-directory-list-failed");
      expect(warningContext.agentId).toBe("codex");
      expect(warningContext.error.length).toBeLessThan(longErrorMessage.length);
    } finally {
      warningSpy.mockRestore();
    }
  });
});
