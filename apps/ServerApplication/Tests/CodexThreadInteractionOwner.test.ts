import os from "node:os";
import path from "node:path";
import {
  AppServerClient,
  type AppServerTransport,
  type CodexMonitorIpcClient,
  CodexMonitorService,
  DesktopIpcClient,
  type InterruptInput,
  type SendRequestOptions,
  type SetModeInput,
  type SubmitUserInputInput,
} from "@farfield/api";
import type {
  IpcFrame,
  IpcRequestFrame,
  IpcResponseFrame,
  JsonValue,
  ThreadConversationRequestResponse,
} from "@farfield/protocol";
import { CommandExecutionApprovalRequestMethod, UserInputRequestMethod } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import type { CodexIpcFrameEvent } from "../Source/Agents/Adapters/CodexAgentAdapter.js";
import { CodexThreadInteractionOwner } from "../Source/Agents/Adapters/CodexThreadInteractionOwner.js";
import { CodexThreadStreamStateOwner } from "../Source/Agents/Adapters/CodexThreadStreamStateOwner.js";
import type {
  AgentPendingServerRequests,
  AgentReadStreamEventsInput,
  AgentThreadConversationState,
  AgentThreadLiveState,
  AgentThreadStreamEvents,
} from "../Source/Agents/Types.js";

const PREVIEW_REQUEST_IDENTIFIER = "monitor-preview-request-id";
const TEST_SOCKET_PATH = path.join(
  os.tmpdir(),
  `farfield-codex-thread-interaction-owner-${String(process.pid)}.sock`,
);
const STREAM_STATE_TEST_LOG_PATH = path.join(
  os.tmpdir(),
  `farfield-codex-thread-interaction-owner-stream-state-${String(process.pid)}.ndjson`,
);

const DEFAULT_IPC_RESPONSE_FRAME: IpcResponseFrame = {
  type: "response",
  requestId: "response-1",
  resultType: "success",
  result: {
    status: "ok",
  },
};

const DEFAULT_LIVE_STATE: AgentThreadLiveState = {
  ownerClientId: "owner-client-1",
  conversationState: null,
  liveStateError: null,
};

const DEFAULT_STREAM_EVENTS: AgentThreadStreamEvents = {
  ownerClientId: "owner-client-1",
  events: [],
  nextSequence: 0,
  firstAvailableSequence: 0,
  resetRequired: false,
};

interface OwnerClientIdResolutionCall {
  threadId: string;
  overrideOwnerClientId: string | null | undefined;
}

interface StreamEventsReadCall {
  threadId: string;
  input: AgentReadStreamEventsInput;
}

interface IpcCall {
  method: string;
  params: IpcRequestFrame["params"];
  options: SendRequestOptions;
}

interface AppServerRespondCall {
  requestId: number;
  response: ThreadConversationRequestResponse;
}

interface AppServerNotificationReadCall {
  limit: number;
  sinceSequence: number | null;
}

interface AppServerPendingServerRequestReadCall {
  requestedAtMilliseconds: number;
}

interface OwnerTestContext {
  owner: CodexThreadInteractionOwner;
  appClient: AppServerClient;
  appServerTransport: TestAppServerTransport;
  service: TestCodexMonitorService;
  ipcClient: TestDesktopIpcClient;
  threadStreamStateOwner: TestThreadStreamStateOwner;
  emittedFrames: CodexIpcFrameEvent[];
  readReadinessCounters: () => {
    codexAvailabilityChecks: number;
    ipcReadinessChecks: number;
  };
}

const NOOP_MONITOR_IPC_CLIENT: CodexMonitorIpcClient = {
  async sendRequestAndWait(): Promise<IpcResponseFrame> {
    return DEFAULT_IPC_RESPONSE_FRAME;
  },
};

class TestCodexMonitorService extends CodexMonitorService {
  public readonly interruptCalls: InterruptInput[] = [];
  public readonly setCollaborationModeCalls: SetModeInput[] = [];
  public readonly submitUserInputCalls: SubmitUserInputInput[] = [];

  public constructor() {
    super(NOOP_MONITOR_IPC_CLIENT);
  }

