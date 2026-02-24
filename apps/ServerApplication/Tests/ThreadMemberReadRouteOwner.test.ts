import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";
import type {
  AgentAdapter,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput
} from "../Source/Agents/Types.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import { ThreadMemberReadRouteOwner } from "../Source/Network/Routes/ThreadMemberReadRouteOwner.js";
import type {
  ThreadMemberRouteDependencies,
  ThreadMemberResolvedRouteContext
} from "../Source/Network/Routes/ThreadMemberRouteContracts.js";

function createMockRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response
  };
}

function createUnsupportedAgentAdapter(): AgentAdapter {
  return {
    id: "codex",
    label: "Codex",
    capabilities: {
      canListModels: false,
      canListCollaborationModes: false,
      canSetCollaborationMode: false,
      canSubmitUserInput: false,
      canReadLiveState: false,
      canReadStreamEvents: false
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
    }
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
      resetRequired: false
    }));
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      capabilities: {
        canListModels: false,
        canListCollaborationModes: false,
        canSetCollaborationMode: false,
        canSubmitUserInput: false,
        canReadLiveState: false,
        canReadStreamEvents: true
      },
      readStreamEvents
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const threadConcurrencyCoordinator = new ThreadConcurrencyCoordinator();
    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-1", "stream-events"],
      url: new URL("http://localhost/api/threads/thread-1/stream-events?limit=50&sinceSequence=14"),
      codexAdapter: null,
      parseInteger: () => {
        throw new Error("Not used in stream-events route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator,
      resolveAdapterForThread: () => ({
        ok: true,
        adapter,
        agentId: "codex"
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id"
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-1",
      adapter,
      agentId: "codex"
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(readStreamEvents).toHaveBeenCalledWith("thread-1", {
      limit: 50,
      sinceSequence: 14
    });
    expect(capturedStatusCode).toBe(200);
    expect(capturedResponseBody).toEqual({
      ok: true,
      threadId: "thread-1",
      ownerClientId: "client-a",
      events: [],
      nextSequence: 23,
      firstAvailableSequence: 10,
      resetRequired: false
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
      resetRequired: false
    }));
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      capabilities: {
        canListModels: false,
        canListCollaborationModes: false,
        canSetCollaborationMode: false,
        canSubmitUserInput: false,
        canReadLiveState: false,
        canReadStreamEvents: true
      },
      readStreamEvents
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const threadConcurrencyCoordinator = new ThreadConcurrencyCoordinator();
    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-1", "stream-events"],
      url: new URL("http://localhost/api/threads/thread-1/stream-events?sinceSequence=-1"),
      codexAdapter: null,
      parseInteger: () => {
        throw new Error("Not used in stream-events route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator,
      resolveAdapterForThread: () => ({
        ok: true,
        adapter,
        agentId: "codex"
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id"
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-1",
      adapter,
      agentId: "codex"
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(readStreamEvents).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    expect(capturedResponseBody).toMatchObject({
      ok: false,
      error: "Invalid stream event query parameters"
    });
  });

  it("returns 400 when stream-event limit exceeds route maximum", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const readStreamEvents = vi.fn(async () => ({
      ownerClientId: "client-a",
      events: [],
      nextSequence: 0,
      firstAvailableSequence: 0,
      resetRequired: false
    }));
    const adapter: AgentAdapter = {
      ...createUnsupportedAgentAdapter(),
      capabilities: {
        canListModels: false,
        canListCollaborationModes: false,
        canSetCollaborationMode: false,
        canSubmitUserInput: false,
        canReadLiveState: false,
        canReadStreamEvents: true
      },
      readStreamEvents
    };

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread-1", "stream-events"],
      url: new URL("http://localhost/api/threads/thread-1/stream-events?limit=999"),
      codexAdapter: null,
      parseInteger: () => {
        throw new Error("Not used in stream-events route-owner test");
      },
      parseBoolean: () => true,
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: () => ({
        ok: true,
        adapter,
        agentId: "codex"
      }),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id"
    };
    const context: ThreadMemberResolvedRouteContext = {
      threadId: "thread-1",
      adapter,
      agentId: "codex"
    };

    const owner = new ThreadMemberReadRouteOwner({
      dependencies,
      context
    });
    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(readStreamEvents).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    expect(capturedResponseBody).toMatchObject({
      ok: false,
      error: "Invalid stream event query parameters"
    });
  });
});
