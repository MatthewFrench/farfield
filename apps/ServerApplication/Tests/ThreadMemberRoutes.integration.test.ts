import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import {
  FarfieldThreadLiveStateSnapshotSchema,
  parseThreadConversationState,
  ThreadConversationStateSchema
} from "@farfield/protocol";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentRegistry } from "../Source/Agents/Registry.js";
import { ThreadAdapterResolver } from "../Source/Agents/ThreadAdapterResolver.js";
import { ThreadIndex } from "../Source/Agents/ThreadIndex.js";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadStreamEventsInput,
  AgentThreadLiveState,
  AgentThreadStreamEvents,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput
} from "../Source/Agents/Types.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
  type ThreadMemberRouteDependencies
} from "../Source/Network/Routes/ThreadMemberRouteContracts.js";
import { handleThreadMemberRoutes } from "../Source/Network/Routes/ThreadMemberRoutes.js";
import { ServerRequestUtilityOwner } from "../Source/Network/ServerRequestUtilityOwner.js";

const LocalhostBaseUrl = "http://localhost";
const AmbiguousThreadIdentifier = "thread_ambiguous";
const SingleOwnerThreadIdentifier = "thread_single_owner";
const LiveStateThreadIdentifier = "thread_live_state";
const StreamEventsThreadIdentifier = "thread_stream_events";
const NestedMessagesPathThreadIdentifier = "thread_nested_messages_path";
const InvalidThreadIdentifierSegment = "%E0%A4%A";
const ActionErrorIdentifier = "action-error-id";
const MessageBodyText = "hello";
const NestedRouteTailSegment = "extra";

const defaultCapabilities: AgentCapabilities = {
  canListModels: false,
  canListCollaborationModes: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false
};

const liveStateReadCapabilities: AgentCapabilities = {
  ...defaultCapabilities,
  canReadLiveState: true
};

const streamEventsReadCapabilities: AgentCapabilities = {
  ...defaultCapabilities,
  canReadStreamEvents: true
};

const AmbiguousThreadResolutionResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1),
    threadId: z.string().min(1)
  })
  .strict();

const ReadThreadRouteResponseSchema = z
  .object({
    ok: z.literal(true),
    agentId: z.enum(["codex", "opencode"]),
    thread: ThreadConversationStateSchema
  })
  .strict();

const InvalidThreadIdentifierResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.literal("Invalid thread identifier")
  })
  .strict();

const StreamEventsQueryValidationErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.literal("Invalid stream event query parameters"),
    details: z.array(
      z
        .object({
          message: z.string().min(1)
        })
        .passthrough()
    )
  })
  .strict();

const requestUtilityOwner = new ServerRequestUtilityOwner();
const parseIntegerRequestQuery = requestUtilityOwner.parseInteger.bind(requestUtilityOwner);
const parseBooleanRequestQuery = requestUtilityOwner.parseBoolean.bind(requestUtilityOwner);

interface CapturedJsonResponse {
  statusCode: number | null;
  body: object | null;
}