  public override async interrupt(input: InterruptInput): Promise<void> {
    this.interruptCalls.push(input);
  }

  public override async setCollaborationMode(input: SetModeInput): Promise<void> {
    this.setCollaborationModeCalls.push(input);
  }

  public override async submitUserInput(input: SubmitUserInputInput): Promise<void> {
    this.submitUserInputCalls.push(input);
  }
}

class TestDesktopIpcClient extends DesktopIpcClient {
  public readonly requestCalls: IpcCall[] = [];
  public readonly broadcastCalls: IpcCall[] = [];
  private readonly responseFrame: IpcResponseFrame;

  public constructor(responseFrame: IpcResponseFrame = DEFAULT_IPC_RESPONSE_FRAME) {
    super({
      socketPath: TEST_SOCKET_PATH,
    });
    this.responseFrame = responseFrame;
  }

  public override async sendRequestAndWait(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {},
  ): Promise<IpcResponseFrame> {
    this.requestCalls.push({
      method,
      params,
      options,
    });
    return this.responseFrame;
  }

  public override sendBroadcast(
    method: string,
    params: IpcRequestFrame["params"],
    options: SendRequestOptions = {},
  ): void {
    this.broadcastCalls.push({
      method,
      params,
      options,
    });
  }
}

class TestAppServerTransport implements AppServerTransport {
  public readonly requestCalls: Array<{ method: string; params: object; timeoutMs?: number }> = [];
  public readonly respondCalls: AppServerRespondCall[] = [];
  public readonly readNotificationEventsCalls: AppServerNotificationReadCall[] = [];
  public readonly readPendingServerRequestsCalls: AppServerPendingServerRequestReadCall[] = [];
  private readonly notificationEventsResult = {
    events: [],
    nextSequence: 0,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
  private pendingServerRequestsResult: AgentPendingServerRequests["requests"] = [];

  public async request(method: string, params: object, timeoutMs?: number): Promise<JsonValue> {
    this.requestCalls.push({
      method,
      params,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    });
    return {};
  }

  public async respond(
    requestId: number,
    response: ThreadConversationRequestResponse,
  ): Promise<void> {
    this.respondCalls.push({
      requestId,
      response,
    });
  }

  public readNotificationEvents(input: AppServerNotificationReadCall): {
    events: Array<{
      sequence: number;
      method: string;
      params: JsonValue | null;
      threadId: string | null;
      turnId: string | null;
      receivedAtMilliseconds: number;
    }>;
    nextSequence: number;
    firstAvailableSequence: number;
    resetRequired: boolean;
  } {
    this.readNotificationEventsCalls.push(input);
    return this.notificationEventsResult;
  }

  public setNotificationEventsResult(input: {
    events: Array<{
      sequence: number;
      method: string;
      params: JsonValue | null;
      threadId: string | null;
      turnId: string | null;
      receivedAtMilliseconds: number;
    }>;
    nextSequence: number;
    firstAvailableSequence: number;
    resetRequired: boolean;
  }): void {
    this.notificationEventsResult.events = input.events;
    this.notificationEventsResult.nextSequence = input.nextSequence;
    this.notificationEventsResult.firstAvailableSequence = input.firstAvailableSequence;
    this.notificationEventsResult.resetRequired = input.resetRequired;
  }

  public readPendingServerRequests(): Array<{
    requestId: number;
    method: string;
    params: JsonValue | null;
    receivedAtMilliseconds: number;
  }> {
    this.readPendingServerRequestsCalls.push({
      requestedAtMilliseconds: Date.now(),
    });
    return this.pendingServerRequestsResult;
  }

  public setPendingServerRequestsResult(requests: AgentPendingServerRequests["requests"]): void {
    this.pendingServerRequestsResult = requests;
  }

  public async close(): Promise<void> {}
}

class TestThreadStreamStateOwner extends CodexThreadStreamStateOwner {
  public readonly ownerClientIdResolutionCalls: OwnerClientIdResolutionCall[] = [];
  public readonly describedFrames: IpcFrame[] = [];
  public readonly readLiveStateCalls: string[] = [];
  public readonly readStreamEventsCalls: StreamEventsReadCall[] = [];
  public readonly projectedConversationStateReadCalls: string[] = [];
  private readonly resolvedOwnerClientId: string;
  private readonly describedThreadId: string | null;
  private readonly liveState: AgentThreadLiveState;
  private readonly streamEvents: AgentThreadStreamEvents;
  private readonly projectedConversationState: AgentThreadConversationState | null;

