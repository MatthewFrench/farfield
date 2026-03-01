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
  AgentAppendThreadRealtimeAudioInput,
  AgentAppendThreadRealtimeAudioResult,
  AgentAppendThreadRealtimeTextInput,
  AgentAppendThreadRealtimeTextResult,
  AgentCancelAccountLoginInput,
  AgentCancelAccountLoginResult,
  AgentCapabilities,
  AgentCommandExecutionInput,
  AgentCommandExecutionResult,
  AgentConfigDefaults,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentDetectExternalAgentConfigInput,
  AgentDetectExternalAgentConfigResult,
  AgentExportRemoteSkillInput,
  AgentExportRemoteSkillResult,
  AgentFuzzyFileSearchInput,
  AgentFuzzyFileSearchResult,
  AgentGitDiffToRemoteInput,
  AgentGitDiffToRemoteResult,
  AgentId,
  AgentImportExternalAgentConfigInput,
  AgentImportExternalAgentConfigResult,
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
  AgentReadAuthStatusInput,
  AgentReadAuthStatusResult,
  AgentReadConfigRequirementsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentReadUserInfoResult,
  AgentSendMessageInput,
  AgentStartAccountLoginInput,
  AgentStartAccountLoginResult,
  AgentStartMcpServerOauthLoginInput,
  AgentStartMcpServerOauthLoginResult,
  AgentStartThreadRealtimeInput,
  AgentStartThreadRealtimeResult,
  AgentStartWindowsSandboxSetupInput,
  AgentStartWindowsSandboxSetupResult,
  AgentStopThreadRealtimeInput,
  AgentStopThreadRealtimeResult,
  AgentUploadFeedbackInput,
  AgentUploadFeedbackResult,
  AgentWriteConfigBatchInput,
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

const CapabilityAccountAuthStatusEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    authMethod: z.enum(["apikey", "chatgpt", "chatgptAuthTokens"]).nullable(),
    authToken: z.string().nullable(),
    requiresOpenaiAuth: z.boolean().nullable(),
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

const CapabilityAccountUserInfoEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    allegedUserEmail: z.string().nullable(),
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

const CapabilityExternalAgentConfigDetectEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    items: z.array(
      z.object({
        itemType: z.enum(["AGENTS_MD", "CONFIG", "SKILLS", "MCP_SERVER_CONFIG"]),
        description: z.string().min(1),
        cwd: z.string().nullable(),
      }),
    ),
  })
  .strict();

const CapabilityWindowsSandboxSetupStartEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    started: z.boolean(),
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

const CapabilityFeedbackUploadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
  })
  .strict();

const CapabilityGitDiffToRemoteEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    sha: z.string().min(1),
    diff: z.string(),
  })
  .strict();

const CapabilityFuzzyFileSearchEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    files: z.array(
      z
        .object({
          root: z.string().min(1),
          path: z.string().min(1),
          fileName: z.string().min(1),
          score: z.number(),
          indices: z.array(z.number().int()).nullable(),
        })
        .strict(),
    ),
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
  readAuthStatus?: (input: AgentReadAuthStatusInput) => Promise<AgentReadAuthStatusResult>;
  readAccountRateLimits?: () => Promise<AgentReadAccountRateLimitsResult>;
  readUserInfo?: () => Promise<AgentReadUserInfoResult>;
  uploadFeedback?: (input: AgentUploadFeedbackInput) => Promise<AgentUploadFeedbackResult>;
  gitDiffToRemote?: (input: AgentGitDiffToRemoteInput) => Promise<AgentGitDiffToRemoteResult>;
  fuzzyFileSearch?: (input: AgentFuzzyFileSearchInput) => Promise<AgentFuzzyFileSearchResult>;
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
  writeConfigBatch?: (input: AgentWriteConfigBatchInput) => Promise<AgentWriteConfigValueResult>;
  writeConfigValue?: (input: AgentWriteConfigValueInput) => Promise<AgentWriteConfigValueResult>;
  writeSkillsConfig?: (input: AgentWriteSkillsConfigInput) => Promise<AgentWriteSkillsConfigResult>;
  listRemoteSkills?: (input: AgentListRemoteSkillsInput) => Promise<AgentListRemoteSkillsResult>;
  exportRemoteSkill?: (input: AgentExportRemoteSkillInput) => Promise<AgentExportRemoteSkillResult>;
  detectExternalAgentConfig?: (
    input: AgentDetectExternalAgentConfigInput,
  ) => Promise<AgentDetectExternalAgentConfigResult>;
  importExternalAgentConfig?: (
    input: AgentImportExternalAgentConfigInput,
  ) => Promise<AgentImportExternalAgentConfigResult>;
  startThreadRealtime?: (
    input: AgentStartThreadRealtimeInput,
  ) => Promise<AgentStartThreadRealtimeResult>;
  appendThreadRealtimeAudio?: (
    input: AgentAppendThreadRealtimeAudioInput,
  ) => Promise<AgentAppendThreadRealtimeAudioResult>;
  appendThreadRealtimeText?: (
    input: AgentAppendThreadRealtimeTextInput,
  ) => Promise<AgentAppendThreadRealtimeTextResult>;
  stopThreadRealtime?: (
    input: AgentStopThreadRealtimeInput,
  ) => Promise<AgentStopThreadRealtimeResult>;
  startWindowsSandboxSetup?: (
    input: AgentStartWindowsSandboxSetupInput,
  ) => Promise<AgentStartWindowsSandboxSetupResult>;
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
    canStartThreadRealtime: false,
    canAppendThreadRealtimeAudio: false,
    canAppendThreadRealtimeText: false,
    canStopThreadRealtime: false,
    canStartWindowsSandboxSetup: false,
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

  if (options.readAuthStatus) {
    adapter.readAuthStatus = options.readAuthStatus;
  }

  if (options.readAccountRateLimits) {
    adapter.readAccountRateLimits = options.readAccountRateLimits;
  }

  if (options.readUserInfo) {
    adapter.readUserInfo = options.readUserInfo;
  }

  if (options.uploadFeedback) {
    adapter.uploadFeedback = options.uploadFeedback;
  }

  if (options.gitDiffToRemote) {
    adapter.gitDiffToRemote = options.gitDiffToRemote;
  }

  if (options.fuzzyFileSearch) {
    adapter.fuzzyFileSearch = options.fuzzyFileSearch;
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

  if (options.writeConfigBatch) {
    adapter.writeConfigBatch = options.writeConfigBatch;
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

  if (options.detectExternalAgentConfig) {
    adapter.detectExternalAgentConfig = options.detectExternalAgentConfig;
  }

  if (options.importExternalAgentConfig) {
    adapter.importExternalAgentConfig = options.importExternalAgentConfig;
  }

  if (options.startThreadRealtime) {
    adapter.startThreadRealtime = options.startThreadRealtime;
  }

  if (options.appendThreadRealtimeAudio) {
    adapter.appendThreadRealtimeAudio = options.appendThreadRealtimeAudio;
  }

  if (options.appendThreadRealtimeText) {
    adapter.appendThreadRealtimeText = options.appendThreadRealtimeText;
  }

  if (options.stopThreadRealtime) {
    adapter.stopThreadRealtime = options.stopThreadRealtime;
  }

  if (options.startWindowsSandboxSetup) {
    adapter.startWindowsSandboxSetup = options.startWindowsSandboxSetup;
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

  it("returns auth status when adapter supports auth-status read", async () => {
    const readAuthStatusSpy = vi.fn(
      async (input: AgentReadAuthStatusInput): Promise<AgentReadAuthStatusResult> => ({
        authMethod: "chatgpt",
        authToken: null,
        requiresOpenaiAuth: true,
      }),
    );

    const result = await executeCapabilityRoute({
      pathname: "/api/account/auth-status",
      url: new URL("http://localhost/api/account/auth-status?includeToken=true&refreshToken=0"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          readAuthStatus: readAuthStatusSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(readAuthStatusSpy).toHaveBeenCalledWith({
      includeToken: true,
      refreshToken: false,
    });
    const parsedEnvelope = CapabilityAccountAuthStatusEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      authMethod: "chatgpt",
      authToken: null,
      requiresOpenaiAuth: true,
    });
  });

  it("returns 400 when account auth-status includeToken is invalid", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/account/auth-status",
      url: new URL("http://localhost/api/account/auth-status?includeToken=definitely"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid includeToken query parameter. Expected true/false or 1/0.",
    });
  });

  it("returns user info when adapter supports user-info read", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/account/user-info",
      url: new URL("http://localhost/api/account/user-info"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          readUserInfo: async (): Promise<AgentReadUserInfoResult> => ({
            allegedUserEmail: "dev@example.com",
          }),
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    const parsedEnvelope = CapabilityAccountUserInfoEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      allegedUserEmail: "dev@example.com",
    });
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

  it("returns 400 when feedback upload omits classification", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/feedback/upload",
      url: new URL("http://localhost/api/feedback/upload?includeLogs=true"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing classification query parameter.",
    });
  });

  it("returns 400 when feedback upload omits includeLogs", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/feedback/upload",
      url: new URL("http://localhost/api/feedback/upload?classification=quality"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing includeLogs query parameter.",
    });
  });

  it("returns 400 when feedback upload includes invalid includeLogs", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/feedback/upload",
      url: new URL(
        "http://localhost/api/feedback/upload?classification=quality&includeLogs=definitely",
      ),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid includeLogs query parameter. Expected true/false or 1/0.",
    });
  });

  it("uploads feedback when adapter exposes feedback upload", async () => {
    const uploadFeedbackSpy = vi.fn(
      async (): Promise<AgentUploadFeedbackResult> => ({
        threadId: "thread-feedback-9",
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/feedback/upload",
      url: new URL(
        "http://localhost/api/feedback/upload?agentId=codex&classification=quality&includeLogs=true&reason=Missing%20edge%20case%20coverage&threadId=thread-1",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          uploadFeedback: uploadFeedbackSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(uploadFeedbackSpy).toHaveBeenCalledWith({
      classification: "quality",
      includeLogs: true,
      reason: "Missing edge case coverage",
      threadId: "thread-1",
    });
    const parsedEnvelope = CapabilityFeedbackUploadEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      threadId: "thread-feedback-9",
    });
  });

  it("returns 400 when git diff route omits cwd", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/git/diff-remote",
      url: new URL("http://localhost/api/git/diff-remote"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing cwd query parameter.",
    });
  });

  it("returns 400 when git diff route includes empty cwd", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/git/diff-remote",
      url: new URL("http://localhost/api/git/diff-remote?cwd=%20"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid cwd query parameter.",
    });
  });

  it("reads git diff to remote when adapter supports the method", async () => {
    const gitDiffToRemoteSpy = vi.fn(
      async (): Promise<AgentGitDiffToRemoteResult> => ({
        sha: "abc123def456",
        diff: "diff --git a/file.ts b/file.ts",
      }),
    );

    const result = await executeCapabilityRoute({
      pathname: "/api/git/diff-remote",
      url: new URL("http://localhost/api/git/diff-remote?agentId=codex&cwd=/tmp/workspace"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          gitDiffToRemote: gitDiffToRemoteSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(gitDiffToRemoteSpy).toHaveBeenCalledWith({
      cwd: "/tmp/workspace",
    });
    const parsedEnvelope = CapabilityGitDiffToRemoteEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      sha: "abc123def456",
      diff: "diff --git a/file.ts b/file.ts",
    });
  });

  it("returns 400 when fuzzy file search omits query", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/files/fuzzy-search",
      url: new URL("http://localhost/api/files/fuzzy-search?root=/tmp/project"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing query parameter.",
    });
  });

  it("returns 400 when fuzzy file search omits roots", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/files/fuzzy-search",
      url: new URL("http://localhost/api/files/fuzzy-search?query=main"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing root query parameter. Use repeated root query values.",
    });
  });

  it("searches fuzzy files when adapter supports the method", async () => {
    const fuzzyFileSearchSpy = vi.fn(
      async (): Promise<AgentFuzzyFileSearchResult> => ({
        files: [
          {
            root: "/tmp/project",
            path: "apps/WebApplication/Source/Main.tsx",
            fileName: "Main.tsx",
            score: 0.94,
            indices: [0, 1, 2],
          },
        ],
      }),
    );

    const result = await executeCapabilityRoute({
      pathname: "/api/files/fuzzy-search",
      url: new URL(
        "http://localhost/api/files/fuzzy-search?agentId=codex&query=main&root=/tmp/project&root=/tmp/project/packages&cancellationToken=token-1",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canSearchFuzzyFiles: true,
          },
          fuzzyFileSearch: fuzzyFileSearchSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(fuzzyFileSearchSpy).toHaveBeenCalledWith({
      query: "main",
      roots: ["/tmp/project", "/tmp/project/packages"],
      cancellationToken: "token-1",
    });
    const parsedEnvelope = CapabilityFuzzyFileSearchEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      files: [
        {
          root: "/tmp/project",
          path: "apps/WebApplication/Source/Main.tsx",
          fileName: "Main.tsx",
          score: 0.94,
          indices: [0, 1, 2],
        },
      ],
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

  it("returns 400 when config batch write omits edits", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/config/batch/write",
      url: new URL("http://localhost/api/config/batch/write"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing edits query parameter.",
    });
  });

  it("returns 400 when config batch write receives invalid edits JSON", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/config/batch/write",
      url: new URL("http://localhost/api/config/batch/write?edits=not-json"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid edits query parameter. Expected JSON array of config edits.",
    });
  });

  it("writes config batch when adapter supports config value writes", async () => {
    const writeConfigBatchSpy = vi.fn(
      async (): Promise<AgentWriteConfigValueResult> => ({
        status: "ok",
        version: "v3",
        filePath: "/tmp/workspace/.codex/config.toml",
        overriddenMetadata: null,
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/config/batch/write",
      url: new URL(
        "http://localhost/api/config/batch/write?edits=%5B%7B%22keyPath%22%3A%22integrations.github.enabled%22%2C%22value%22%3Atrue%2C%22mergeStrategy%22%3A%22replace%22%7D%2C%7B%22keyPath%22%3A%22integrations.github.scopes%22%2C%22value%22%3A%5B%22repo%22%5D%2C%22mergeStrategy%22%3A%22upsert%22%7D%5D&filePath=%2Ftmp%2Fworkspace%2F.codex%2Fconfig.toml&expectedVersion=v2",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canWriteConfigValue: true,
          },
          writeConfigBatch: writeConfigBatchSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(writeConfigBatchSpy).toHaveBeenCalledWith({
      edits: [
        {
          keyPath: "integrations.github.enabled",
          value: true,
          mergeStrategy: "replace",
        },
        {
          keyPath: "integrations.github.scopes",
          value: ["repo"],
          mergeStrategy: "upsert",
        },
      ],
      filePath: "/tmp/workspace/.codex/config.toml",
      expectedVersion: "v2",
    });
    const parsedEnvelope = CapabilityConfigValueWriteEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
      status: "ok",
      version: "v3",
      filePath: "/tmp/workspace/.codex/config.toml",
      overriddenMetadata: null,
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
            canDetectExternalAgentConfig: true,
            canImportExternalAgentConfig: true,
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
            canDetectExternalAgentConfig: true,
            canImportExternalAgentConfig: true,
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

  it("returns 400 when external-agent config detection has no targets", async () => {
    const result = await executeCapabilityRoute({
      pathname: "/api/external-agent-config/detect",
      url: new URL("http://localhost/api/external-agent-config/detect"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Specify includeHome=true and/or at least one cwd query parameter.",
    });
  });

  it("detects external-agent config migration items with includeHome and cwd filters", async () => {
    const detectExternalAgentConfigSpy = vi.fn(
      async (): Promise<AgentDetectExternalAgentConfigResult> => ({
        items: [
          {
            itemType: "AGENTS_MD",
            description: "Migrate AGENTS.md from ~/.claude",
            cwd: null,
          },
          {
            itemType: "CONFIG",
            description: "Import repository config",
            cwd: "/tmp/project",
          },
        ],
      }),
    );
    const result = await executeCapabilityRoute({
      pathname: "/api/external-agent-config/detect",
      url: new URL(
        "http://localhost/api/external-agent-config/detect?includeHome=true&cwd=/tmp/project&cwd=/tmp/project/packages",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canDetectExternalAgentConfig: true,
          },
          detectExternalAgentConfig: detectExternalAgentConfigSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(detectExternalAgentConfigSpy).toHaveBeenCalledWith({
      includeHome: true,
      cwds: ["/tmp/project", "/tmp/project/packages"],
    });
    const parsedEnvelope = CapabilityExternalAgentConfigDetectEnvelopeSchema.parse(
      readRouteBody(result),
    );
    expect(parsedEnvelope).toEqual({
      ok: true,
      items: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md from ~/.claude",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/project",
        },
      ],
    });
  });

  it("returns 400 when external-agent config import omits migrationItems", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/external-agent-config/import",
      url: new URL("http://localhost/api/external-agent-config/import"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing migrationItems query parameter.",
    });
  });

  it("imports external-agent config migration items through adapter ownership", async () => {
    const importExternalAgentConfigSpy = vi.fn(
      async (): Promise<AgentImportExternalAgentConfigResult> => ({}),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/external-agent-config/import",
      url: new URL(
        "http://localhost/api/external-agent-config/import?migrationItems=%5B%7B%22itemType%22%3A%22AGENTS_MD%22%2C%22description%22%3A%22Migrate%20AGENTS.md%22%2C%22cwd%22%3Anull%7D%2C%7B%22itemType%22%3A%22CONFIG%22%2C%22description%22%3A%22Import%20repository%20config%22%2C%22cwd%22%3A%22%2Ftmp%2Fproject%22%7D%5D",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canImportExternalAgentConfig: true,
          },
          importExternalAgentConfig: importExternalAgentConfigSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(importExternalAgentConfigSpy).toHaveBeenCalledWith({
      migrationItems: [
        {
          itemType: "AGENTS_MD",
          description: "Migrate AGENTS.md",
          cwd: null,
        },
        {
          itemType: "CONFIG",
          description: "Import repository config",
          cwd: "/tmp/project",
        },
      ],
    });
    const parsedEnvelope = CapabilityMutationSuccessEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
    });
  });

  it("returns 400 when thread realtime start omits prompt", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/threads/realtime/start",
      url: new URL("http://localhost/api/threads/realtime/start?threadId=thread-1"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing prompt query parameter.",
    });
  });

  it("starts thread realtime when adapter supports realtime start", async () => {
    const startThreadRealtimeSpy = vi.fn(async (): Promise<AgentStartThreadRealtimeResult> => ({}));
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/threads/realtime/start",
      url: new URL(
        "http://localhost/api/threads/realtime/start?threadId=thread-1&prompt=Summarize%20repository%20status&sessionId=session-1",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canStartThreadRealtime: true,
          },
          startThreadRealtime: startThreadRealtimeSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(startThreadRealtimeSpy).toHaveBeenCalledWith({
      threadId: "thread-1",
      prompt: "Summarize repository status",
      sessionId: "session-1",
    });
    const parsedEnvelope = CapabilityMutationSuccessEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
    });
  });

  it("appends thread realtime text when adapter supports realtime append", async () => {
    const appendThreadRealtimeTextSpy = vi.fn(
      async (): Promise<AgentAppendThreadRealtimeTextResult> => ({}),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/threads/realtime/append-text",
      url: new URL(
        "http://localhost/api/threads/realtime/append-text?threadId=thread-1&text=Continue%20with%20implementation%20details",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canAppendThreadRealtimeText: true,
          },
          appendThreadRealtimeText: appendThreadRealtimeTextSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(appendThreadRealtimeTextSpy).toHaveBeenCalledWith({
      threadId: "thread-1",
      text: "Continue with implementation details",
    });
    const parsedEnvelope = CapabilityMutationSuccessEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
    });
  });

  it("returns 400 when thread realtime append-audio omits required audio fields", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/threads/realtime/append-audio",
      url: new URL("http://localhost/api/threads/realtime/append-audio?threadId=thread-1"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Missing audioData query parameter.",
    });
  });

  it("appends thread realtime audio when adapter supports realtime audio append", async () => {
    const appendThreadRealtimeAudioSpy = vi.fn(
      async (): Promise<AgentAppendThreadRealtimeAudioResult> => ({}),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/threads/realtime/append-audio",
      url: new URL(
        "http://localhost/api/threads/realtime/append-audio?threadId=thread-1&audioData=base64chunk&audioSampleRate=16000&audioNumChannels=1&audioSamplesPerChannel=640",
      ),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canAppendThreadRealtimeAudio: true,
          },
          appendThreadRealtimeAudio: appendThreadRealtimeAudioSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(appendThreadRealtimeAudioSpy).toHaveBeenCalledWith({
      threadId: "thread-1",
      audio: {
        data: "base64chunk",
        sampleRate: 16000,
        numChannels: 1,
        samplesPerChannel: 640,
      },
    });
    const parsedEnvelope = CapabilityMutationSuccessEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
    });
  });

  it("stops thread realtime when adapter supports realtime stop", async () => {
    const stopThreadRealtimeSpy = vi.fn(async (): Promise<AgentStopThreadRealtimeResult> => ({}));
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/threads/realtime/stop",
      url: new URL("http://localhost/api/threads/realtime/stop?threadId=thread-1"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canStopThreadRealtime: true,
          },
          stopThreadRealtime: stopThreadRealtimeSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(stopThreadRealtimeSpy).toHaveBeenCalledWith({
      threadId: "thread-1",
    });
    const parsedEnvelope = CapabilityMutationSuccessEnvelopeSchema.parse(readRouteBody(result));
    expect(parsedEnvelope).toEqual({
      ok: true,
    });
  });

  it("returns 400 when windows sandbox setup mode is invalid", async () => {
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/windows-sandbox/setup-start",
      url: new URL("http://localhost/api/windows-sandbox/setup-start?mode=invalid"),
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(400);
    const parsedErrorResponse = FarfieldApiErrorResponseSchema.parse(readRouteBody(result));
    expect(parsedErrorResponse).toEqual({
      ok: false,
      error: "Invalid mode query parameter. Expected elevated or unelevated.",
    });
  });

  it("starts windows sandbox setup when adapter supports setup start", async () => {
    const startWindowsSandboxSetupSpy = vi.fn(
      async (): Promise<AgentStartWindowsSandboxSetupResult> => ({
        started: true,
      }),
    );
    const result = await executeCapabilityRoute({
      method: "POST",
      pathname: "/api/windows-sandbox/setup-start",
      url: new URL("http://localhost/api/windows-sandbox/setup-start?mode=elevated"),
      adapters: [
        createMockAgentAdapter({
          id: "codex",
          capabilities: {
            canStartWindowsSandboxSetup: true,
          },
          startWindowsSandboxSetup: startWindowsSandboxSetupSpy,
        }),
      ],
    });

    expect(result.handled).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(startWindowsSandboxSetupSpy).toHaveBeenCalledWith({
      mode: "elevated",
    });
    const parsedEnvelope = CapabilityWindowsSandboxSetupStartEnvelopeSchema.parse(
      readRouteBody(result),
    );
    expect(parsedEnvelope).toEqual({
      ok: true,
      started: true,
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
