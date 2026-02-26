import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { JsonValue } from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import type {
  AgentAdapter,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentId,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput
} from "../Source/Agents/Types.js";
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";
import {
  ThreadCollectionRouteMethodByName,
  ThreadCollectionRoutePathnameByName,
  type ThreadCollectionRouteMethod
} from "../Source/Network/Routes/ThreadCollectionRouteContracts.js";
import {
  handleThreadCollectionRoutes,
  type ThreadCollectionRouteDependencies
} from "../Source/Network/Routes/ThreadCollectionRoutes.js";

type ResolveCreateThreadAdapter = (
  requestedAgentId: AgentId | undefined
) => AgentAdapter | null;

const ThreadCollectionRouteTestOrigin = "http://localhost";

function buildThreadCollectionRouteUrl(queryString = ""): URL {
  return new URL(
    `${ThreadCollectionRoutePathnameByName.threads}${queryString}`,
    ThreadCollectionRouteTestOrigin
  );
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

function createMockAgentAdapter(
  agentId: "codex" | "opencode",
  listThreads: (input: AgentListThreadsInput) => Promise<AgentListThreadsResult>,
  createThread?: (input: AgentCreateThreadInput) => Promise<AgentCreateThreadResult>
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
    async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      if (!createThread) {
        throw new Error("Not used in thread collection route test");
      }
      return await createThread(input);
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
  method?: ThreadCollectionRouteMethod;
  pathname?: string;
  url: URL;
  defaultWorkspace?: string;
  listEnabledAdapters: () => AgentAdapter[];
  resolveCreateThreadAdapter?: ResolveCreateThreadAdapter;
  readJsonBody?: (req: IncomingMessage) => Promise<JsonValue>;
  onJsonResponse: (statusCode: number, body: object) => void;
  withTimeout?: <ValueType>(
    promise: Promise<ValueType>,
    timeoutMs: number,
    label: string
  ) => Promise<ValueType>;
}): ThreadCollectionRouteDependencies {
  const { request, response } = createMockRequestResponsePair();
  request.method = input.method ?? ThreadCollectionRouteMethodByName.get;

  return {
    req: request,
    res: response,
    pathname: input.pathname ?? ThreadCollectionRoutePathnameByName.threads,
    url: input.url,
    defaultWorkspace: input.defaultWorkspace ?? "/tmp/workspace",
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
    resolveCreateThreadAdapter: input.resolveCreateThreadAdapter ?? (() => null),
    readJsonBody: input.readJsonBody ?? (async () => ({})),
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
  it("returns 503 when a requested create-thread agent is not enabled", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        method: ThreadCollectionRouteMethodByName.post,
        url: buildThreadCollectionRouteUrl(),
        listEnabledAdapters: () => [],
        resolveCreateThreadAdapter: () => null,
        readJsonBody: async () => ({
          agentId: "codex"
        }),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        }
      })
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(503);
    expect(capturedBody).toEqual({
      ok: false,
      error: "Requested agent codex is not enabled."
    });
  });

  it("injects default workspace when creating a codex thread without cwd", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const createThread = vi.fn(
      async (input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> => ({
        threadId: "thread_created",
        thread: {
          id: "thread_created",
          preview: "new thread",
          createdAt: 1_736_100_000_000,
          updatedAt: 1_736_100_000_001,
          cwd: input.cwd
        },
        cwd: input.cwd
      })
    );
    const adapter = createMockAgentAdapter(
      "codex",
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null
      }),
      createThread
    );

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        method: ThreadCollectionRouteMethodByName.post,
        url: buildThreadCollectionRouteUrl(),
        defaultWorkspace: "/workspace/default",
        listEnabledAdapters: () => [adapter],
        resolveCreateThreadAdapter: () => adapter,
        readJsonBody: async () => ({}),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        }
      })
    );

    expect(handled).toBe(true);
    expect(createThread).toHaveBeenCalledWith({
      cwd: "/workspace/default"
    });
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      threadId: "thread_created",
      agentId: "codex"
    });
  });

  it("returns false when pathname does not match the collection route contract", async () => {
    let wasResponseWritten = false;
    const listThreads = vi.fn(async (): Promise<AgentListThreadsResult> => ({
      data: [],
      nextCursor: null
    }));
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        pathname: `${ThreadCollectionRoutePathnameByName.threads}/member`,
        url: buildThreadCollectionRouteUrl(),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: () => {
          wasResponseWritten = true;
        }
      })
    );

    expect(handled).toBe(false);
    expect(wasResponseWritten).toBe(false);
    expect(listThreads).not.toHaveBeenCalled();
  });

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
        url: buildThreadCollectionRouteUrl("?limit=999"),
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
        url: buildThreadCollectionRouteUrl("?archived=1"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode) => {
          capturedStatusCode = statusCode;
        }
      })
    );

    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
  });

  it("returns 400 when cursor payload cannot be decoded", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(async (): Promise<AgentListThreadsResult> => ({
      data: [],
      nextCursor: null
    }));
    const adapter = createMockAgentAdapter("codex", listThreads);

    await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?cursor=invalid-cursor"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        }
      })
    );

    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    expect(capturedBody).toMatchObject({
      ok: false,
      error: "Invalid cursor",
      issues: [
        {
          path: "cursor"
        }
      ]
    });
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
        url: buildThreadCollectionRouteUrl(
          "?limit=10&maxPages=2&archived=false&all=false&sortKey=created_at"
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

  it("uses updated_at as the default sort key when query sortKey is omitted", async () => {
    const listThreads = vi.fn(async (): Promise<AgentListThreadsResult> => ({
      data: [],
      nextCursor: null
    }));
    const adapter = createMockAgentAdapter("codex", listThreads);

    await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?limit=10"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: () => {}
      })
    );

    expect(listThreads).toHaveBeenCalledWith({
      limit: 10,
      archived: false,
      all: true,
      maxPages: 20,
      cursor: null,
      sortKey: "updated_at",
      cwd: null
    });
  });

  it("uses decoded cursor offset to select the response page", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const encodedCursor = Buffer.from(
      JSON.stringify({
        version: 1,
        offset: 1
      }),
      "utf8"
    ).toString("base64url");
    const listThreads = vi.fn(async (): Promise<AgentListThreadsResult> => ({
      data: [
        {
          id: "thread_3",
          preview: "third",
          createdAt: 3,
          updatedAt: 3
        },
        {
          id: "thread_2",
          preview: "second",
          createdAt: 2,
          updatedAt: 2
        },
        {
          id: "thread_1",
          preview: "first",
          createdAt: 1,
          updatedAt: 1
        }
      ],
      nextCursor: null,
      pages: 3,
      truncated: false
    }));
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl(`?limit=1&cursor=${encodedCursor}`),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        }
      })
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      data: [
        {
          id: "thread_2",
          agentId: "codex"
        }
      ],
      pages: 1
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
        url: buildThreadCollectionRouteUrl("?limit=10"),
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