  public constructor(input?: {
    resolvedOwnerClientId?: string;
    describedThreadId?: string | null;
    liveState?: AgentThreadLiveState;
    streamEvents?: AgentThreadStreamEvents;
    projectedConversationState?: AgentThreadConversationState | null;
  }) {
    super({
      invalidStreamEventsLogPath: STREAM_STATE_TEST_LOG_PATH,
    });
    this.resolvedOwnerClientId = input?.resolvedOwnerClientId ?? "resolved-owner-client";
    this.describedThreadId = input?.describedThreadId ?? "described-thread-id";
    this.liveState = input?.liveState ?? DEFAULT_LIVE_STATE;
    this.streamEvents = input?.streamEvents ?? DEFAULT_STREAM_EVENTS;
    this.projectedConversationState = input?.projectedConversationState ?? null;
  }

  public override resolveRequiredOwnerClientId(
    threadId: string,
    overrideOwnerClientId: string | null | undefined,
  ): string {
    this.ownerClientIdResolutionCalls.push({
      threadId,
      overrideOwnerClientId,
    });
    return this.resolvedOwnerClientId;
  }

  public override describeFrame(frame: IpcFrame): {
    method: string;
    threadId: string | null;
  } {
    this.describedFrames.push(frame);
    switch (frame.type) {
      case "request":
      case "broadcast":
        return {
          method: frame.method,
          threadId: this.describedThreadId,
        };
      case "response":
      case "client-discovery-request":
      case "client-discovery-response":
        return {
          method: frame.type,
          threadId: this.describedThreadId,
        };
    }
  }

  public override readLiveState(threadId: string): AgentThreadLiveState {
    this.readLiveStateCalls.push(threadId);
    return this.liveState;
  }

  public override readStreamEvents(
    threadId: string,
    input: AgentReadStreamEventsInput,
  ): AgentThreadStreamEvents {
    this.readStreamEventsCalls.push({
      threadId,
      input,
    });
    return this.streamEvents;
  }

