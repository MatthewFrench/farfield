import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import {
  type AppServerCollaborationModeListResponse,
  AppServerCollaborationModeListResponseSchema,
  type AppServerListModelsResponse,
  AppServerListModelsResponseSchema,
  AppServerReasoningEffortSchema,
  FarfieldApiErrorResponseSchema,
} from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConfigDefaults,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentId,
  AgentInterruptInput,
  AgentListAppsResult,
  AgentListExperimentalFeaturesResult,
  AgentListMcpServerStatusesResult,
  AgentListSkillsResult,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadConfigRequirementsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
} from "../Source/Agents/Types.js";
import { handleCapabilityRoutes } from "../Source/Network/Routes/CapabilityRoutes.js";

const CapabilityConfigDefaultsResponseSchema = z
  .object({
    ok: z.literal(true),
    agentId: z.union([z.literal("codex"), z.literal("opencode"), z.null()]),
    model: z.string().nullable(),
    reasoningEffort: AppServerReasoningEffortSchema.nullable(),
  })
  .strict();

const CapabilityModelsEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(AppServerListModelsResponseSchema);

const CapabilityCollaborationModesEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(AppServerCollaborationModeListResponseSchema);

const CapabilityConfigRequirementsEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    requirements: z
      .object({
        allowedApprovalPolicies: z.array(z.string()).nullable(),
      })
      .passthrough()
      .nullable(),
  })
  .strict();

const CapabilityExperimentalFeaturesEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z.object({
        name: z.string(),
        stage: z.string(),
        enabled: z.boolean(),
        defaultEnabled: z.boolean(),
      }),
    ),
    nextCursor: z.union([z.string(), z.null()]),
  })
  .strict();

const CapabilityMcpServersEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z.object({
        name: z.string(),
        toolCount: z.number().int().nonnegative(),
        resourceCount: z.number().int().nonnegative(),
        resourceTemplateCount: z.number().int().nonnegative(),
      }),
    ),
    nextCursor: z.union([z.string(), z.null()]),
  })
  .strict();

const CapabilityAppsEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        isAccessible: z.boolean(),
        isEnabled: z.boolean(),
      }),
    ),
    nextCursor: z.union([z.string(), z.null()]),
  })
  .strict();

const CapabilitySkillsEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z.object({
        cwd: z.string(),
        skills: z.array(
          z.object({
            name: z.string(),
            scope: z.string(),
            enabled: z.boolean(),
          }),
        ),
      }),
    ),
  })
  .strict();

interface CapabilityRouteExecutionResult {
  handled: boolean;
  statusCode: number | null;
  body: object | null;
}

type ParseInteger = (value: string | null, defaultValue: number) => number;
type ParseAgentId = (value: string | null) => AgentId | null;
type WithTimeout = <ValueType>(
  promise: Promise<ValueType>,
  timeoutMs: number,
  label: string,
) => Promise<ValueType>;

interface ExecuteCapabilityRouteInput {
  pathname: string;
  url: URL;
  adapters?: AgentAdapter[];
  method?: "GET" | "POST";
  capabilityListTimeoutMs?: number;
  parseInteger?: ParseInteger;
  parseAgentId?: ParseAgentId;
  withTimeout?: WithTimeout;
}

interface MockAgentAdapterOptions {
  id: AgentId;
  enabled?: boolean;
  connected?: boolean;
  capabilities?: Partial<AgentCapabilities>;
  readConfigRequirements?: () => Promise<AgentReadConfigRequirementsResult>;
  listExperimentalFeatures?: () => Promise<AgentListExperimentalFeaturesResult>;
  listMcpServerStatuses?: () => Promise<AgentListMcpServerStatusesResult>;
  listApps?: () => Promise<AgentListAppsResult>;
  listSkills?: () => Promise<AgentListSkillsResult>;
  listModels?: (limit: number) => Promise<AppServerListModelsResponse>;
  listCollaborationModes?: () => Promise<AppServerCollaborationModeListResponse>;
  readConfigDefaults?: () => Promise<AgentConfigDefaults>;
}

function readRouteBody(result: CapabilityRouteExecutionResult): object {
  if (!result.body) {
    throw new Error("Expected route handler to return a JSON body");
  }
  return result.body;
}

