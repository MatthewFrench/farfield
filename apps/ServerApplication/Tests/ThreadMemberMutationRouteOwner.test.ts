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
  AgentSendMessageInput,
  AgentSetCollaborationModeInput,
  AgentSetCollaborationModeResult,
  AgentSubmitUserInputInput,
  AgentSubmitUserInputResult
} from "../Source/Agents/Types.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";
import { ThreadMemberMutationRouteOwner } from "../Source/Network/Routes/ThreadMemberMutationRouteOwner.js";
import {
  ThreadMemberMutationActionByName,
  type ThreadMemberRouteDependencies,
  type ThreadMemberResolvedRouteContext
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

function createAgentAdapter(input: {
  sendMessage?: (value: AgentSendMessageInput) => Promise<void>;
}): AgentAdapter {
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
      throw new Error("Not used in mutation route-owner tests");
    },
    async createThread(_input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
      throw new Error("Not used in mutation route-owner tests");
    },
    async readThread(_input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
      throw new Error("Not used in mutation route-owner tests");
    },
    async sendMessage(inputValue: AgentSendMessageInput): Promise<void> {
      if (!input.sendMessage) {
        throw new Error("Not used in mutation route-owner tests");
      }
      await input.sendMessage(inputValue);
    },
    async setCollaborationMode(
      _input: AgentSetCollaborationModeInput
    ): Promise<AgentSetCollaborationModeResult> {
      throw new Error("Not used in mutation route-owner tests");
    },
    async submitUserInput(
      _input: AgentSubmitUserInputInput
    ): Promise<AgentSubmitUserInputResult> {
      throw new Error("Not used in mutation route-owner tests");
    },
    async interrupt(_input: AgentInterruptInput): Promise<void> {
      throw new Error("Not used in mutation route-owner tests");
    }
  };
}

function createDependencies(input: {
  request: IncomingMessage;
  response: ServerResponse;
  segments: string[];
  readJsonBody: ThreadMemberRouteDependencies["readJsonBody"];
  onJsonResponse: (statusCode: number, body: object) => void;
  pushActionEventWithRequestContext: ThreadMemberRouteDependencies["pushActionEventWithRequestContext"];
}): ThreadMemberRouteDependencies {
  return {
    req: input.request,
    res: input.response,
    segments: input.segments,
    url: new URL("http://localhost/api/threads/thread-1"),
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
      ok: false,
      status: 404,
      error: "Not used in mutation route-owner tests"
    }),
    readJsonBody: input.readJsonBody,
    jsonResponse: (_res, statusCode, body) => {
      input.onJsonResponse(statusCode, body);
    },
    invalidateThreadListAggregationCache: () => {},
    pushActionEventWithRequestContext: input.pushActionEventWithRequestContext,
    pushActionErrorWithRequestContext: () => "action-error-id"
  };
}

function createContext(adapter: AgentAdapter): ThreadMemberResolvedRouteContext {
  return {
    threadId: "thread-1",
    adapter,
    agentId: "codex"
  };
}

describe("ThreadMemberMutationRouteOwner", () => {
  it("handles send-message mutations with deterministic action and response mapping", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const sentMessages: AgentSendMessageInput[] = [];
    const adapter = createAgentAdapter({
      sendMessage: async (value) => {
        sentMessages.push(value);
      }
    });

    const actionEvents: Array<{
      action: string;
      stage: "attempt" | "success" | "error";
    }> = [];
    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "messages"],
        readJsonBody: async () => ({
          text: "hello"
        }),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        pushActionEventWithRequestContext: (action, stage) => {
          actionEvents.push({ action, stage });
        }
      }),
      context: createContext(adapter)
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(sentMessages).toEqual([
      {
        threadId: "thread-1",
        text: "hello"
      }
    ]);
    expect(actionEvents).toEqual([
      {
        action: ThreadMemberMutationActionByName.messages,
        stage: "attempt"
      },
      {
        action: ThreadMemberMutationActionByName.messages,
        stage: "success"
      }
    ]);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      threadId: "thread-1"
    });
  });

  it("returns false for unmatched thread-member mutation routes", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const adapter = createAgentAdapter({
      sendMessage: async () => {}
    });

    const jsonResponse = vi.fn<(statusCode: number, body: object) => void>();
    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "unsupported"],
        readJsonBody: async () => ({
          text: "hello"
        }),
        onJsonResponse: (statusCode, body) => {
          jsonResponse(statusCode, body);
        },
        pushActionEventWithRequestContext: () => {}
      }),
      context: createContext(adapter)
    });

    const handled = await owner.handle();

    expect(handled).toBe(false);
    expect(jsonResponse).not.toHaveBeenCalled();
  });

  it("throws for malformed send-message payloads before mutation execution", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const sendMessage = vi.fn<(value: AgentSendMessageInput) => Promise<void>>(async () => {});
    const adapter = createAgentAdapter({
      sendMessage
    });

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "messages"],
        readJsonBody: async () => ({
          text: ""
        }),
        onJsonResponse: () => {},
        pushActionEventWithRequestContext: () => {}
      }),
      context: createContext(adapter)
    });

    await expect(owner.handle()).rejects.toThrowError();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
