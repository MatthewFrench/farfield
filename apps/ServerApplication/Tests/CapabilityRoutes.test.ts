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
  AgentCancelAccountLoginInput,
  AgentCancelAccountLoginResult,
  AgentCapabilities,
  AgentCommandExecutionInput,
  AgentCommandExecutionResult,
  AgentConfigDefaults,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentExportRemoteSkillInput,
  AgentExportRemoteSkillResult,
  AgentId,
  AgentInterruptInput,
  AgentListAppsResult,
  AgentListExperimentalFeaturesResult,
  AgentListMcpServerStatusesResult,
  AgentListRemoteSkillsInput,
  AgentListRemoteSkillsResult,
  AgentListSkillsResult,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadAccountRateLimitsResult,
  AgentReadAccountResult,
  AgentReadConfigRequirementsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
  AgentStartAccountLoginInput,
  AgentStartAccountLoginResult,
  AgentStartMcpServerOauthLoginInput,
  AgentStartMcpServerOauthLoginResult,
  AgentWriteConfigValueInput,
  AgentWriteConfigValueResult,
  AgentWriteSkillsConfigInput,
  AgentWriteSkillsConfigResult,
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

const CapabilityAccountEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    account: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("apiKey"),
        }),
        z.object({
          type: z.literal("chatgpt"),
          email: z.string(),
          planType: z.enum([
            "free",
            "go",
            "plus",
            "pro",
            "team",
            "business",
            "enterprise",
            "edu",
            "unknown",
          ]),
        }),
      ])
      .nullable(),
    requiresOpenaiAuth: z.boolean(),
  })
  .strict();

const CapabilityAccountRateLimitSnapshotSchema = z
  .object({
    credits: z
      .object({
        balance: z.string().nullable(),
        hasCredits: z.boolean(),
        unlimited: z.boolean(),
      })
      .nullable(),
    limitId: z.string().nullable(),
    limitName: z.string().nullable(),
    planType: z
      .enum(["free", "go", "plus", "pro", "team", "business", "enterprise", "edu", "unknown"])
      .nullable(),
    primary: z
      .object({
        resetsAt: z.number().int().nullable(),
        usedPercent: z.number().int(),
        windowDurationMins: z.number().int().nullable(),
      })
      .nullable(),
    secondary: z
      .object({
        resetsAt: z.number().int().nullable(),
        usedPercent: z.number().int(),
        windowDurationMins: z.number().int().nullable(),
      })
      .nullable(),
  })
  .strict();

const CapabilityAccountRateLimitsEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    rateLimits: CapabilityAccountRateLimitSnapshotSchema.nullable(),
    rateLimitsByLimitId: z.record(CapabilityAccountRateLimitSnapshotSchema).nullable(),
  })
  .strict();

const CapabilityAccountLoginStartEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    type: z.enum(["apiKey", "chatgpt", "chatgptAuthTokens"]),
    loginId: z.string().optional(),
    authUrl: z.string().optional(),
  })
  .strict();

const CapabilityAccountLoginCancelEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    status: z.enum(["canceled", "notFound"]),
  })
  .strict();

const CapabilityMutationSuccessEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();

const CapabilityMcpServerOauthLoginEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    authorizationUrl: z.string().min(1),
  })
  .strict();

const CapabilitySkillsConfigWriteEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    effectiveEnabled: z.boolean(),
  })
  .strict();

const CapabilityConfigValueWriteEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    status: z.enum(["ok", "okOverridden"]),
    version: z.string().min(1),
    filePath: z.string().min(1),
    overriddenMetadata: z
      .object({
        message: z.string().min(1),
        overridingLayer: z.unknown(),
        effectiveValue: z.unknown(),
      })
      .nullable(),
  })
  .strict();

const CapabilitySkillsRemoteListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string(),
      }),
    ),
  })
  .strict();

const CapabilitySkillsRemoteExportEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    id: z.string().min(1),
    path: z.string().min(1),
  })
  .strict();

const CapabilityCommandExecutionEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    exitCode: z.number().int(),
    stdout: z.string(),
    stderr: z.string(),
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
  readAccount?: () => Promise<AgentReadAccountResult>;
  readAccountRateLimits?: () => Promise<AgentReadAccountRateLimitsResult>;
  executeCommand?: (input: AgentCommandExecutionInput) => Promise<AgentCommandExecutionResult>;
  startAccountLogin?: (input: AgentStartAccountLoginInput) => Promise<AgentStartAccountLoginResult>;
  cancelAccountLogin?: (
    input: AgentCancelAccountLoginInput,
  ) => Promise<AgentCancelAccountLoginResult>;
  logoutAccount?: () => Promise<void>;
  reloadMcpServerConfig?: () => Promise<void>;
  startMcpServerOauthLogin?: (
    input: AgentStartMcpServerOauthLoginInput,
  ) => Promise<AgentStartMcpServerOauthLoginResult>;
  writeConfigValue?: (input: AgentWriteConfigValueInput) => Promise<AgentWriteConfigValueResult>;
  writeSkillsConfig?: (input: AgentWriteSkillsConfigInput) => Promise<AgentWriteSkillsConfigResult>;
  listRemoteSkills?: (input: AgentListRemoteSkillsInput) => Promise<AgentListRemoteSkillsResult>;
  exportRemoteSkill?: (input: AgentExportRemoteSkillInput) => Promise<AgentExportRemoteSkillResult>;
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
    canReadAccount: false,
    canReadAccountRateLimits: false,
    canExecuteCommand: false,
    canStartAccountLogin: false,
    canCancelAccountLogin: false,
    canLogoutAccount: false,
    canReloadMcpServerConfig: false,
    canStartMcpServerOauthLogin: false,
    canWriteConfigValue: false,
    canWriteSkillsConfig: false,
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

  if (options.readAccount) {
    adapter.readAccount = options.readAccount;
  }

  if (options.readAccountRateLimits) {
    adapter.readAccountRateLimits = options.readAccountRateLimits;
  }

  if (options.executeCommand) {
    adapter.executeCommand = options.executeCommand;
  }

  if (options.startAccountLogin) {
    adapter.startAccountLogin = options.startAccountLogin;
  }

  if (options.cancelAccountLogin) {
    adapter.cancelAccountLogin = options.cancelAccountLogin;
  }

  if (options.logoutAccount) {
    adapter.logoutAccount = options.logoutAccount;
  }

  if (options.reloadMcpServerConfig) {
    adapter.reloadMcpServerConfig = options.reloadMcpServerConfig;
  }

  if (options.startMcpServerOauthLogin) {
    adapter.startMcpServerOauthLogin = options.startMcpServerOauthLogin;
  }

  if (options.writeConfigValue) {
    adapter.writeConfigValue = options.writeConfigValue;
  }

  if (options.writeSkillsConfig) {
    adapter.writeSkillsConfig = options.writeSkillsConfig;
  }

  if (options.listRemoteSkills) {
    adapter.listRemoteSkills = options.listRemoteSkills;
  }

  if (options.exportRemoteSkill) {
    adapter.exportRemoteSkill = options.exportRemoteSkill;
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

  it("returns account summary when adapter supports account read", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/account",
      url: new URL("http://localhost/api/account?refreshToken=true"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canReadAccount: true,
          },
          readAccount: async (): Promise<AgentReadAccountResult> => ({
            account: {
              type: "chatgpt",
              email: "dev@example.com",
              planType: "pro",
            },
            requiresOpenaiAuth: false,
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityAccountEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope.account?.type).toBe("chatgpt");
  });

  it("returns account rate limits when adapter supports rate-limit read", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/account/rate-limits",
      url: new URL("http://localhost/api/account/rate-limits"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canReadAccountRateLimits: true,
          },
          readAccountRateLimits: async (): Promise<AgentReadAccountRateLimitsResult> => ({
            rateLimits: {
              credits: null,
              limitId: "codex",
              limitName: "Codex",
              planType: "pro",
              primary: {
                usedPercent: 42,
                resetsAt: 1_700_000_000,
                windowDurationMins: 60,
              },
              secondary: null,
            },
            rateLimitsByLimitId: null,
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityAccountRateLimitsEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope.rateLimits?.limitId).toBe("codex");
  });

  it("starts account login when adapter supports login start", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/account/login/start",
      url: new URL("http://localhost/api/account/login/start"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canStartAccountLogin: true,
          },
          startAccountLogin: async (): Promise<AgentStartAccountLoginResult> => ({
            type: "chatgpt",
            loginId: "login-1",
            authUrl: "https://example.com/oauth/start",
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityAccountLoginStartEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      type: "chatgpt",
      loginId: "login-1",
      authUrl: "https://example.com/oauth/start",
    });
  });

  it("returns 400 when command execution omits command query parameters", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/commands/exec",
      url: new URL("http://localhost/api/commands/exec"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing command query parameter. Use repeated command query values.",
    });
  });

  it("returns 400 when command execution includes empty command arguments", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/commands/exec",
      url: new URL("http://localhost/api/commands/exec?command="),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid command query parameter. Expected non-empty command arguments.",
    });
  });

  it("executes command when adapter supports command execution", async () => {
    const executeCommandSpy = vi.fn(
      async (): Promise<AgentCommandExecutionResult> => ({
        exitCode: 0,
        stdout: "/tmp/workspace\n",
        stderr: "",
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/commands/exec",
      url: new URL(
        "http://localhost/api/commands/exec?agentId=codex&command=pwd&command=-P&cwd=/tmp/workspace&timeoutMs=5000",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canExecuteCommand: true,
          },
          executeCommand: executeCommandSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(executeCommandSpy).toHaveBeenCalledWith({
      command: ["pwd", "-P"],
      cwd: "/tmp/workspace",
      timeoutMilliseconds: 5000,
    });
    const parsedEnvelope = CapabilityCommandExecutionEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      exitCode: 0,
      stdout: "/tmp/workspace\n",
      stderr: "",
    });
  });

  it("returns 400 when account login cancel omits loginId", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/account/login/cancel",
      url: new URL("http://localhost/api/account/login/cancel"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing loginId query parameter.",
    });
  });

  it("cancels account login when adapter supports login cancel", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/account/login/cancel",
      url: new URL("http://localhost/api/account/login/cancel?loginId=login-1"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canCancelAccountLogin: true,
          },
          cancelAccountLogin: async (): Promise<AgentCancelAccountLoginResult> => ({
            status: "canceled",
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityAccountLoginCancelEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      status: "canceled",
    });
  });

  it("logs out account when adapter supports logout", async () => {
    const logoutAccountSpy = vi.fn(async (): Promise<void> => {});
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/account/logout",
      url: new URL("http://localhost/api/account/logout"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canLogoutAccount: true,
          },
          logoutAccount: logoutAccountSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(logoutAccountSpy).toHaveBeenCalledTimes(1);
    const parsedEnvelope = CapabilityMutationSuccessEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
    });
  });

  it("reloads mcp server config when adapter supports config reload", async () => {
    const reloadMcpServerConfigSpy = vi.fn(async (): Promise<void> => {});
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/config/mcp-server/reload",
      url: new URL("http://localhost/api/config/mcp-server/reload"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canReloadMcpServerConfig: true,
          },
          reloadMcpServerConfig: reloadMcpServerConfigSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(reloadMcpServerConfigSpy).toHaveBeenCalledTimes(1);
    const parsedEnvelope = CapabilityMutationSuccessEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
    });
  });

  it("returns 400 when config value write omits keyPath", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/config/value/write",
      url: new URL(
        "http://localhost/api/config/value/write?value=%7B%22enabled%22%3Atrue%7D&mergeStrategy=upsert",
      ),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing keyPath query parameter.",
    });
  });

  it("returns 400 when config value write receives invalid JSON value", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/config/value/write",
      url: new URL(
        "http://localhost/api/config/value/write?keyPath=integrations.github&value=not-json&mergeStrategy=upsert",
      ),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid value query parameter. Expected JSON value.",
    });
  });

  it("writes config value when adapter supports config value writes", async () => {
    const writeConfigValueSpy = vi.fn(
      async (): Promise<AgentWriteConfigValueResult> => ({
        status: "okOverridden",
        version: "v2",
        filePath: "/tmp/workspace/.codex/config.toml",
        overriddenMetadata: {
          message: "Workspace layer overrides base profile.",
          overridingLayer: "workspace",
          effectiveValue: {
            enabled: true,
          },
        },
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/config/value/write",
      url: new URL(
        "http://localhost/api/config/value/write?keyPath=integrations.github&value=%7B%22enabled%22%3Atrue%7D&mergeStrategy=upsert&filePath=%2Ftmp%2Fworkspace%2F.codex%2Fconfig.toml&expectedVersion=v1",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canWriteConfigValue: true,
          },
          writeConfigValue: writeConfigValueSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(writeConfigValueSpy).toHaveBeenCalledWith({
      keyPath: "integrations.github",
      value: {
        enabled: true,
      },
      mergeStrategy: "upsert",
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v1",
    });
    const parsedEnvelope = CapabilityConfigValueWriteEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      status: "okOverridden",
      version: "v2",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: {
        message: "Workspace layer overrides base profile.",
        overridingLayer: "workspace",
        effectiveValue: {
          enabled: true,
        },
      },
    });
  });

  it("returns 400 when mcp oauth login omits server name", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/mcp-servers/oauth/login",
      url: new URL("http://localhost/api/mcp-servers/oauth/login"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing name query parameter.",
    });
  });

  it("starts mcp oauth login when adapter supports oauth login", async () => {
    const startMcpServerOauthLoginSpy = vi.fn(
      async (): Promise<AgentStartMcpServerOauthLoginResult> => ({
        authorizationUrl: "https://example.com/oauth/mcp/github",
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/mcp-servers/oauth/login",
      url: new URL(
        "http://localhost/api/mcp-servers/oauth/login?name=github&scopes=read%3Aorg%2Crepo&timeoutSeconds=120",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canStartMcpServerOauthLogin: true,
          },
          startMcpServerOauthLogin: startMcpServerOauthLoginSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(startMcpServerOauthLoginSpy).toHaveBeenCalledWith({
      name: "github",
      scopes: ["read:org", "repo"],
      timeoutSeconds: 120,
    });
    const parsedEnvelope = CapabilityMcpServerOauthLoginEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      authorizationUrl: "https://example.com/oauth/mcp/github",
    });
  });

  it("returns 400 when skills config write has invalid enabled query value", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/skills/config/write",
      url: new URL(
        "http://localhost/api/skills/config/write?path=/tmp/checks/SKILL.md&enabled=maybe",
      ),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid enabled query parameter. Expected true/false or 1/0.",
    });
  });

  it("writes skills config when adapter supports config writes", async () => {
    const writeSkillsConfigSpy = vi.fn(
      async (): Promise<AgentWriteSkillsConfigResult> => ({
        effectiveEnabled: false,
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/skills/config/write",
      url: new URL(
        "http://localhost/api/skills/config/write?path=/tmp/workspace/.codex/skills/checks/SKILL.md&enabled=0",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canWriteConfigValue: true,
            canWriteSkillsConfig: true,
          },
          writeSkillsConfig: writeSkillsConfigSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(writeSkillsConfigSpy).toHaveBeenCalledWith({
      path: "/tmp/workspace/.codex/skills/checks/SKILL.md",
      enabled: false,
    });
    const parsedEnvelope = CapabilitySkillsConfigWriteEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      effectiveEnabled: false,
    });
  });

  it("returns 400 when remote skill list omits hazelnutScope", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/skills/remote/list",
      url: new URL("http://localhost/api/skills/remote/list?productSurface=codex&enabled=true"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing hazelnutScope query parameter.",
    });
  });

  it("lists remote skills when adapter supports the skills capability", async () => {
    const listRemoteSkillsSpy = vi.fn(
      async (): Promise<AgentListRemoteSkillsResult> => ({
        data: [
          {
            id: "remote-skill-1",
            name: "Repository checks",
            description: "Run repository checks before review",
          },
        ],
      }),
    );
    const result = await executeCapabilityRoute({
      pathname: "/api/skills/remote/list",
      url: new URL(
        "http://localhost/api/skills/remote/list?hazelnutScope=personal&productSurface=codex&enabled=1",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canListSkills: true,
          },
          listRemoteSkills: listRemoteSkillsSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(listRemoteSkillsSpy).toHaveBeenCalledWith({
      hazelnutScope: "personal",
      productSurface: "codex",
      enabled: true,
    });
    const parsedEnvelope = CapabilitySkillsRemoteListEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      data: [
        {
          id: "remote-skill-1",
          name: "Repository checks",
          description: "Run repository checks before review",
        },
      ],
    });
  });

  it("returns 400 when remote skill export omits hazelnutId", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/skills/remote/export",
      url: new URL("http://localhost/api/skills/remote/export"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing hazelnutId query parameter.",
    });
  });

  it("exports remote skills when adapter supports skills-config writes", async () => {
    const exportRemoteSkillSpy = vi.fn(
      async (): Promise<AgentExportRemoteSkillResult> => ({
        id: "remote-skill-1",
        path: "/tmp/workspace/.codex/skills/repository-checks/SKILL.md",
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/skills/remote/export",
      url: new URL("http://localhost/api/skills/remote/export?hazelnutId=remote-skill-1"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canWriteConfigValue: true,
            canWriteSkillsConfig: true,
          },
          exportRemoteSkill: exportRemoteSkillSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(exportRemoteSkillSpy).toHaveBeenCalledWith({
      hazelnutId: "remote-skill-1",
    });
    const parsedEnvelope = CapabilitySkillsRemoteExportEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      id: "remote-skill-1",
      path: "/tmp/workspace/.codex/skills/repository-checks/SKILL.md",
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
