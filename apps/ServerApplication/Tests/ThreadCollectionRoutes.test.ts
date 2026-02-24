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
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";
import {
  handleThreadCollectionRoutes,
  type ThreadCollectionRouteDependencies
} from "../Source/Network/Routes/ThreadCollectionRoutes.js";

function createMockRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response
  };
}

function createMockAgentAdapter(
  agentId: "codex" | "opencode",
  listThreads: (input: AgentListThreadsInput) => Promise<AgentListThreadsResult>
): AgentAdapter {
  return {
    id: agentId,
    label: agentId === "codex" ? "Codex" : "OpenCode",
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
    listThreads,
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("Not used in thread collection route test");
    },
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("Not used in thread collection route test");
    },
    async sendMessage(_input: AgentSendMessageInput): Promise<void> {
      throw new Error("Not used in thread collection route test");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("Not used in thread collection route test");
    }
  };
}

function createCollectionRouteDependencies(input: {
  url: URL;
  listEnabledAdapters: () => AgentAdapter[];
  onJsonResponse: (statusCode: number, body: object) => void;
  withTimeout?: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string
  ) => Promise<ValueType>;
}): ThreadCollectionRouteDependencies {
  const { request, response } = createMockRequestResponsePair();
  request.method = "GET";

  return {
    req: request,
    res: response,
    pathname: "/api/threads",
    url: input.url,
    defaultWorkspace: "/tmp/workspace",
    threadListAggregationCache: new ThreadListAggregationCache(1_000, 4),
    listEnabledAdapters: input.listEnabledAdapters,
    registerThreadAdapterOwnership: () => {},
    parseInteger: () => {
      throw new Error("ThreadCollectionRoutes should use schema parsing for query integers");
    },
    parseBoolean: () => {
      throw new Error("ThreadCollectionRoutes should use schema parsing for query booleans");
    },
    normalizeOptionalString: (value) => {
      if (!value) {
        return null;
      }
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    },
    listThreadsTimeoutMs: 7_500,
    resolveCreateThreadAdapter: () => null,
    readJsonBody: async () => ({}),
    jsonResponse: (_res, statusCode, body) => {
      input.onJsonResponse(statusCode, body);
    },
    invalidateThreadListAggregationCache: () => {},
    pushActionEventWithRequestContext: () => {},
    pushActionErrorWithRequestContext: () => "action-error-id",
    withTimeout: input.withTimeout ?? (async (promise) => promise)
  };
}

describe("handleThreadCollectionRoutes", () => {
  it("returns 400 when limit exceeds the route maximum", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(async (): Promise<AgentListThreadsResult> => ({
      data: [],
      nextCursor: null
    }));
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: new URL("http://localhost/api/threads?limit=999"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        }
      })
    );

    expect(handled).toBe(true);
    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    expect(capturedBody).toMatchObject({
      ok: false,
      error: "Invalid thread list query parameters"
    });
  });

  it("returns 400 when boolean query parameters are invalid", async () => {
    let capturedStatusCode: number | null = null;
    const listThreads = vi.fn(async (): Promise<AgentListThreadsResult> => ({
      data: [],
      nextCursor: null
    }));
    const adapter = createMockAgentAdapter("codex", listThreads);

    await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: new URL("http://localhost/api/threads?archived=1"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode) => {
          capturedStatusCode = statusCode;
        }
      })
    );

    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
  });

  it("parses validated query parameters and forwards typed list input", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(async (): Promise<AgentListThreadsResult> => ({
      data: [
        {
          id: "thread_1",
          preview: "hello world",
          createdAt: 1_735_600_000_000,
          updatedAt: 1_735_600_000_001
        }
      ],
      nextCursor: null,
      pages: 1,
      truncated: false
    }));
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: new URL(
          "http://localhost/api/threads?limit=10&maxPages=2&archived=false&all=false&sortKey=created_at"
        ),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        }
      })
    );

    expect(handled).toBe(true);
    expect(listThreads).toHaveBeenCalledWith({
      limit: 10,
      archived: false,
      all: true,
      maxPages: 2,
      cursor: null,
      sortKey: "created_at",
      cwd: null
    });
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      pages: 1,
      truncated: false
    });
  });

  it("returns partial data when one adapter list call times out", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const fastAdapter = createMockAgentAdapter("codex", async (): Promise<AgentListThreadsResult> => ({
      data: [
        {
          id: "thread_fast",
          preview: "fast",
          createdAt: 1_735_600_000_000,
          updatedAt: 1_735_600_000_001
        }
      ],
      nextCursor: null,
      pages: 1,
      truncated: false
    }));
    const slowAdapter = createMockAgentAdapter("opencode", async (): Promise<AgentListThreadsResult> => {
      return new Promise<AgentListThreadsResult>(() => {
        // Intentionally unresolved to simulate a stalled adapter call.
      });
    });

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: new URL("http://localhost/api/threads?limit=10"),
        listEnabledAdapters: () => [fastAdapter, slowAdapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        withTimeout: async (promise, timeoutMs, label) => {
          let timeoutHandle: NodeJS.Timeout | null = null;
          const timeoutPromise = new Promise<never>((_resolve, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error(`${label} timed out after ${String(timeoutMs)}ms`));
            }, 1);
          });
          try {
            return await Promise.race([promise, timeoutPromise]);
          } finally {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
          }
        }
      })
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      data: [
        {
          id: "thread_fast",
          agentId: "codex"
        }
      ]
    });
  });
});