function createMockRequestResponsePair(): {
  request: IncomingMessage;
  response: ServerResponse;
} {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response,
  };
}

function createDefaultCapabilities(overrides?: Partial<AgentCapabilities>): AgentCapabilities {
  return {
    canListModels: false,
    canListCollaborationModes: false,
    canReadConfigRequirements: false,
    canListExperimentalFeatures: false,
    canListMcpServerStatuses: false,
    canListApps: false,
    canListSkills: false,
    canSetCollaborationMode: false,
    canSubmitUserInput: false,
    canReadLiveState: false,
    canReadStreamEvents: false,
    ...overrides,
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
        nextCursor: null,
      };
    },
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("Not used in capability route tests");
    },
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("Not used in capability route tests");
    },
    async sendMessage(_input: AgentSendMessageInput): Promise<void> {
      throw new Error("Not used in capability route tests");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("Not used in capability route tests");
    },
  };

  if (options.listModels) {
    adapter.listModels = options.listModels;
  }

  if (options.listCollaborationModes) {
    adapter.listCollaborationModes = options.listCollaborationModes;
  }

  if (options.readConfigDefaults) {
    adapter.readConfigDefaults = options.readConfigDefaults;
  }

  if (options.readConfigRequirements) {
    adapter.readConfigRequirements = options.readConfigRequirements;
  }

  if (options.listExperimentalFeatures) {
    adapter.listExperimentalFeatures = options.listExperimentalFeatures;
  }

  if (options.listMcpServerStatuses) {
    adapter.listMcpServerStatuses = options.listMcpServerStatuses;
  }

  if (options.listApps) {
    adapter.listApps = options.listApps;
  }

  if (options.listSkills) {
    adapter.listSkills = options.listSkills;
  }

  return adapter;
}

function parseAgentId(value: string | null): AgentId | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "codex") {
    return "codex";
  }
  if (normalized === "opencode") {
    return "opencode";
  }

  return null;
}

function parseInteger(value: string | null, defaultValue: number): number {
  if (value === null) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return defaultValue;
}

async function executeCapabilityRoute(
  input: ExecuteCapabilityRouteInput,
): Promise<CapabilityRouteExecutionResult> {
  const { request, response } = createMockRequestResponsePair();
  request.method = input.method ?? "GET";

  let statusCode: number | null = null;
  let body: object | null = null;

  const handled = await handleCapabilityRoutes({
    req: request,
    res: response,
    pathname: input.pathname,
    url: input.url,
    capabilityListTimeoutMs: input.capabilityListTimeoutMs ?? 5_000,
    registry: new AgentRegistry(input.adapters ?? []),
    parseInteger: input.parseInteger ?? parseInteger,
    parseAgentId: input.parseAgentId ?? parseAgentId,
    withTimeout: input.withTimeout ?? (async (promise) => promise),
    jsonResponse: (_response, nextStatusCode, nextBody) => {
      statusCode = nextStatusCode;
      body = nextBody;
    },
  });

  return {
    handled,
    statusCode,
    body,
  };
}

