import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";
import type {
  AgentAdapter,
  AgentCleanThreadBackgroundTerminalsInput,
  AgentCompactThreadInput,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentForkThreadInput,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentRollbackThreadInput,
  AgentSendMessageInput,
  AgentSetCollaborationModeInput,
  AgentSetCollaborationModeResult,
  AgentSetThreadNameInput,
  AgentStartThreadReviewInput,
  AgentStartThreadReviewResult,
  AgentSubmitUserInputInput,
  AgentSubmitUserInputResult,
} from "../Source/Agents/Types.js";
import { ThreadMemberMutationRouteOwner } from "../Source/Network/Routes/ThreadMemberMutationRouteOwner.js";
import {
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
} from "../Source/Network/Routes/ThreadMemberRouteContracts.js";
import { ThreadConcurrencyCoordinator } from "../Source/Network/ThreadConcurrencyCoordinator.js";

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

function createAgentAdapter(input: {
  sendMessage?: (value: AgentSendMessageInput) => Promise<void>;
  setCollaborationMode?: (
    value: AgentSetCollaborationModeInput,
  ) => Promise<AgentSetCollaborationModeResult>;
  submitUserInput?: (value: AgentSubmitUserInputInput) => Promise<AgentSubmitUserInputResult>;
  interrupt?: (value: AgentInterruptInput) => Promise<void>;
  forkThread?: (value: AgentForkThreadInput) => Promise<AgentCreateThreadResult>;
  setThreadName?: (value: AgentSetThreadNameInput) => Promise<void>;
  rollbackThread?: (value: AgentRollbackThreadInput) => Promise<AgentReadThreadResult>;
  compactThread?: (value: AgentCompactThreadInput) => Promise<void>;
  cleanThreadBackgroundTerminals?: (
    value: AgentCleanThreadBackgroundTerminalsInput,
  ) => Promise<void>;
  startThreadReview?: (value: AgentStartThreadReviewInput) => Promise<AgentStartThreadReviewResult>;
}): AgentAdapter {
  return {
    id: "codex",
    label: "Codex",
    capabilities: {
      canListModels: false,
      canListCollaborationModes: false,
      canSetCollaborationMode: input.setCollaborationMode !== undefined,
      canSubmitUserInput: input.submitUserInput !== undefined,
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
      inputValue: AgentSetCollaborationModeInput,
    ): Promise<AgentSetCollaborationModeResult> {
      if (!input.setCollaborationMode) {
        throw new Error("Not used in mutation route-owner tests");
      }
      return input.setCollaborationMode(inputValue);
    },
    async submitUserInput(
      inputValue: AgentSubmitUserInputInput,
    ): Promise<AgentSubmitUserInputResult> {
      if (!input.submitUserInput) {
        throw new Error("Not used in mutation route-owner tests");
      }
      return input.submitUserInput(inputValue);
    },
    async interrupt(inputValue: AgentInterruptInput): Promise<void> {
      if (!input.interrupt) {
        throw new Error("Not used in mutation route-owner tests");
      }
      await input.interrupt(inputValue);
    },
    async forkThread(inputValue: AgentForkThreadInput): Promise<AgentCreateThreadResult> {
      if (!input.forkThread) {
        throw new Error("Not used in mutation route-owner tests");
      }
      return input.forkThread(inputValue);
    },
    async setThreadName(inputValue: AgentSetThreadNameInput): Promise<void> {
      if (!input.setThreadName) {
        throw new Error("Not used in mutation route-owner tests");
      }
      await input.setThreadName(inputValue);
    },
    async rollbackThread(inputValue: AgentRollbackThreadInput): Promise<AgentReadThreadResult> {
      if (!input.rollbackThread) {
        throw new Error("Not used in mutation route-owner tests");
      }
      return input.rollbackThread(inputValue);
    },
    async compactThread(inputValue: AgentCompactThreadInput): Promise<void> {
      if (!input.compactThread) {
        throw new Error("Not used in mutation route-owner tests");
      }
      await input.compactThread(inputValue);
    },
    async cleanThreadBackgroundTerminals(
      inputValue: AgentCleanThreadBackgroundTerminalsInput,
    ): Promise<void> {
      if (!input.cleanThreadBackgroundTerminals) {
        throw new Error("Not used in mutation route-owner tests");
      }
      await input.cleanThreadBackgroundTerminals(inputValue);
    },
    async startThreadReview(
      inputValue: AgentStartThreadReviewInput,
    ): Promise<AgentStartThreadReviewResult> {
      if (!input.startThreadReview) {
        throw new Error("Not used in mutation route-owner tests");
      }
      return input.startThreadReview(inputValue);
    },
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
      error: "Not used in mutation route-owner tests",
    }),
    readJsonBody: input.readJsonBody,
    jsonResponse: (_res, statusCode, body) => {
      input.onJsonResponse(statusCode, body);
    },
    invalidateThreadListAggregationCache: () => {},
    pushActionEventWithRequestContext: input.pushActionEventWithRequestContext,
    pushActionErrorWithRequestContext: () => "action-error-id",
  };
}

