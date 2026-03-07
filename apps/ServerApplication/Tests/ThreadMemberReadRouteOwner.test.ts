import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { FarfieldThreadStreamEventsSnapshotSchema } from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  AgentAdapter,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
} from "../Source/Agents/Types.js";
import { ThreadMemberReadRouteOwner } from "../Source/Network/Routes/ThreadMemberReadRouteOwner.js";
import type {
  ThreadMemberResolvedRouteContext,
  ThreadMemberRouteDependencies,
} from "../Source/Network/Routes/ThreadMemberRouteContracts.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";

const ThreadMemberReadRouteValidationErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z.literal("Invalid stream event query parameters"),
    details: z.array(
      z
        .object({
          message: z.string().min(1),
        })
        .passthrough(),
    ),
  })
  .strict();

function readJsonResponseBody(responseBody: object | null): object {
  if (!responseBody) {
    throw new Error("Expected a JSON response body");
  }
  return responseBody;
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

function createUnsupportedAgentAdapter(): AgentAdapter {
  return {
    id: "codex",
    label: "Codex",
    capabilities: {
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
    },
    async start(): Promise<void> {},
    async stop(): Promise<void> {},
    isEnabled(): boolean {
      return true;
    },
    isConnected(): boolean {
      return true;
    },
    async listThreads(_input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
      throw new Error("Not used in route-owner test");
    },
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("Not used in route-owner test");
    },
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("Not used in route-owner test");
    },
    async sendMessage(_input: AgentSendMessageInput): Promise<void> {
      throw new Error("Not used in route-owner test");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("Not used in route-owner test");
    },
  };
}

