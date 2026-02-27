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
  AgentListThreadsInput,
  AgentListThreadsResult,
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

function createMockRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
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
});