function createContext(adapter: AgentAdapter): ThreadMemberResolvedRouteContext {
  return {
    threadId: "thread-1",
    adapter,
    agentId: "codex",
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
      },
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
          text: "hello",
        }),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        pushActionEventWithRequestContext: (action, stage) => {
          actionEvents.push({ action, stage });
        },
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(sentMessages).toEqual([
      {
        threadId: "thread-1",
        text: "hello",
      },
    ]);
    expect(actionEvents).toEqual([
      {
        action: ThreadMemberMutationActionByName.messages,
        stage: "attempt",
      },
      {
        action: ThreadMemberMutationActionByName.messages,
        stage: "success",
      },
    ]);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      threadId: "thread-1",
    });
  });

  it("forwards explicit empty-string ownerClientId, cwd, and steering flag for send-message mutations", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const sentMessages: AgentSendMessageInput[] = [];
    const adapter = createAgentAdapter({
      sendMessage: async (value) => {
        sentMessages.push(value);
      },
    });

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "messages"],
        readJsonBody: async () => ({
          text: "hello",
          ownerClientId: "",
          cwd: "",
          isSteering: true,
        }),
        onJsonResponse: () => {},
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(sentMessages).toEqual([
      {
        threadId: "thread-1",
        text: "hello",
        ownerClientId: "",
        cwd: "",
        isSteering: true,
      },
    ]);
  });

  it("forwards explicit empty-string ownerClientId for collaboration-mode mutations", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const setCollaborationModeCalls: AgentSetCollaborationModeInput[] = [];
    const adapter = createAgentAdapter({
      setCollaborationMode: async (value) => {
        setCollaborationModeCalls.push(value);
        return {
          ownerClientId: "",
        };
      },
    });

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "collaboration-mode"],
        readJsonBody: async () => ({
          ownerClientId: "",
          collaborationMode: {
            mode: "default",
            settings: {},
          },
        }),
        onJsonResponse: () => {},
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(setCollaborationModeCalls).toEqual([
      {
        threadId: "thread-1",
        ownerClientId: "",
        collaborationMode: {
          mode: "default",
          settings: {},
        },
      },
    ]);
  });

  it("forwards explicit empty-string ownerClientId for submit-user-input mutations", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const submitUserInputCalls: AgentSubmitUserInputInput[] = [];
    const adapter = createAgentAdapter({
      submitUserInput: async (value) => {
        submitUserInputCalls.push(value);
        return {
          ownerClientId: "",
          requestId: value.requestId,
        };
      },
    });

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "user-input"],
        readJsonBody: async () => ({
          ownerClientId: "",
          requestId: 13,
          response: {
            method: "item/tool/requestUserInput",
            payload: {
              answers: {
                question_1: {
                  answers: ["answer"],
                },
              },
            },
          },
        }),
        onJsonResponse: () => {},
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(submitUserInputCalls).toEqual([
      {
        threadId: "thread-1",
        ownerClientId: "",
        requestId: 13,
        response: {
          method: "item/tool/requestUserInput",
          payload: {
            answers: {
              question_1: {
                answers: ["answer"],
              },
            },
          },
        },
      },
    ]);
  });

  it("forwards explicit empty-string ownerClientId for interrupt mutations", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const interruptCalls: AgentInterruptInput[] = [];
    const adapter = createAgentAdapter({
      interrupt: async (value) => {
        interruptCalls.push(value);
      },
    });

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "interrupt"],
        readJsonBody: async () => ({
          ownerClientId: "",
        }),
        onJsonResponse: () => {},
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(interruptCalls).toEqual([
      {
        threadId: "thread-1",
        ownerClientId: "",
      },
    ]);
  });

  it("handles thread-fork mutations and returns the forked thread identifier", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const forkCalls: AgentForkThreadInput[] = [];
    const adapter = createAgentAdapter({
      forkThread: async (value) => {
        forkCalls.push(value);
        return {
          threadId: "thread-2",
          thread: {
            id: "thread-2",
            preview: "Forked",
            createdAt: 1,
            updatedAt: 2,
            source: "opencode",
          },
        };
      },
    });

    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "fork"],
        readJsonBody: async () => ({}),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(forkCalls).toEqual([
      {
        threadId: "thread-1",
      },
    ]);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      threadId: "thread-2",
      sourceThreadId: "thread-1",
    });
  });

  it("handles thread-name mutations and forwards normalized name payload", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const setThreadNameCalls: AgentSetThreadNameInput[] = [];
    const adapter = createAgentAdapter({
      setThreadName: async (value) => {
        setThreadNameCalls.push(value);
      },
    });

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "name"],
        readJsonBody: async () => ({
          name: "  Better title  ",
        }),
        onJsonResponse: () => {},
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(setThreadNameCalls).toEqual([
      {
        threadId: "thread-1",
        name: "Better title",
      },
    ]);
  });

  it("handles thread-rollback mutations and forwards turn-count payload", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const rollbackCalls: AgentRollbackThreadInput[] = [];
    const adapter = createAgentAdapter({
      rollbackThread: async (value) => {
        rollbackCalls.push(value);
        return {
          thread: {
            id: "thread-1",
            turns: [],
            requests: [],
          },
        };
      },
    });

    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "rollback"],
        readJsonBody: async () => ({
          numTurns: 2,
        }),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(rollbackCalls).toEqual([
      {
        threadId: "thread-1",
        numTurns: 2,
      },
    ]);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      threadId: "thread-1",
    });
  });

  it("handles thread-compaction mutations with canonical payload mapping", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const compactCalls: AgentCompactThreadInput[] = [];
    const adapter = createAgentAdapter({
      compactThread: async (value) => {
        compactCalls.push(value);
      },
    });

    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "compact"],
        readJsonBody: async () => ({}),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(compactCalls).toEqual([
      {
        threadId: "thread-1",
      },
    ]);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      threadId: "thread-1",
    });
  });

  it("handles background-terminal cleanup mutations with canonical payload mapping", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const cleanCalls: AgentCleanThreadBackgroundTerminalsInput[] = [];
    const adapter = createAgentAdapter({
      cleanThreadBackgroundTerminals: async (value) => {
        cleanCalls.push(value);
      },
    });

    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "background-terminals-clean"],
        readJsonBody: async () => ({}),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(cleanCalls).toEqual([
      {
        threadId: "thread-1",
      },
    ]);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      threadId: "thread-1",
    });
  });

  it("handles thread-review mutations and returns review identifiers", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const reviewCalls: AgentStartThreadReviewInput[] = [];
    const adapter = createAgentAdapter({
      startThreadReview: async (value) => {
        reviewCalls.push(value);
        return {
          reviewThreadId: "thread-review-1",
          turnId: "turn-review-1",
        };
      },
    });

    let capturedStatusCode: number | null = null;
    let capturedBody: object | null = null;

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "review"],
        readJsonBody: async () => ({
          target: {
            type: "baseBranch",
            branch: "main",
          },
          delivery: "detached",
        }),
        onJsonResponse: (statusCode, body) => {
          capturedStatusCode = statusCode;
          capturedBody = body;
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(true);
    expect(reviewCalls).toEqual([
      {
        threadId: "thread-1",
        target: {
          type: "baseBranch",
          branch: "main",
        },
        delivery: "detached",
      },
    ]);
    expect(capturedStatusCode).toBe(200);
    expect(capturedBody).toEqual({
      ok: true,
      threadId: "thread-1",
      reviewThreadId: "thread-review-1",
      reviewTurnId: "turn-review-1",
    });
  });

  it("returns false for unmatched thread-member mutation routes", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const adapter = createAgentAdapter({
      sendMessage: async () => {},
    });

    const jsonResponse = vi.fn<(statusCode: number, body: object) => void>();
    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "unsupported"],
        readJsonBody: async () => ({
          text: "hello",
        }),
        onJsonResponse: (statusCode, body) => {
          jsonResponse(statusCode, body);
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(false);
    expect(jsonResponse).not.toHaveBeenCalled();
  });

  it("returns false for nested archive paths to enforce canonical mutation routes", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const adapter = createAgentAdapter({
      sendMessage: async () => {},
    });

    const jsonResponse = vi.fn<(statusCode: number, body: object) => void>();
    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "archive", "extra"],
        readJsonBody: async () => ({}),
        onJsonResponse: (statusCode, body) => {
          jsonResponse(statusCode, body);
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    const handled = await owner.handle();

    expect(handled).toBe(false);
    expect(jsonResponse).not.toHaveBeenCalled();
  });

  it("returns false for nested interrupt paths to enforce canonical mutation routes", async () => {
    const { request, response } = createMockRequestResponsePair();
    request.method = "POST";

    const adapter = createAgentAdapter({
      sendMessage: async () => {},
    });

    const jsonResponse = vi.fn<(statusCode: number, body: object) => void>();
    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "interrupt", "extra"],
        readJsonBody: async () => ({
          ownerClientId: "client-1",
        }),
        onJsonResponse: (statusCode, body) => {
          jsonResponse(statusCode, body);
        },
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
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
      sendMessage,
    });

    const owner = new ThreadMemberMutationRouteOwner({
      dependencies: createDependencies({
        request,
        response,
        segments: ["api", "threads", "thread-1", "messages"],
        readJsonBody: async () => ({
          text: "",
        }),
        onJsonResponse: () => {},
        pushActionEventWithRequestContext: () => {},
      }),
      context: createContext(adapter),
    });

    await expect(owner.handle()).rejects.toThrowError();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