describe("ThreadMemberReadRouteOwner", () => {
  it("parses stream-event cursor query and returns sequence metadata", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const readStreamEvents = vi.fn(async () => ({
      ownerClientId: "client-a",
      events: [],
      nextSequence: 23,
      firstAvailableSequence: 10,
      resetRequired: false,
    }));
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      capabilities: {
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
        canReadStreamEvents: true,

        canReadNotificationEvents: true,
      },
      readStreamEvents,
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const threadConcurrencyCoordinator = new ThreadConcurrencyCoordinator();
    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-1", "stream-events"],
      url: new URL("http://localhost/api/threads/thread-1/stream-events?limit=50&sinceSequence=14"),
      parseInteger: () => {
        throw new Error("Not used in stream-events route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator,
      resolveAdapterForThread: async () => ({
        ok: true,
        adapter,
        agentId: "codex",
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      recordThreadSendAccepted: () => {},
      scheduleThreadStreamDeltaPublish: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id",
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-1",
      adapter,
      agentId: "codex",
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context,
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(readStreamEvents).toHaveBeenCalledWith("thread-1", {
      limit: 50,
      sinceSequence: 14,
    });
    expect(capturedStatusCode).toBe(200);
    const parsedResponse = FarfieldThreadStreamEventsSnapshotSchema.parse(
      readJsonResponseBody(capturedResponseBody),
    );
    expect(parsedResponse).toEqual({
      ok: true,
      threadId: "thread-1",
      ownerClientId: "client-a",
      events: [],
      nextSequence: 23,
      firstAvailableSequence: 10,
      resetRequired: false,
    });
  });

  it("returns 400 for invalid stream-event cursor query values", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const readStreamEvents = vi.fn(async () => ({
      ownerClientId: "client-a",
      events: [],
      nextSequence: 0,
      firstAvailableSequence: 0,
      resetRequired: false,
    }));
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      capabilities: {
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
        canReadStreamEvents: true,

        canReadNotificationEvents: true,
      },
      readStreamEvents,
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const threadConcurrencyCoordinator = new ThreadConcurrencyCoordinator();
    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-1", "stream-events"],
      url: new URL("http://localhost/api/threads/thread-1/stream-events?sinceSequence=-1"),
      parseInteger: () => {
        throw new Error("Not used in stream-events route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator,
      resolveAdapterForThread: async () => ({
        ok: true,
        adapter,
        agentId: "codex",
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      recordThreadSendAccepted: () => {},
      scheduleThreadStreamDeltaPublish: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id",
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-1",
      adapter,
      agentId: "codex",
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context,
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(readStreamEvents).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    const parsedValidationErrorResponse = ThreadMemberReadRouteValidationErrorSchema.parse(
      readJsonResponseBody(capturedResponseBody),
    );
    expect(parsedValidationErrorResponse.details.length).toBeGreaterThan(0);
  });

  it("returns 400 when stream-event limit exceeds route maximum", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const readStreamEvents = vi.fn(async () => ({
      ownerClientId: "client-a",
      events: [],
      nextSequence: 0,
      firstAvailableSequence: 0,
      resetRequired: false,
    }));
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      capabilities: {
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
        canReadStreamEvents: true,

        canReadNotificationEvents: true,
      },
      readStreamEvents,
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-1", "stream-events"],
      url: new URL("http://localhost/api/threads/thread-1/stream-events?limit=999"),
      parseInteger: () => {
        throw new Error("Not used in stream-events route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: async () => ({
        ok: true,
        adapter,
        agentId: "codex",
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      recordThreadSendAccepted: () => {},
      scheduleThreadStreamDeltaPublish: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id",
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-1",
      adapter,
      agentId: "codex",
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context,
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(readStreamEvents).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    const parsedValidationErrorResponse = ThreadMemberReadRouteValidationErrorSchema.parse(
      readJsonResponseBody(capturedResponseBody),
    );
    expect(parsedValidationErrorResponse.details.length).toBeGreaterThan(0);
  });

  it("returns false for nested live-state paths to enforce canonical read routes", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const readLiveState = vi.fn(async () => ({
      ownerClientId: "client-a",
      conversationState: null,
      liveStateError: null,
    }));
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      capabilities: {
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
        canReadLiveState: true,
        canReadStreamEvents: false,

        canReadNotificationEvents: false,
      },
      readLiveState,
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-1", "live-state", "extra"],
      url: new URL("http://localhost/api/threads/thread-1/live-state/extra"),
      parseInteger: () => {
        throw new Error("Not used in live-state route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: async () => ({
        ok: true,
        adapter,
        agentId: "codex",
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      recordThreadSendAccepted: () => {},
      scheduleThreadStreamDeltaPublish: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id",
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-1",
      adapter,
      agentId: "codex",
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context,
    });
    const handled = await owner.handle();

    expect(handled).toBe(false);
    expect(readLiveState).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBeNull();
    expect(capturedResponseBody).toBeNull();
  });

  it("maps adapter-owned thread-not-loaded errors to a 404 thread response", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const threadNotLoadedError = new Error("thread-not-loaded");
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      async readThread(): Promise<AgentReadThreadResult> {
        throw threadNotLoadedError;
      },
      isThreadNotLoadedError: (error) => {
        return error === threadNotLoadedError;
      },
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-404"],
      url: new URL("http://localhost/api/threads/thread-404"),
      parseInteger: () => {
        throw new Error("Not used in thread-read route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: async () => ({
        ok: true,
        adapter,
        agentId: "codex",
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      recordThreadSendAccepted: () => {},
      scheduleThreadStreamDeltaPublish: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id",
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-404",
      adapter,
      agentId: "codex",
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context,
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(404);
    expect(capturedResponseBody).toEqual({
      ok: false,
      error: "Thread not loaded in app-server: thread-404",
      threadId: "thread-404",
    });
  });

  it("maps adapter-owned conversation-not-found errors to a 404 thread response", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const conversationNotFoundError = new Error("conversation-not-found");
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      async readThread(): Promise<AgentReadThreadResult> {
        throw conversationNotFoundError;
      },
      isConversationNotFoundError: (error) => {
        return error === conversationNotFoundError;
      },
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-404"],
      url: new URL("http://localhost/api/threads/thread-404"),
      parseInteger: () => {
        throw new Error("Not used in thread-read route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: async () => ({
        ok: true,
        adapter,
        agentId: "codex",
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      recordThreadSendAccepted: () => {},
      scheduleThreadStreamDeltaPublish: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id",
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-404",
      adapter,
      agentId: "codex",
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context,
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(404);
    expect(capturedResponseBody).toEqual({
      ok: false,
      error: "Thread not loaded in app-server: thread-404",
      threadId: "thread-404",
    });
  });
});