describe("handleCapabilityRoutes", () => {
  it("returns 400 when config defaults query contains an invalid agent identifier", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/config/defaults",
      url: new URL("http://localhost/api/config/defaults?agentId=not-an-agent"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid agentId: not-an-agent",
    });
  });

  it("normalizes config-defaults reasoning effort to strict schema values", async () => {
    const adapter = createMockAgentAdapter({
      id: "codex",
      readConfigDefaults: async (): Promise<AgentConfigDefaults> => ({
        model: "gpt-5",
        reasoningEffort: "not-a-valid-effort",
      }),
    });

    const result = await executeCapabilityRoute({
      pathname: "/api/config/defaults",
      url: new URL("http://localhost/api/config/defaults"),
      adapters: [adapter],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedConfigDefaultsResponse = CapabilityConfigDefaultsResponseSchema.parse(
      readRouteBody(result),
    );
    expect(parsedConfigDefaultsResponse).toEqual({
      ok: true,
      agentId: "codex",
      model: "gpt-5",
      reasoningEffort: null,
    });
  });

  it("maps model-list responses through explicit route envelope fields", async () => {
    const parseIntegerSpy = vi.fn<ParseInteger>((value, defaultValue) => {
      if (value === null) {
        return defaultValue;
      }
      return Number(value);
    });
    const listModelsSpy = vi.fn(
      async (_limit: number): Promise<AppServerListModelsResponse> => ({
        data: [],
      }),
    );

    const result = await executeCapabilityRoute({
      pathname: "/api/models",
      url: new URL("http://localhost/api/models?limit=25"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canListModels: true,
          },
          listModels: listModelsSpy,
        }),
      ],
      parseInteger: parseIntegerSpy,
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(parseIntegerSpy).toHaveBeenCalledWith("25", 100);
    expect(listModelsSpy).toHaveBeenCalledWith(25);
    const parsedModelsResponse = CapabilityModelsEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedModelsResponse).toEqual({
      ok: true,
      data: [],
      nextCursor: null,
    });
  });

  it("returns a 503 contract error when model listing fails", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/models",
      url: new URL("http://localhost/api/models?limit=30"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canListModels: true,
          },
          listModels: async (): Promise<AppServerListModelsResponse> => {
            throw new Error("listing failure");
          },
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(503);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Failed to list models: listing failure",
    });
  });

  it("returns an empty collaboration-mode list when no adapter supports the capability", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/collaboration-modes",
      url: new URL("http://localhost/api/collaboration-modes"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedCollaborationModesResponse = CapabilityCollaborationModesEnvelopeSchema.parse(
      readRouteBody(result),
    );
    expect(parsedCollaborationModesResponse).toEqual({
      ok: true,
      data: [],
    });
  });

  it("returns config requirements when adapter supports read-config-requirements", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/config-requirements",
      url: new URL("http://localhost/api/config-requirements"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canReadConfigRequirements: true,
          },
          readConfigRequirements: async (): Promise<AgentReadConfigRequirementsResult> => ({
            requirements: {
              allowedApprovalPolicies: ["on-request"],
              allowedSandboxModes: null,
              allowedWebSearchModes: null,
              enforceResidency: "us",
              network: null,
            },
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityConfigRequirementsEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      requirements: {
        allowedApprovalPolicies: ["on-request"],
        allowedSandboxModes: null,
        allowedWebSearchModes: null,
        enforceResidency: "us",
        network: null,
      },
    });
  });

  it("lists experimental features when adapter supports the capability", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/experimental-features",
      url: new URL("http://localhost/api/experimental-features?limit=20&cursor=page-2"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canListExperimentalFeatures: true,
          },
          listExperimentalFeatures: async (): Promise<AgentListExperimentalFeaturesResult> => ({
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
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityExperimentalFeaturesEnvelopeSchema.parse(
      readRouteBody(result),
    );
    expect(parsedEnvelope.data[0]?.name).toBe("advanced-diff-view");
  });

  it("lists mcp server status summaries when adapter supports the capability", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/mcp-servers",
      url: new URL("http://localhost/api/mcp-servers?limit=15"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canListMcpServerStatuses: true,
          },
          listMcpServerStatuses: async (): Promise<AgentListMcpServerStatusesResult> => ({
            data: [
              {
                name: "github",
                authStatus: "authenticated",
                toolCount: 3,
                resourceCount: 2,
                resourceTemplateCount: 1,
              },
            ],
            nextCursor: null,
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityMcpServersEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope.data[0]?.toolCount).toBe(3);
  });

  it("lists apps when adapter supports the capability", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/apps",
      url: new URL("http://localhost/api/apps?forceRefetch=true&threadId=thread-1"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canListApps: true,
          },
          listApps: async (): Promise<AgentListAppsResult> => ({
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
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityAppsEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope.data[0]?.id).toBe("app-github");
  });

  it("lists skills when adapter supports the capability", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/skills",
      url: new URL("http://localhost/api/skills?forceReload=true"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canListSkills: true,
          },
          listSkills: async (): Promise<AgentListSkillsResult> => ({
            data: [
              {
                cwd: "/tmp/workspace",
                skills: [
                  {
                    name: "checks",
                    description: "Run repository checks",
                    shortDescription: "Checks",
                    path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
                    scope: "repo",
                    enabled: true,
                  },
                ],
                errors: [],
              },
            ],
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilitySkillsEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope.data[0]?.skills[0]?.name).toBe("checks");
  });
});