function createCapturedJsonResponse(): CapturedJsonResponse {
  return {
    statusCode: null,
    body: null
  };
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

function createRouteSegments(threadIdentifier: string, ...tailSegments: string[]): string[] {
  return [
    ThreadMemberRouteSegmentByName.api,
    ThreadMemberRouteSegmentByName.threads,
    threadIdentifier,
    ...tailSegments
  ];
}

function createThreadRoutePath(threadIdentifier: string, ...tailSegments: string[]): string {
  const encodedThreadIdentifier = encodeURIComponent(threadIdentifier);
  const basePath = `/api/threads/${encodedThreadIdentifier}`;
  if (tailSegments.length === 0) {
    return basePath;
  }
  return `${basePath}/${tailSegments.join("/")}`;
}

function createThreadRouteUrl(threadIdentifier: string, ...tailSegments: string[]): URL {
  const routePath = createThreadRoutePath(threadIdentifier, ...tailSegments);
  return new URL(routePath, LocalhostBaseUrl);
}

function createThreadRouteUrlWithRawThreadIdentifierSegment(
  threadIdentifierSegment: string,
  ...tailSegments: string[]
): URL {
  const basePath = `/api/threads/${threadIdentifierSegment}`;
  if (tailSegments.length === 0) {
    return new URL(basePath, LocalhostBaseUrl);
  }
  return new URL(`${basePath}/${tailSegments.join("/")}`, LocalhostBaseUrl);
}

function createJsonResponseWriter(
  capturedResponse: CapturedJsonResponse
): ThreadMemberRouteDependencies["jsonResponse"] {
  return (_res, statusCode, body) => {
    capturedResponse.statusCode = statusCode;
    capturedResponse.body = body;
  };
}

function createThreadReadResult(threadIdentifier: string): AgentReadThreadResult {
  return {
    thread: parseThreadConversationState({
      id: threadIdentifier,
      turns: [],
      requests: []
    })
  };
}

function createThreadMemberRouteDependencies(
  request: IncomingMessage,
  response: ServerResponse,
  segments: string[],
  url: URL,
  resolveAdapterForThread: ThreadMemberRouteDependencies["resolveAdapterForThread"],
  readJsonBody: ThreadMemberRouteDependencies["readJsonBody"],
  capturedResponse: CapturedJsonResponse
): ThreadMemberRouteDependencies {
  return {
    req: request,
    res: response,
    segments,
    url,
    codexAdapter: null,
    parseInteger: parseIntegerRequestQuery,
    parseBoolean: parseBooleanRequestQuery,
    threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
    resolveAdapterForThread,
    readJsonBody,
    jsonResponse: createJsonResponseWriter(capturedResponse),
    invalidateThreadListAggregationCache: () => {},
    pushActionEventWithRequestContext: () => {},
    pushActionErrorWithRequestContext: () => ActionErrorIdentifier
  };
}

interface ThreadMemberRouteTestAdapterOptions {
  id: "codex" | "opencode";
  capabilities?: AgentCapabilities;
  readThread: (input: AgentReadThreadInput) => Promise<AgentReadThreadResult>;
  sendMessage?: (input: AgentSendMessageInput) => Promise<void>;
  readLiveState?: (threadId: string) => Promise<AgentThreadLiveState>;
  readStreamEvents?: (
    threadId: string,
    input: AgentReadStreamEventsInput
  ) => Promise<AgentThreadStreamEvents>;
}

function createAdapter(options: ThreadMemberRouteTestAdapterOptions): AgentAdapter {
  return {
    id: options.id,
    label: options.id,
    capabilities: options.capabilities ?? defaultCapabilities,
    async start(): Promise<void> {},
    async stop(): Promise<void> {},
    isEnabled(): boolean {
      return true;
    },
    isConnected(): boolean {
      return true;
    },
    async listThreads(_input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
      throw new Error("not used in this test");
    },
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("not used in this test");
    },
    async readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      return options.readThread(input);
    },
    async sendMessage(input: AgentSendMessageInput): Promise<void> {
      if (!options.sendMessage) {
        throw new Error("not used in this test");
      }
      await options.sendMessage(input);
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("not used in this test");
    },
    readLiveState: options.readLiveState,
    readStreamEvents: options.readStreamEvents
  };
}

