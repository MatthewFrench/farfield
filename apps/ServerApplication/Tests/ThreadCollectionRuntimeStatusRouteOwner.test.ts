import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { JsonValue, ThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import type {
  AgentAdapter,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentId,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentPendingServerRequests,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput,
  AgentThreadLiveState,
} from "../Source/Agents/Types.js";
import { CreatedThreadListProjectionOwner } from "../Source/Network/Routes/CreatedThreadListProjectionOwner.js";
import {
  type ThreadCollectionRouteDependencies,
  type ThreadCollectionRouteMethod,
  ThreadCollectionRouteMethodByName,
  ThreadCollectionRoutePathnameByName,
} from "../Source/Network/Routes/ThreadCollectionRouteContracts.js";
import { handleThreadCollectionRuntimeStatusRoute } from "../Source/Network/Routes/ThreadCollectionRuntimeStatusRouteOwner.js";
import { ThreadListAggregationCache } from "../Source/Network/ThreadListAggregationCache.js";

const ThreadCollectionRuntimeStatusRouteTestOrigin = "http://localhost";

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

function buildRouteUrl(queryString = ""): URL {
  return new URL(
    `${ThreadCollectionRoutePathnameByName.runtimeStatuses}${queryString}`,
    ThreadCollectionRuntimeStatusRouteTestOrigin,
  );
}

function createMockAgentAdapter(input: {
  id: AgentId;
  readLiveState?: (threadId: string) => Promise<AgentThreadLiveState>;
  readPendingServerRequests?: () => Promise<AgentPendingServerRequests>;
}): AgentAdapter {
  return {
    id: input.id,
    label: input.id === "codex" ? "Codex" : "OpenCode",
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
      canStartThreadRealtime: false,
      canAppendThreadRealtimeAudio: false,
      canAppendThreadRealtimeText: false,
      canStopThreadRealtime: false,
      canStartWindowsSandboxSetup: false,
      canSetCollaborationMode: false,
      canSubmitUserInput: input.readPendingServerRequests !== undefined,
      canReadLiveState: input.readLiveState !== undefined,
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
      return {
        data: [],
        nextCursor: null,
      };
    },
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("Not used in thread runtime status route tests.");
    },
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("Not used in thread runtime status route tests.");
    },
    async sendMessage(_input: AgentSendMessageInput): Promise<void> {
      throw new Error("Not used in thread runtime status route tests.");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("Not used in thread runtime status route tests.");
    },
    ...(input.readLiveState !== undefined
      ? {
          async readLiveState(threadId: string): Promise<AgentThreadLiveState> {
            return await input.readLiveState?.(threadId);
          },
        }
      : {}),
    ...(input.readPendingServerRequests !== undefined
      ? {
          async readPendingServerRequests(): Promise<AgentPendingServerRequests> {
            return await input.readPendingServerRequests?.();
          },
        }
      : {}),
  };
}

function createDependencies(input: {
  url: URL;
  adapters?: AgentAdapter[];
  method?: ThreadCollectionRouteMethod;
  pathname?: string;
  onJsonResponse: (statusCode: number, body: object) => void;
}): ThreadCollectionRouteDependencies {
  const { request, response } = createMockRequestResponsePair();
  request.method = input.method ?? ThreadCollectionRouteMethodByName.get;

  return {
    req: request,
    res: response,
    pathname: input.pathname ?? ThreadCollectionRoutePathnameByName.runtimeStatuses,
    url: input.url,
    defaultWorkspace: "/tmp/workspace",
    threadListAggregationCache: new ThreadListAggregationCache(1_000, 4),
    createdThreadListProjectionOwner: new CreatedThreadListProjectionOwner({
      timeToLiveMilliseconds: 60_000,
      maximumEntries: 16,
    }),
    listEnabledAdapters: () => input.adapters ?? [],
    registerThreadAdapterOwnership: () => {},
    shouldIncludeThreadInList: () => true,
    parseInteger: () => {
      throw new Error("Thread runtime status route uses schema-owned parsing.");
    },
    parseBoolean: () => {
      throw new Error("Thread runtime status route uses schema-owned parsing.");
    },
    normalizeOptionalString: (value) => value,
    listThreadsTimeoutMs: 7_500,
    resolveCreateThreadAdapter: () => null,
    readJsonBody: async () => ({}) satisfies JsonValue,
    jsonResponse: (_res, statusCode, body) => {
      input.onJsonResponse(statusCode, body);
    },
    invalidateThreadListAggregationCache: () => {},
    pushActionEventWithRequestContext: () => {},
    pushActionErrorWithRequestContext: () => "action-error-id",
    withTimeout: async (promise) => await promise,
  };
}

function createConversationStateWithLatestTurnStatus(
  status: "completed" | "inProgress" | "in_progress",
): ThreadConversationState {
  return {
    conversationId: "thread-live",
    title: "live thread",
    status: "active",
    turnCount: 1,
    createdAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-03-11T00:00:01.000Z").toISOString(),
    hasUnreadTurn: false,
    turns: [
      {
        id: "turn-1",
        role: "assistant",
        status,
        createdAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
        updatedAt: new Date("2026-03-11T00:00:01.000Z").toISOString(),
        items: [],
      },
    ],
  };
}

describe("handleThreadCollectionRuntimeStatusRoute", () => {
  it("returns 400 when runtime-status query parameters are invalid", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const handled = await handleThreadCollectionRuntimeStatusRoute(
      createDependencies({
        url: buildRouteUrl("?agentId=codex"),
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
      error: "Invalid thread runtime status query parameters",
    });
  });

  it("returns 503 when the selected agent cannot serve runtime status reads", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const handled = await handleThreadCollectionRuntimeStatusRoute(
      createDependencies({
        url: buildRouteUrl("?agentId=codex&threadId=thread-1"),
        adapters: [
          createMockAgentAdapter({
            id: "codex",
          }),
        ],
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
      error: "Thread runtime status reads are unavailable for the selected agent.",
    });
  });

  it("returns active statuses for requested threads using live state and pending server requests", async () => {
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const handled = await handleThreadCollectionRuntimeStatusRoute(
      createDependencies({
        url: buildRouteUrl(
          "?agentId=codex&threadId=thread-live&threadId=thread-approval&threadId=thread-idle",
        ),
        adapters: [
          createMockAgentAdapter({
            id: "codex",
            readLiveState: async (threadId) => {
              if (threadId === "thread-live") {
                return {
                  ownerClientId: "owner-client",
                  conversationState: createConversationStateWithLatestTurnStatus("inProgress"),
                  liveStateError: null,
                };
              }
              return {
                ownerClientId: "owner-client",
                conversationState: createConversationStateWithLatestTurnStatus("completed"),
                liveStateError: null,
              };
            },
            readPendingServerRequests: async () => ({
              requests: [
                {
                  requestId: 71,
                  method: "item/commandExecution/requestApproval",
                  params: {
                    threadId: "thread-approval",
                    turnId: "turn-approval",
                    itemId: "item-approval",
                    approvalId: null,
                    command: "bun test",
                  },
                  receivedAtMilliseconds: 1_700_000_000_250,
                },
              ],
            }),
          }),
        ],
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
      statuses: [
        {
          threadId: "thread-live",
          statusType: "active",
          activeFlags: [],
        },
        {
          threadId: "thread-approval",
          statusType: "active",
          activeFlags: ["waitingOnApproval"],
          receivedAtMilliseconds: 1_700_000_000_250,
        },
      ],
    });
  });
});
