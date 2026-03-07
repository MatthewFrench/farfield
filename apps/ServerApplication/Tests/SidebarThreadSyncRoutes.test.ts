import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { FarfieldSidebarThreadSyncResponseSchema, type JsonValue } from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import type {
  AgentAdapter,
  AgentId,
  AgentInterruptInput,
  AgentListLoadedThreadsResult,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
} from "../Source/Agents/Types.js";
import type { SidebarThreadSyncRouteDependencies } from "../Source/Network/Routes/SidebarThreadSyncRouteContracts.js";
import { handleSidebarThreadSyncRoutes } from "../Source/Network/Routes/SidebarThreadSyncRoutes.js";
import { SidebarThreadSyncSnapshotCache } from "../Source/Network/SidebarThreadSyncSnapshotCache.js";
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";

const SIDEBAR_THREAD_SYNC_TEST_ORIGIN = "http://localhost";

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
  agentId: AgentId,
  listThreads: (input: AgentListThreadsInput) => Promise<AgentListThreadsResult>,
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
    listThreads,
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("Not used in sidebar thread sync route test");
    },
    async sendMessage(_input: AgentSendMessageInput): Promise<void> {
      throw new Error("Not used in sidebar thread sync route test");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("Not used in sidebar thread sync route test");
    },
    ...(listLoadedThreads === undefined
      ? {}
      : {
          async listLoadedThreads(): Promise<AgentListLoadedThreadsResult> {
            return listLoadedThreads();
          },
        }),
  };
}

function createSidebarThreadSyncDependencies(input: {
  requestBody: JsonValue;
  listEnabledAdapters: () => AgentAdapter[];
  onJsonResponse: (statusCode: number, body: object) => void;
  threadListAggregationCache?: ThreadListAggregationCache;
  sidebarThreadSyncSnapshotCache?: SidebarThreadSyncSnapshotCache;
}): SidebarThreadSyncRouteDependencies {
  const { request, response } = createMockRequestResponsePair();
  request.method = "POST";

  return {
    req: request,
    res: response,
    pathname: "/api/sidebar/threads/sync",
    url: new URL("/api/sidebar/threads/sync", SIDEBAR_THREAD_SYNC_TEST_ORIGIN),
    threadListAggregationCache:
      input.threadListAggregationCache ?? new ThreadListAggregationCache(1_000, 8),
    sidebarThreadSyncSnapshotCache:
      input.sidebarThreadSyncSnapshotCache ?? new SidebarThreadSyncSnapshotCache(1_000, 8),
    listEnabledAdapters: input.listEnabledAdapters,
    registerThreadAdapterOwnership: () => {},
    listThreadsTimeoutMs: 7_500,
    normalizeOptionalString: (value) => {
      if (value === null) {
        return null;
      }
      const normalizedValue = value.trim();
      return normalizedValue.length > 0 ? normalizedValue : null;
    },
    readJsonBody: async () => input.requestBody,
    jsonResponse: (_response, statusCode, body) => {
      input.onJsonResponse(statusCode, body);
    },
    withTimeout: async (promise) => await promise,
  };
}

describe("handleSidebarThreadSyncRoutes", () => {
  it("returns a snapshot and then reuses the cached snapshot for notModified reads", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const listThreads = vi.fn(
      async (input: AgentListThreadsInput): Promise<AgentListThreadsResult> => ({
        data: [
          {
            id: "thread_1",
            preview: "hello world",
            createdAt: 1_735_600_000_000,
            updatedAt: 1_735_600_000_001,
            cwd: input.cwd ?? "/tmp/workspace",
          },
        ],
        nextCursor: null,
        pages: 1,
        truncated: false,
      }),
    );
    const adapter = createMockAgentAdapter(
      "codex",
      listThreads,
      async (): Promise<AgentListLoadedThreadsResult> => ({
        data: ["thread_1"],
      }),
    );
    const threadListAggregationCache = new ThreadListAggregationCache(1_000, 8);
    const sidebarThreadSyncSnapshotCache = new SidebarThreadSyncSnapshotCache(1_000, 8);

    const firstHandled = await handleSidebarThreadSyncRoutes(
      createSidebarThreadSyncDependencies({
        requestBody: {
          archived: false,
          limit: 20,
          maxPages: 2,
          sortKey: "updated_at",
          cwd: "/tmp/workspace",
          knownSnapshotVersion: null,
        },
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        threadListAggregationCache,
        sidebarThreadSyncSnapshotCache,
      }),
    );

    expect(firstHandled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    const firstResponse = FarfieldSidebarThreadSyncResponseSchema.parse(capturedBody);
    expect(firstResponse.syncStatus).toBe("snapshot");
    if (firstResponse.syncStatus !== "snapshot") {
      throw new Error("Expected snapshot sidebar sync response");
    }
    expect(firstResponse.threadList.sync?.snapshotVersion).toBe(firstResponse.snapshotVersion);
    expect(listThreads).toHaveBeenCalledTimes(1);

    capturedStatusCode = null;
    capturedBody = null;

    const secondHandled = await handleSidebarThreadSyncRoutes(
      createSidebarThreadSyncDependencies({
        requestBody: {
          archived: false,
          limit: 20,
          maxPages: 2,
          sortKey: "updated_at",
          cwd: "/tmp/workspace",
          knownSnapshotVersion: firstResponse.snapshotVersion,
        },
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        threadListAggregationCache,
        sidebarThreadSyncSnapshotCache,
      }),
    );

    expect(secondHandled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(FarfieldSidebarThreadSyncResponseSchema.parse(capturedBody)).toEqual({
      ok: true,
      syncStatus: "notModified",
      snapshotUpdatedAt: firstResponse.snapshotUpdatedAt,
      snapshotVersion: firstResponse.snapshotVersion,
    });
    expect(listThreads).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when the sidebar sync request body is invalid", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const handled = await handleSidebarThreadSyncRoutes(
      createSidebarThreadSyncDependencies({
        requestBody: {
          archived: false,
          limit: 0,
          maxPages: 2,
          sortKey: "updated_at",
          knownSnapshotVersion: null,
        },
        listEnabledAdapters: () => [],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(400);
    expect(capturedBody).toMatchObject({
      ok: false,
      error: "Invalid sidebar thread sync request",
    });
  });

  it("does not leak loaded threads that are missing from active list results", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;
    const adapter = createMockAgentAdapter(
      "codex",
      async (): Promise<AgentListThreadsResult> => ({
        data: [
          {
            id: "thread_active",
            preview: "active",
            createdAt: 1_735_600_000_000,
            updatedAt: 1_735_600_000_001,
          },
        ],
        nextCursor: null,
      }),
      async (): Promise<AgentListLoadedThreadsResult> => ({
        data: ["thread_active", "thread_archived_loaded_only"],
        nextCursor: null,
      }),
    );

    const handled = await handleSidebarThreadSyncRoutes(
      createSidebarThreadSyncDependencies({
        requestBody: {
          archived: false,
          limit: 20,
          maxPages: 2,
          sortKey: "updated_at",
          cwd: null,
          knownSnapshotVersion: null,
        },
        listEnabledAdapters: () => [adapter],
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
      }),
    );

    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    const response = FarfieldSidebarThreadSyncResponseSchema.parse(capturedBody);
    expect(response.syncStatus).toBe("snapshot");
    if (response.syncStatus !== "snapshot") {
      throw new Error("Expected snapshot sidebar sync response");
    }
    expect(response.threadList.data).toEqual([
      expect.objectContaining({
        id: "thread_active",
        isLoadedInMemory: true,
      }),
    ]);
  });
});
