import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { parseThreadConversationState } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
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
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput
} from "../Source/Agents/Types.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import type { ThreadMemberRouteDependencies } from "../Source/Network/Routes/ThreadMemberRouteContracts.js";
import { handleThreadMemberRoutes } from "../Source/Network/Routes/ThreadMemberRoutes.js";

const defaultCapabilities: AgentCapabilities = {
  canListModels: false,
  canListCollaborationModes: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false
};

function createMockRequestResponsePair(): { request: IncomingMessage; response: ServerResponse } {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  const response = new ServerResponse(request);
  return {
    request,
    response
  };
}

function createAdapter(
  id: "codex" | "opencode",
  readThread: (input: AgentReadThreadInput) => Promise<AgentReadThreadResult>,
  sendMessage?: (input: AgentSendMessageInput) => Promise<void>
): AgentAdapter {
  return {
    id,
    label: id,
    capabilities: defaultCapabilities,
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
      return readThread(input);
    },
    async sendMessage(input: AgentSendMessageInput): Promise<void> {
      if (!sendMessage) {
        throw new Error("not used in this test");
      }
      await sendMessage(input);
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("not used in this test");
    }
  };
}

describe("ThreadMemberRoutes integration", () => {
  it("returns 409 when unregistered thread discovery matches multiple adapters", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const codexAdapter = createAdapter("codex", async (input) => {
      if (input.threadId !== "thread_ambiguous") {
        throw new Error("thread not found");
      }
      return {
        thread: parseThreadConversationState({
          id: input.threadId,
          turns: [],
          requests: []
        })
      };
    });
    const opencodeAdapter = createAdapter("opencode", async (input) => {
      if (input.threadId !== "thread_ambiguous") {
        throw new Error("thread not found");
      }
      return {
        thread: parseThreadConversationState({
          id: input.threadId,
          turns: [],
          requests: []
        })
      };
    });

    const threadAdapterResolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter, opencodeAdapter]),
      new ThreadIndex()
    );

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread_ambiguous"],
      url: new URL("http://localhost/api/threads/thread_ambiguous"),
      codexAdapter: null,
      parseInteger: (value, defaultValue) => {
        if (!value) {
          return defaultValue;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : defaultValue;
      },
      parseBoolean: (value, defaultValue) => {
        if (!value) {
          return defaultValue;
        }
        return value === "true";
      },
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: async (threadId) => threadAdapterResolver.resolveAdapterForThread(threadId),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id"
    };

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(409);
    expect(capturedResponseBody).toEqual({
      ok: false,
      error: (
        "Thread thread_ambiguous matched multiple connected enabled agents "
        + "(codex, opencode). Refresh thread list and retry."
      ),
      threadId: "thread_ambiguous"
    });
  });

  it("returns 200 when unregistered thread discovery resolves to one adapter", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "GET";

    const readThreadIncludeTurnsValues: boolean[] = [];
    const codexAdapter = createAdapter("codex", async (input) => {
      if (input.threadId !== "thread_single_owner") {
        throw new Error("thread not found");
      }
      readThreadIncludeTurnsValues.push(input.includeTurns);
      return {
        thread: parseThreadConversationState({
          id: input.threadId,
          turns: [],
          requests: []
        })
      };
    });
    const opencodeAdapter = createAdapter("opencode", async () => {
      throw new Error("thread not found");
    });

    const threadAdapterResolver = new ThreadAdapterResolver(
      new AgentRegistry([codexAdapter, opencodeAdapter]),
      new ThreadIndex()
    );

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread_single_owner"],
      url: new URL("http://localhost/api/threads/thread_single_owner"),
      codexAdapter: null,
      parseInteger: (value, defaultValue) => {
        if (!value) {
          return defaultValue;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : defaultValue;
      },
      parseBoolean: (value, defaultValue) => {
        if (!value) {
          return defaultValue;
        }
        return value === "true";
      },
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: async (threadId) => threadAdapterResolver.resolveAdapterForThread(threadId),
      readJsonBody: async () => ({}),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id"
    };

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(true);
    expect(capturedStatusCode).toBe(200);
    expect(capturedResponseBody).toMatchObject({
      ok: true,
      agentId: "codex",
      thread: {
        id: "thread_single_owner"
      }
    });
    expect(readThreadIncludeTurnsValues).toEqual([false, true]);
  });

  it("does not treat nested messages paths as send-message mutation endpoints", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const sentMessages: AgentSendMessageInput[] = [];
    const codexAdapter = createAdapter(
      "codex",
      async () => {
        throw new Error("not used in this test");
      },
      async (input) => {
        sentMessages.push(input);
      }
    );

    let capturedStatusCode: number | null = null;
    let capturedResponseBody: object | null = null;

    const dependencies: ThreadMemberRouteDependencies = {
      req: request,
      res: response,
      segments: ["api", "threads", "thread_nested_messages_path", "messages", "extra"],
      url: new URL("http://localhost/api/threads/thread_nested_messages_path/messages/extra"),
      codexAdapter: null,
      parseInteger: (value, defaultValue) => {
        if (!value) {
          return defaultValue;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : defaultValue;
      },
      parseBoolean: (value, defaultValue) => {
        if (!value) {
          return defaultValue;
        }
        return value === "true";
      },
      threadConcurrencyCoordinator: new ThreadConcurrencyCoordinator(),
      resolveAdapterForThread: async () => ({
        ok: true,
        adapter: codexAdapter,
        agentId: "codex"
      }),
      readJsonBody: async () => ({
        text: "hello"
      }),
      jsonResponse: (_res, statusCode, body) => {
        capturedStatusCode = statusCode;
        capturedResponseBody = body;
      },
      invalidateThreadListAggregationCache: () => {},
      pushActionEventWithRequestContext: () => {},
      pushActionErrorWithRequestContext: () => "action-error-id"
    };

    const handled = await handleThreadMemberRoutes(dependencies);
    expect(handled).toBe(false);
    expect(sentMessages).toEqual([]);
    expect(capturedStatusCode).toBeNull();
    expect(capturedResponseBody).toBeNull();
  });
});