describe("ThreadMemberRoutes integration", () => {
  it("matches only canonical thread-member subresource routes", () => {
    expect(
      isThreadMemberSubresourceRoute(
        createRouteSegments(SingleOwnerThreadIdentifier, ThreadMemberRouteSegmentByName.messages),
        ThreadMemberRouteSegmentByName.messages
      )
    ).toBe(true);
    expect(
      isThreadMemberSubresourceRoute(
        [
          "not-api",
          ThreadMemberRouteSegmentByName.threads,
          SingleOwnerThreadIdentifier,
          ThreadMemberRouteSegmentByName.messages
        ],
        ThreadMemberRouteSegmentByName.messages
      )
    ).toBe(false);
    expect(
      isThreadMemberSubresourceRoute(
        createRouteSegments("", ThreadMemberRouteSegmentByName.messages),
        ThreadMemberRouteSegmentByName.messages
      )
    ).toBe(false);
    expect(
      isThreadMemberSubresourceRoute(
        createRouteSegments(
          SingleOwnerThreadIdentifier,
          ThreadMemberRouteSegmentByName.messages,
          NestedRouteTailSegment
        ),
        ThreadMemberRouteSegmentByName.messages
      )
    ).toBe(false);
  });

  it("returns 409 when unregistered thread discovery matches multiple adapters", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = ThreadMemberRouteMethodByName.get;

    const codexAdapter = createAdapter({
      id: "codex",
      readThread: async (input) => {
        if (input.threadId !== AmbiguousThreadIdentifier) {
          throw new Error("thread not found");
        }
        return createThreadReadResult(input.threadId);
      }
    });
    const opencodeAdapter = createAdapter({
      id: "opencode",
      readThread: async (input) => {
        if (input.threadId !== AmbiguousThreadIdentifier) {
          throw new Error("thread not found");
        }
        return createThreadReadResult(input.threadId);
      }
    });

    const threadAdapterResolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter, opencodeAdapter]),
      new ThreadIndex()
    );

    const capturedResponse = createCapturedJsonResponse();
    const dependencies = createThreadMemberRouteDependencies(
      request,
      response,
      createRouteSegments(AmbiguousThreadIdentifier),
      createThreadRouteUrl(AmbiguousThreadIdentifier),
      async (threadId) => threadAdapterResolver.resolveAdapterForThread(threadId),
      async () => ({}),
      capturedResponse
    );

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(true);
    expect(capturedResponse.statusCode).toBe(409);
    const conflictResponse = AmbiguousThreadResolutionResponseSchema.parse(capturedResponse.body);
    expect(conflictResponse.threadId).toBe(AmbiguousThreadIdentifier);
    expect(conflictResponse.error).toContain(
      `Thread ${AmbiguousThreadIdentifier} matched multiple connected enabled agents`
    );
    expect(conflictResponse.error).toContain("(codex, opencode)");
    expect(conflictResponse.error).toContain("Refresh thread list and retry.");
  });

  it("returns 200 when unregistered thread discovery resolves to one adapter", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = ThreadMemberRouteMethodByName.get;

    const readThreadIncludeTurnsValues: boolean[] = [];
    const codexAdapter = createAdapter({
      id: "codex",
      readThread: async (input) => {
        if (input.threadId !== SingleOwnerThreadIdentifier) {
          throw new Error("thread not found");
        }
        readThreadIncludeTurnsValues.push(input.includeTurns);
        return createThreadReadResult(input.threadId);
      }
    });
    const opencodeAdapter = createAdapter({
      id: "opencode",
      readThread: async () => {
        throw new Error("thread not found");
      }
    });

    const threadAdapterResolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter, opencodeAdapter]),
      new ThreadIndex()
    );

    const capturedResponse = createCapturedJsonResponse();
    const dependencies = createThreadMemberRouteDependencies(
      request,
      response,
      createRouteSegments(SingleOwnerThreadIdentifier),
      createThreadRouteUrl(SingleOwnerThreadIdentifier),
      async (threadId) => threadAdapterResolver.resolveAdapterForThread(threadId),
      async () => ({}),
      capturedResponse
    );

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(true);
    expect(capturedResponse.statusCode).toBe(200);
    const readThreadResponse = ReadThreadRouteResponseSchema.parse(capturedResponse.body);
    expect(readThreadResponse.agentId).toBe("codex");
    expect(readThreadResponse.thread.id).toBe(SingleOwnerThreadIdentifier);
    expect(readThreadIncludeTurnsValues).toEqual([false, true]);
  });

  it("returns 400 and does not resolve adapter when thread identifier decoding fails", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = ThreadMemberRouteMethodByName.get;

    const resolveAdapterForThread = vi.fn<
      ThreadMemberRouteDependencies["resolveAdapterForThread"]
    >(async () => ({
      ok: false,
      status: 404,
      error: "not used in this test"
    }));

    const capturedResponse = createCapturedJsonResponse();
    const dependencies = createThreadMemberRouteDependencies(
      request,
      response,
      createRouteSegments(InvalidThreadIdentifierSegment),
      createThreadRouteUrlWithRawThreadIdentifierSegment(InvalidThreadIdentifierSegment),
      resolveAdapterForThread,
      async () => ({}),
      capturedResponse
    );

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(true);
    expect(resolveAdapterForThread).not.toHaveBeenCalled();
    expect(capturedResponse.statusCode).toBe(400);
    expect(InvalidThreadIdentifierResponseSchema.parse(capturedResponse.body)).toEqual({
      ok: false,
      error: "Invalid thread identifier"
    });
  });

  it("returns 200 for canonical live-state reads when adapter supports live-state", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = ThreadMemberRouteMethodByName.get;

    const readLiveState = vi.fn(async () => ({
      ownerClientId: "client-live-state",
      conversationState: null,
      liveStateError: null
    }));
    const codexAdapter = createAdapter({
      id: "codex",
      capabilities: liveStateReadCapabilities,
      readThread: async () => {
        throw new Error("not used in this test");
      },
      readLiveState
    });
    const resolveAdapterForThread = vi.fn<
      ThreadMemberRouteDependencies["resolveAdapterForThread"]
    >(async () => ({
      ok: true,
      adapter: codexAdapter,
      agentId: "codex"
    }));

    const capturedResponse = createCapturedJsonResponse();
    const dependencies = createThreadMemberRouteDependencies(
      request,
      response,
      createRouteSegments(LiveStateThreadIdentifier, ThreadMemberRouteSegmentByName.liveState),
      createThreadRouteUrl(LiveStateThreadIdentifier, ThreadMemberRouteSegmentByName.liveState),
      resolveAdapterForThread,
      async () => ({}),
      capturedResponse
    );

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(true);
    expect(resolveAdapterForThread).toHaveBeenCalledWith(LiveStateThreadIdentifier);
    expect(readLiveState).toHaveBeenCalledTimes(1);
    expect(readLiveState).toHaveBeenCalledWith(LiveStateThreadIdentifier);
    expect(capturedResponse.statusCode).toBe(200);
    expect(FarfieldThreadLiveStateSnapshotSchema.parse(capturedResponse.body)).toEqual({
      ok: true,
      threadId: LiveStateThreadIdentifier,
      ownerClientId: "client-live-state",
      conversationState: null,
      liveStateError: null
    });
  });

  it("returns 400 for canonical stream-events reads when query is invalid", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = ThreadMemberRouteMethodByName.get;

    const readStreamEvents = vi.fn(async () => ({
      ownerClientId: "client-stream-events",
      events: [],
      nextSequence: 0,
      firstAvailableSequence: 0,
      resetRequired: false
    }));
    const codexAdapter = createAdapter({
      id: "codex",
      capabilities: streamEventsReadCapabilities,
      readThread: async () => {
        throw new Error("not used in this test");
      },
      readStreamEvents
    });
    const resolveAdapterForThread = vi.fn<
      ThreadMemberRouteDependencies["resolveAdapterForThread"]
    >(async () => ({
      ok: true,
      adapter: codexAdapter,
      agentId: "codex"
    }));

    const streamEventsUrl = createThreadRouteUrl(
      StreamEventsThreadIdentifier,
      ThreadMemberRouteSegmentByName.streamEvents
    );
    streamEventsUrl.searchParams.set("sinceSequence", "-1");

    const capturedResponse = createCapturedJsonResponse();
    const dependencies = createThreadMemberRouteDependencies(
      request,
      response,
      createRouteSegments(StreamEventsThreadIdentifier, ThreadMemberRouteSegmentByName.streamEvents),
      streamEventsUrl,
      resolveAdapterForThread,
      async () => ({}),
      capturedResponse
    );

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(true);
    expect(readStreamEvents).not.toHaveBeenCalled();
    expect(capturedResponse.statusCode).toBe(400);
    const validationResponse = StreamEventsQueryValidationErrorResponseSchema.parse(
      capturedResponse.body
    );
    expect(validationResponse.details.length).toBeGreaterThan(0);
  });

  it("does not treat nested messages paths as send-message mutation endpoints", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = ThreadMemberRouteMethodByName.post;

    const sentMessages: AgentSendMessageInput[] = [];
    const codexAdapter = createAdapter({
      id: "codex",
      readThread: async () => {
        throw new Error("not used in this test");
      },
      sendMessage: async (input) => {
        sentMessages.push(input);
      }
    });
    const resolveAdapterForThread = vi.fn<
      ThreadMemberRouteDependencies["resolveAdapterForThread"]
    >(async () => ({
      ok: true,
      adapter: codexAdapter,
      agentId: "codex"
    }));

    const capturedResponse = createCapturedJsonResponse();
    const dependencies = createThreadMemberRouteDependencies(
      request,
      response,
      createRouteSegments(
        NestedMessagesPathThreadIdentifier,
        ThreadMemberRouteSegmentByName.messages,
        NestedRouteTailSegment
      ),
      createThreadRouteUrl(
        NestedMessagesPathThreadIdentifier,
        ThreadMemberRouteSegmentByName.messages,
        NestedRouteTailSegment
      ),
      resolveAdapterForThread,
      async () => ({
        text: MessageBodyText
      }),
      capturedResponse
    );

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(false);
    expect(resolveAdapterForThread).toHaveBeenCalledTimes(1);
    expect(resolveAdapterForThread).toHaveBeenCalledWith(NestedMessagesPathThreadIdentifier);
    expect(sentMessages).toEqual([]);
    expect(capturedResponse.statusCode).toBeNull();
    expect(capturedResponse.body).toBeNull();
  });
});
