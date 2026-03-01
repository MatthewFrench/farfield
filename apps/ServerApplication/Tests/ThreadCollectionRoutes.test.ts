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
  AgentListLoadedThreadsResult,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
} from "../Source/Agents/Types.js";
import {
  type ThreadCollectionRouteMethod,
  ThreadCollectionRouteMethodByName,
  ThreadCollectionRoutePathnameByName,
} from "../Source/Network/Routes/ThreadCollectionRouteContracts.js";
import {
  handleThreadCollectionRoutes,
  type ThreadCollectionRouteDependencies,
} from "../Source/Network/Routes/ThreadCollectionRoutes.js";
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";

type ResolveCreateThreadAdapter = (requestedAgentId: AgentId | undefined) => AgentAdapter | null;

const ThreadCollectionRouteTestOrigin = "http://localhost";

function buildThreadCollectionRouteUrl(queryString = ""): URL {
  return new URL(
    `${ThreadCollectionRoutePathnameByName.threads}${queryString}`,
    ThreadCollectionRouteTestOrigin,
  );
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

function createMockAgentAdapter(
  agentId: "codex" | "opencode",
  listThreads: (input: AgentListThreadsInput) => Promise<AgentListThreadsResult>,
  createThread?: (input: AgentCreateThreadInput) => Promise<AgentCreateThreadResult>,
  listLoadedThreads?: () => Promise<AgentListLoadedThreadsResult>,
): AgentAdapter {
  return {
    id: agentId,
    label: agentId === "codex" ? "Codex" : "OpenCode",
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
      canExecuteCommand: false,
      canStartAccountLogin: false,
      canCancelAccountLogin: false,
      canLogoutAccount: false,
      canReloadMcpServerConfig: false,
      canStartMcpServerOauthLogin: false,
      canWriteSkillsConfig: false,
      canSetCollaborationMode: false,
      canSubmitUserInput: false,
      canReadLiveState: false,
      canReadStreamEvents: false,
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
    },
    ...(listLoadedThreads !== undefined
      ? {
          async listLoadedThreads(): Promise<AgentListLoadedThreadsResult> {
            return listLoadedThreads();
          },
        }
      : {}),
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
    label: string,
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
    withTimeout: input.withTimeout ?? (async (promise) => promise),
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
          agentId: "codex",
        }),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(503);
    expect(capturedBody).toEqual({
      ok: false,
      error: "Requested agent codex is not enabled.",
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
          cwd: input.cwd,
        },
        cwd: input.cwd,
      }),
    );
    const adapter = createMockAgentAdapter(
      "codex",
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
      createThread,
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
        },
      }),
    );

    expect(handled).toBe(true);
    expect(createThread).toHaveBeenCalledWith({
      cwd: "/workspace/default",
    });
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      threadId: "thread_created",
      agentId: "codex",
    });
  });

  it("preserves explicit create-thread optional values including empty strings", async () => {
    const createThread = vi.fn(
      async (input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> => ({
        threadId: "thread_explicit_values",
        thread: {
          id: "thread_explicit_values",
          preview: "new thread",
          createdAt: 1_736_100_000_000,
          updatedAt: 1_736_100_000_001,
          cwd: input.cwd,
        },
        cwd: input.cwd,
      }),
    );
    const adapter = createMockAgentAdapter(
      "codex",
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
      createThread,
    );

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        method: ThreadCollectionRouteMethodByName.post,
        url: buildThreadCollectionRouteUrl(),
        defaultWorkspace: "/workspace/default",
        listEnabledAdapters: () => [adapter],
        resolveCreateThreadAdapter: () => adapter,
        readJsonBody: async () => ({
          cwd: "",
          model: "",
          modelProvider: "",
          personality: "",
          sandbox: "",
          approvalPolicy: "",
          ephemeral: false,
        }),
        onJsonResponse: () => {},
      }),
    );

    expect(handled).toBe(true);
    expect(createThread).toHaveBeenCalledWith({
      cwd: "",
      model: "",
      modelProvider: "",
      personality: "",
      sandbox: "",
      approvalPolicy: "",
      ephemeral: false,
    });
  });

  it("returns false when pathname does not match the collection route contract", async () => {
    let wasResponseWritten = false;
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        pathname: `${ThreadCollectionRoutePathnameByName.threads}/member`,
        url: buildThreadCollectionRouteUrl(),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: () => {
          wasResponseWritten = true;
        },
      }),
    );

    expect(handled).toBe(false);
    expect(wasResponseWritten).toBe(false);
    expect(listThreads).not.toHaveBeenCalled();
  });

  it("returns 400 when limit exceeds the route maximum", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?limit=999"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    expect(capturedBody).toMatchObject({
      ok: false,
      error: "Invalid thread list query parameters",
    });
  });

  it("returns 400 when boolean query parameters are invalid", async () => {
    let capturedStatusCode: number | null = null;
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?archived=1"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode) => {
          capturedStatusCode = statusCode;
        },
      }),
    );

    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
  });

  it("returns 400 when cursor payload cannot be decoded", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?cursor=invalid-cursor"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    expect(capturedBody).toMatchObject({
      ok: false,
      error: "Invalid cursor",
      issues: [
        {
          path: "cursor",
        },
      ],
    });
  });

  it("parses validated query parameters and forwards typed list input", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [
          {
            id: "thread_1",
            preview: "hello world",
            createdAt: 1_735_600_000_000,
            updatedAt: 1_735_600_000_001,
          },
        ],
        nextCursor: null,
        pages: 1,
        truncated: false,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl(
          "?limit=10&maxPages=2&archived=false&all=false&sortKey=created_at",
        ),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(listThreads).toHaveBeenCalledWith({
      limit: 10,
      archived: false,
      all: true,
      maxPages: 2,
      cursor: null,
      sortKey: "created_at",
      cwd: null,
    });
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      pages: 1,
      truncated: false,
    });
  });

  it("returns 400 when sinceUpdatedAt is provided with non-updated sort keys", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?sinceUpdatedAt=1700&sortKey=created_at"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(listThreads).not.toHaveBeenCalled();
    expect(capturedStatusCode).toBe(400);
    expect(capturedBody).toMatchObject({
      ok: false,
      error: "Invalid thread list query parameters",
      issues: [{ path: "sinceUpdatedAt" }],
    });
  });

  it("returns ordered thread identifiers and delta data when sinceUpdatedAt is provided", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [
          {
            id: "thread_3",
            preview: "third",
            createdAt: 3,
            updatedAt: 30,
          },
          {
            id: "thread_2",
            preview: "second",
            createdAt: 2,
            updatedAt: 20,
          },
          {
            id: "thread_1",
            preview: "first",
            createdAt: 1,
            updatedAt: 10,
          },
        ],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?sinceUpdatedAt=20&sortKey=updated_at&limit=10"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      data: [
        {
          id: "thread_3",
          updatedAt: 30,
        },
        {
          id: "thread_2",
          updatedAt: 20,
        },
      ],
      orderedThreadIds: ["thread_3", "thread_2", "thread_1"],
      sync: {
        mode: "delta",
        sinceUpdatedAt: 20,
        snapshotUpdatedAt: 30,
      },
    });
  });

  it("returns canonical threadName values in list payloads", async () => {
    let capturedBody: object | null = null;
    const firstThread = {
      id: "thread_with_name",
      preview: "preview should not win",
      threadName: "  Configure Caddy for Farfield site  ",
      createdAt: 1_735_600_000_000,
      updatedAt: 1_735_600_000_001,
    };
    const secondThread = {
      id: "thread_without_name",
      preview: "Can you help me set up a caddy reverse proxy...",
      createdAt: 1_735_600_000_002,
      updatedAt: 1_735_600_000_003,
    };
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [firstThread, secondThread],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?limit=10"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (_statusCode, body) => {
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedBody).toMatchObject({
      ok: true,
      data: [
        {
          id: "thread_without_name",
          threadName: "Can you help me set up a caddy reverse proxy...",
        },
        {
          id: "thread_with_name",
          threadName: "Configure Caddy for Farfield site",
        },
      ],
    });
  });

  it("uses updated_at as the default sort key when query sortKey is omitted", async () => {
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [],
        nextCursor: null,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?limit=10"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: () => {},
      }),
    );

    expect(listThreads).toHaveBeenCalledWith({
      limit: 10,
      archived: false,
      all: true,
      maxPages: 20,
      cursor: null,
      sortKey: "updated_at",
      cwd: null,
    });
  });

  it("uses decoded cursor offset to select the response page", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const encodedCursor = Buffer.from(
      JSON.stringify({
        version: 1,
        offset: 1,
      }),
      "utf8",
    ).toString("base64url");
    const listThreads = vi.fn(
      async (): Promise<AgentListThreadsResult> => ({
        data: [
          {
            id: "thread_3",
            preview: "third",
            createdAt: 3,
            updatedAt: 3,
          },
          {
            id: "thread_2",
            preview: "second",
            createdAt: 2,
            updatedAt: 2,
          },
          {
            id: "thread_1",
            preview: "first",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        nextCursor: null,
        pages: 3,
        truncated: false,
      }),
    );
    const adapter = createMockAgentAdapter("codex", listThreads);

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl(`?limit=1&cursor=${encodedCursor}`),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      data: [
        {
          id: "thread_2",
          agentId: "codex",
        },
      ],
      pages: 1,
    });
  });

  it("projects loaded-thread membership into list response rows when adapter supports loaded-list", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const adapter = createMockAgentAdapter(
      "codex",
      async (): Promise<AgentListThreadsResult> => ({
        data: [
          {
            id: "thread_loaded",
            preview: "loaded",
            createdAt: 1,
            updatedAt: 2,
          },
          {
            id: "thread_not_loaded",
            preview: "not loaded",
            createdAt: 3,
            updatedAt: 4,
          },
        ],
        nextCursor: null,
      }),
      undefined,
      async (): Promise<AgentListLoadedThreadsResult> => ({
        data: ["thread_loaded"],
        nextCursor: null,
      }),
    );

    const handled = await handleThreadCollectionRoutes(
      createCollectionRouteDependencies({
        url: buildThreadCollectionRouteUrl("?limit=10"),
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      data: [
        {
          id: "thread_not_loaded",
          isLoadedInMemory: false,
        },
        {
          id: "thread_loaded",
          isLoadedInMemory: true,
        },
      ],
    });
  });

  it("returns partial data when one adapter list call times out", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const fastAdapter = createMockAgentAdapter(
      "codex",
      async (): Promise<AgentListThreadsResult> => ({
        data: [
          {
            id: "thread_fast",
            preview: "fast",
            createdAt: 1_735_600_000_000,
            updatedAt: 1_735_600_000_001,
          },
        ],
        nextCursor: null,
        pages: 1,
        truncated: false,
      }),
    );
    const slowAdapter = createMockAgentAdapter(
      "opencode",
      async (): Promise<AgentListThreadsResult> => {
        return new Promise<AgentListThreadsResult>(() => {
          // Intentionally unresolved to simulate a stalled adapter call.
        });
      },
    );

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
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toMatchObject({
      ok: true,
      data: [
        {
          id: "thread_fast",
          agentId: "codex",
        },
      ],
    });
  });
});