  public override getProjectedConversationState(
    threadId: string,
  ): AgentThreadLiveState["conversationState"] | null {
    this.projectedConversationStateReadCalls.push(threadId);
    return this.projectedConversationState;
  }
}

function createOwnerTestContext(input?: {
  describedThreadId?: string | null;
  resolvedOwnerClientId?: string;
  responseFrame?: IpcResponseFrame;
  liveState?: AgentThreadLiveState;
  streamEvents?: AgentThreadStreamEvents;
  projectedConversationState?: AgentThreadConversationState | null;
  ipcReady?: boolean;
}): OwnerTestContext {
  const appServerTransport = new TestAppServerTransport();
  const appClient = new AppServerClient(appServerTransport);
  const service = new TestCodexMonitorService();
  const ipcClient = new TestDesktopIpcClient(input?.responseFrame);
  const threadStreamStateOwner = new TestThreadStreamStateOwner({
    describedThreadId: input?.describedThreadId,
    resolvedOwnerClientId: input?.resolvedOwnerClientId,
    liveState: input?.liveState,
    streamEvents: input?.streamEvents,
    projectedConversationState: input?.projectedConversationState,
  });
  const emittedFrames: CodexIpcFrameEvent[] = [];
  let codexAvailabilityChecks = 0;
  let ipcReadinessChecks = 0;
  const ipcReady = input?.ipcReady ?? true;

  const owner = new CodexThreadInteractionOwner({
    appClient,
    service,
    ipcClient,
    threadStreamStateOwner,
    runAppServerCall: async <ValueType>(
      operation: () => Promise<ValueType>,
    ): Promise<ValueType> => {
      return operation();
    },
    ensureCodexAvailable: () => {
      codexAvailabilityChecks += 1;
    },
    ensureIpcReady: () => {
      ipcReadinessChecks += 1;
    },
    isIpcReady: () => {
      return ipcReady;
    },
    emitIpcFrame: (event) => {
      emittedFrames.push(event);
    },
  });

  return {
    owner,
    appClient,
    appServerTransport,
    service,
    ipcClient,
    threadStreamStateOwner,
    emittedFrames,
    readReadinessCounters: () => ({
      codexAvailabilityChecks,
      ipcReadinessChecks,
    }),
  };
}

describe("CodexThreadInteractionOwner", () => {
  it("delegates interrupt using the resolved owner client id after readiness checks", async () => {
    const context = createOwnerTestContext({
      resolvedOwnerClientId: "resolved-client-1",
    });

    await context.owner.interrupt({
      threadId: "thread-1",
      ownerClientId: "override-client",
    });

    expect(context.threadStreamStateOwner.ownerClientIdResolutionCalls).toEqual([
      {
        threadId: "thread-1",
        overrideOwnerClientId: "override-client",
      },
    ]);
    expect(context.service.interruptCalls).toEqual([
      {
        threadId: "thread-1",
        ownerClientId: "resolved-client-1",
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 1,
      ipcReadinessChecks: 1,
    });
  });

  it("interrupts through app-server transport when IPC is not ready", async () => {
    const projectedConversationState: AgentThreadConversationState = {
      id: "thread-1",
      turns: [
        {
          turnId: "turn-1",
          status: "inProgress",
          items: [],
        },
      ],
      requests: [],
    };
    const context = createOwnerTestContext({
      ipcReady: false,
      projectedConversationState,
    });

    await context.owner.interrupt({
      threadId: "thread-1",
      ownerClientId: "ignored-override-client",
    });

    expect(context.service.interruptCalls).toEqual([]);
    expect(context.threadStreamStateOwner.ownerClientIdResolutionCalls).toEqual([]);
    expect(context.threadStreamStateOwner.projectedConversationStateReadCalls).toEqual([
      "thread-1",
    ]);
    expect(context.appServerTransport.requestCalls).toEqual([
      {
        method: "turn/interrupt",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
        },
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 1,
      ipcReadinessChecks: 0,
    });
  });

  it("delegates collaboration-mode updates and returns resolved owner identity", async () => {
    const context = createOwnerTestContext({
      resolvedOwnerClientId: "resolved-client-2",
    });

    const result = await context.owner.setCollaborationMode({
      threadId: "thread-2",
      ownerClientId: "override-client",
      collaborationMode: {
        mode: "plan",
        settings: {
          model: "gpt-5",
          reasoning_effort: null,
          developer_instructions: null,
        },
      },
    });

    expect(result).toEqual({
      ownerClientId: "resolved-client-2",
    });
    expect(context.service.setCollaborationModeCalls).toEqual([
      {
        threadId: "thread-2",
        ownerClientId: "resolved-client-2",
        collaborationMode: {
          mode: "plan",
          settings: {
            model: "gpt-5",
            reasoning_effort: null,
            developer_instructions: null,
          },
        },
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 1,
      ipcReadinessChecks: 1,
    });
  });

  it("delegates user-input submission and returns the submitted request identity", async () => {
    const context = createOwnerTestContext({
      resolvedOwnerClientId: "resolved-client-3",
    });

    const result = await context.owner.submitUserInput({
      threadId: "thread-3",
      ownerClientId: "override-client",
      requestId: 42,
      response: {
        method: UserInputRequestMethod,
        payload: {
          answers: {
            questionOne: {
              answers: ["A"],
            },
          },
        },
      },
    });

    expect(result).toEqual({
      ownerClientId: "resolved-client-3",
      requestId: 42,
    });
    expect(context.service.submitUserInputCalls).toEqual([
      {
        threadId: "thread-3",
        ownerClientId: "resolved-client-3",
        requestId: 42,
        response: {
          answers: {
            questionOne: {
              answers: ["A"],
            },
          },
        },
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 1,
      ipcReadinessChecks: 1,
    });
  });

  it("submits user input through app-server transport when IPC is not ready", async () => {
    const context = createOwnerTestContext({
      ipcReady: false,
    });

    const result = await context.owner.submitUserInput({
      threadId: "thread-3",
      ownerClientId: "ignored-override-client",
      requestId: 77,
      response: {
        method: UserInputRequestMethod,
        payload: {
          answers: {
            questionOne: {
              answers: ["A"],
            },
          },
        },
      },
    });

    expect(result).toEqual({
      ownerClientId: "app-server",
      requestId: 77,
    });
    expect(context.service.submitUserInputCalls).toEqual([]);
    expect(context.appServerTransport.respondCalls).toEqual([
      {
        requestId: 77,
        response: {
          method: UserInputRequestMethod,
          payload: {
            answers: {
              questionOne: {
                answers: ["A"],
              },
            },
          },
        },
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 1,
      ipcReadinessChecks: 0,
    });
  });

  it("rejects non-user-input request responses on the IPC submit path", async () => {
    const context = createOwnerTestContext({
      ipcReady: true,
    });

    await expect(
      context.owner.submitUserInput({
        threadId: "thread-3",
        requestId: 91,
        response: {
          method: CommandExecutionApprovalRequestMethod,
          payload: {
            decision: "accept",
          },
        },
      }),
    ).rejects.toThrowError(
      `IPC submit-user-input only supports ${UserInputRequestMethod} responses.`,
    );

    expect(context.service.submitUserInputCalls).toEqual([]);
    expect(context.appServerTransport.respondCalls).toEqual([]);
  });

  it("forwards command-approval responses through app-server transport when IPC is not ready", async () => {
    const context = createOwnerTestContext({
      ipcReady: false,
    });

    const result = await context.owner.submitUserInput({
      threadId: "thread-3",
      requestId: 92,
      response: {
        method: CommandExecutionApprovalRequestMethod,
        payload: {
          decision: "acceptForSession",
        },
      },
    });

    expect(result).toEqual({
      ownerClientId: "app-server",
      requestId: 92,
    });
    expect(context.appServerTransport.respondCalls).toEqual([
      {
        requestId: 92,
        response: {
          method: CommandExecutionApprovalRequestMethod,
          payload: {
            decision: "acceptForSession",
          },
        },
      },
    ]);
  });

  it("delegates live-state and stream-event reads without readiness checks", async () => {
    const liveState: AgentThreadLiveState = {
      ownerClientId: "owner-live",
      conversationState: null,
      liveStateError: null,
    };
    const streamEvents: AgentThreadStreamEvents = {
      ownerClientId: "owner-live",
      events: [],
      nextSequence: 5,
      firstAvailableSequence: 1,
      resetRequired: false,
    };
    const context = createOwnerTestContext({
      liveState,
      streamEvents,
    });

    const resolvedLiveState = await context.owner.readLiveState("thread-live");
    const resolvedStreamEvents = await context.owner.readStreamEvents("thread-live", {
      limit: 50,
      sinceSequence: 2,
    });

    expect(resolvedLiveState).toBe(liveState);
    expect(resolvedStreamEvents).toBe(streamEvents);
    expect(context.threadStreamStateOwner.readLiveStateCalls).toEqual(["thread-live"]);
    expect(context.threadStreamStateOwner.readStreamEventsCalls).toEqual([
      {
        threadId: "thread-live",
        input: {
          limit: 50,
          sinceSequence: 2,
        },
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 0,
      ipcReadinessChecks: 0,
    });
  });

  it("reads app-server notification events without readiness checks", async () => {
    const context = createOwnerTestContext({
      ipcReady: true,
    });
    context.appServerTransport.setNotificationEventsResult({
      events: [
        {
          sequence: 14,
          method: "turn/completed",
          params: {
            threadId: "thread-live",
            status: "completed",
          },
          receivedAtMilliseconds: 500,
        },
      ],
      nextSequence: 15,
      firstAvailableSequence: 3,
      resetRequired: false,
    });

    const notificationEvents = await context.owner.readNotificationEvents({
      limit: 25,
      sinceSequence: 8,
    });

    expect(notificationEvents).toEqual({
      events: [
        {
          sequence: 14,
          method: "turn/completed",
          params: {
            threadId: "thread-live",
            status: "completed",
          },
          receivedAtMilliseconds: 500,
        },
      ],
      nextSequence: 15,
      firstAvailableSequence: 3,
      resetRequired: false,
    });
    expect(context.appServerTransport.readNotificationEventsCalls).toEqual([
      {
        limit: 25,
        sinceSequence: 8,
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 0,
      ipcReadinessChecks: 0,
    });
  });

  it("reads pending app-server requests without readiness checks", async () => {
    const context = createOwnerTestContext({
      ipcReady: false,
    });
    context.appServerTransport.setPendingServerRequestsResult([
      {
        requestId: 41,
        method: CommandExecutionApprovalRequestMethod,
        params: {
          command: ["git", "status"],
          cwd: "/tmp/project",
        },
        receivedAtMilliseconds: 1_700_000_001_200,
      },
      {
        requestId: 42,
        method: UserInputRequestMethod,
        params: {
          question: "Proceed with deployment?",
        },
        receivedAtMilliseconds: 1_700_000_001_500,
      },
    ]);

    const pendingServerRequests = await context.owner.readPendingServerRequests();

    expect(pendingServerRequests).toEqual({
      requests: [
        {
          requestId: 41,
          method: CommandExecutionApprovalRequestMethod,
          params: {
            command: ["git", "status"],
            cwd: "/tmp/project",
          },
          receivedAtMilliseconds: 1_700_000_001_200,
        },
        {
          requestId: 42,
          method: UserInputRequestMethod,
          params: {
            question: "Proceed with deployment?",
          },
          receivedAtMilliseconds: 1_700_000_001_500,
        },
      ],
    });
    expect(context.appServerTransport.readPendingServerRequestsCalls).toHaveLength(1);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 0,
      ipcReadinessChecks: 0,
    });
  });

  it("returns app-server notification stream events when IPC is not ready", async () => {
    const context = createOwnerTestContext({
      ipcReady: false,
    });
    context.appServerTransport.setNotificationEventsResult({
      events: [
        {
          sequence: 10,
          method: "turn/started",
          params: {
            conversationId: "thread-live",
            status: "inProgress",
            turnId: "turn-1",
          },
          threadId: "thread-live",
          turnId: "turn-1",
          receivedAtMilliseconds: 100,
        },
        {
          sequence: 11,
          method: "turn/updated",
          params: {
            thread: {
              id: "thread-live",
            },
            turn_id: "turn-1",
          },
          threadId: "thread-live",
          turnId: "turn-1",
          receivedAtMilliseconds: 101,
        },
        {
          sequence: 12,
          method: "turn/completed",
          params: {
            threadId: "other-thread",
          },
          threadId: "other-thread",
          turnId: null,
          receivedAtMilliseconds: 102,
        },
      ],
      nextSequence: 13,
      firstAvailableSequence: 5,
      resetRequired: false,
    });

    const streamEvents = await context.owner.readStreamEvents("thread-live", {
      limit: 25,
      sinceSequence: 8,
    });

    expect(streamEvents.ownerClientId).toBe("app-server");
    expect(streamEvents.nextSequence).toBe(13);
    expect(streamEvents.firstAvailableSequence).toBe(5);
    expect(streamEvents.events).toEqual([
      {
        type: "broadcast",
        method: "turn/started",
        sourceClientId: "app-server",
        version: 1,
        params: {
          sequence: 10,
          receivedAtMilliseconds: 100,
          threadId: "thread-live",
          turnId: "turn-1",
          payload: {
            conversationId: "thread-live",
            status: "inProgress",
            turnId: "turn-1",
          },
        },
      },
      {
        type: "broadcast",
        method: "turn/updated",
        sourceClientId: "app-server",
        version: 1,
        params: {
          sequence: 11,
          receivedAtMilliseconds: 101,
          threadId: "thread-live",
          turnId: "turn-1",
          payload: {
            thread: {
              id: "thread-live",
            },
            turn_id: "turn-1",
          },
        },
      },
    ]);
    expect(context.appServerTransport.readNotificationEventsCalls).toEqual([
      {
        limit: 25,
        sinceSequence: 8,
      },
    ]);
  });

  it("uses projected notification identity instead of reparsing payloads on every read", async () => {
    const context = createOwnerTestContext({
      ipcReady: false,
    });
    context.appServerTransport.setNotificationEventsResult({
      events: [
        {
          sequence: 15,
          method: "turn/updated",
          params: "not-an-envelope",
          threadId: "thread-live",
          turnId: "turn-2",
          receivedAtMilliseconds: 150,
        },
      ],
      nextSequence: 16,
      firstAvailableSequence: 15,
      resetRequired: false,
    });

    const streamEvents = await context.owner.readStreamEvents("thread-live", {
      limit: 10,
      sinceSequence: 14,
    });

    expect(streamEvents.events).toEqual([
      {
        type: "broadcast",
        method: "turn/updated",
        sourceClientId: "app-server",
        version: 1,
        params: {
          sequence: 15,
          receivedAtMilliseconds: 150,
          threadId: "thread-live",
          turnId: "turn-2",
          payload: "not-an-envelope",
        },
      },
    ]);
  });

  it("emits outbound preview request frames before replay request completion", async () => {
    const responseFrame: IpcResponseFrame = {
      type: "response",
      requestId: "response-2",
      resultType: "success",
      result: {
        replay: "ok",
      },
    };
    const context = createOwnerTestContext({
      describedThreadId: "thread-from-preview",
      responseFrame,
    });
    const replayParameters: IpcRequestFrame["params"] = {
      conversationId: "thread-from-request-params",
    };
    const requestOptions: SendRequestOptions = {
      targetClientId: "client-1",
      version: 9,
    };

    const replayResult = await context.owner.replayRequest(
      "thread-read",
      replayParameters,
      requestOptions,
    );

    expect(replayResult).toEqual({
      replay: "ok",
    });
    expect(context.threadStreamStateOwner.describedFrames).toEqual([
      {
        type: "request",
        requestId: PREVIEW_REQUEST_IDENTIFIER,
        method: "thread-read",
        params: replayParameters,
        targetClientId: "client-1",
        version: 9,
      },
    ]);
    expect(context.emittedFrames).toEqual([
      {
        direction: "out",
        frame: {
          type: "request",
          requestId: PREVIEW_REQUEST_IDENTIFIER,
          method: "thread-read",
          params: replayParameters,
          targetClientId: "client-1",
          version: 9,
        },
        method: "thread-read",
        threadId: "thread-from-preview",
      },
    ]);
    expect(context.ipcClient.requestCalls).toEqual([
      {
        method: "thread-read",
        params: replayParameters,
        options: requestOptions,
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 0,
      ipcReadinessChecks: 1,
    });
  });

  it("uses request-shape preview metadata when emitting replay broadcast frames", () => {
    const context = createOwnerTestContext({
      describedThreadId: "thread-from-broadcast-preview",
    });
    const replayParameters: IpcRequestFrame["params"] = {
      threadId: "thread-from-request-params",
    };
    const requestOptions: SendRequestOptions = {
      targetClientId: "client-2",
      version: 7,
    };

    context.owner.replayBroadcast("thread-archive", replayParameters, requestOptions);

    expect(context.threadStreamStateOwner.describedFrames).toEqual([
      {
        type: "request",
        requestId: PREVIEW_REQUEST_IDENTIFIER,
        method: "thread-archive",
        params: replayParameters,
        targetClientId: "client-2",
        version: 7,
      },
    ]);
    expect(context.emittedFrames).toEqual([
      {
        direction: "out",
        frame: {
          type: "broadcast",
          method: "thread-archive",
          params: replayParameters,
          targetClientId: "client-2",
          version: 7,
        },
        method: "thread-archive",
        threadId: "thread-from-broadcast-preview",
      },
    ]);
    expect(context.ipcClient.broadcastCalls).toEqual([
      {
        method: "thread-archive",
        params: replayParameters,
        options: requestOptions,
      },
    ]);
    expect(context.readReadinessCounters()).toEqual({
      codexAvailabilityChecks: 0,
      ipcReadinessChecks: 1,
    });
  });
});
