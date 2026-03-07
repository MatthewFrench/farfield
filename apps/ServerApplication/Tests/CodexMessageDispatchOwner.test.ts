import {
  AppServerClient,
  type AppServerTransport,
  type CodexMonitorIpcClient,
  CodexMonitorService,
  type SendMessageInput,
} from "@farfield/api";
import {
  type IpcResponseFrame,
  type JsonValue,
  parseThreadStreamStateChangedBroadcast,
} from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { CodexMessageDispatchOwner } from "../Source/Agents/Adapters/CodexMessageDispatchOwner.js";
import { CodexThreadStreamStateOwner } from "../Source/Agents/Adapters/CodexThreadStreamStateOwner.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../Source/Agents/ThreadStreamStateChangedContract.js";

const DEFAULT_IPC_RESPONSE_FRAME: IpcResponseFrame = {
  type: "response",
  requestId: "response-1",
  resultType: "success",
  result: {
    status: "ok",
  },
};

const NOOP_MONITOR_IPC_CLIENT: CodexMonitorIpcClient = {
  async sendRequestAndWait(): Promise<IpcResponseFrame> {
    return DEFAULT_IPC_RESPONSE_FRAME;
  },
};

interface AppServerRequestCall {
  method: string;
  params: object;
  timeoutMs: number | undefined;
}

interface OwnerTestContext {
  owner: CodexMessageDispatchOwner;
  service: TestCodexMonitorService;
  appServerTransport: TestAppServerTransport;
  threadStreamStateOwner: CodexThreadStreamStateOwner;
  readRunAppServerCallCount: () => number;
}

class TestCodexMonitorService extends CodexMonitorService {
  public readonly sendMessageCalls: SendMessageInput[] = [];

  public constructor() {
    super(NOOP_MONITOR_IPC_CLIENT);
  }

  public override async sendMessage(input: SendMessageInput): Promise<void> {
    this.sendMessageCalls.push(input);
  }
}

class TestAppServerTransport implements AppServerTransport {
  public readonly requestCalls: AppServerRequestCall[] = [];
  private readonly responseByMethod = new Map<string, JsonValue>();
  private readonly errorsByMethod = new Map<string, Error[]>();

  public async request(method: string, params: object, timeoutMs?: number): Promise<JsonValue> {
    this.requestCalls.push({
      method,
      params,
      timeoutMs,
    });

    const queuedErrors = this.errorsByMethod.get(method);
    if (queuedErrors && queuedErrors.length > 0) {
      const nextError = queuedErrors.shift();
      if (nextError) {
        throw nextError;
      }
    }

    const configuredResponse = this.responseByMethod.get(method);
    if (configuredResponse !== undefined) {
      return configuredResponse;
    }

    return {
      thread: {
        id: "unused-thread-id",
        turns: [],
        requests: [],
      },
    };
  }

  public setResponse(method: string, response: JsonValue): void {
    this.responseByMethod.set(method, response);
  }

  public queueError(method: string, error: Error): void {
    const queuedErrors = this.errorsByMethod.get(method) ?? [];
    queuedErrors.push(error);
    this.errorsByMethod.set(method, queuedErrors);
  }

  public async close(): Promise<void> {}
}

function createThreadStreamStateOwner(
  threadId: string,
  ownerClientId: string,
  options?: {
    turnStatus?: "completed" | "inProgress" | "in_progress";
    turnId?: string;
    includeInitialTurnParams?: boolean;
  },
): CodexThreadStreamStateOwner {
  const threadStreamStateOwner = new CodexThreadStreamStateOwner();
  threadStreamStateOwner.ingestInboundFrame(
    parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      sourceClientId: ownerClientId,
      version: 4,
      params: {
        conversationId: threadId,
        type: THREAD_STREAM_STATE_CHANGED_METHOD,
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: threadId,
            turns: [
              {
                ...(options?.turnId !== undefined ? { turnId: options.turnId } : {}),
                ...(options?.includeInitialTurnParams === false
                  ? {}
                  : {
                      params: {
                        threadId,
                        input: [{ type: "text", text: "existing input" }],
                        attachments: [],
                      },
                    }),
                status: options?.turnStatus ?? "completed",
                items: [],
              },
            ],
            requests: [],
          },
        },
      },
    }),
  );
  return threadStreamStateOwner;
}

function createOwnerTestContext(
  threadId: string,
  ownerClientId: string,
  options?: {
    isConversationNotFoundError?: <ErrorType>(error: ErrorType) => boolean;
    initialTurnStatus?: "completed" | "inProgress" | "in_progress";
    initialTurnId?: string;
    includeInitialTurnParams?: boolean;
  },
): OwnerTestContext {
  const appServerTransport = new TestAppServerTransport();
  const appClient = new AppServerClient(appServerTransport);
  const service = new TestCodexMonitorService();
  const threadStreamStateOwner = createThreadStreamStateOwner(threadId, ownerClientId, {
    turnStatus: options?.initialTurnStatus,
    turnId: options?.initialTurnId,
    includeInitialTurnParams: options?.includeInitialTurnParams,
  });
  let runAppServerCallCount = 0;

  const owner = new CodexMessageDispatchOwner({
    appClient,
    service,
    threadStreamStateOwner,
    runAppServerCall: async <ValueType>(
      operation: () => Promise<ValueType>,
    ): Promise<ValueType> => {
      runAppServerCallCount += 1;
      return operation();
    },
    isConversationNotFoundError:
      options?.isConversationNotFoundError ?? (<ErrorType>(_error: ErrorType): boolean => false),
  });

  return {
    owner,
    service,
    appServerTransport,
    threadStreamStateOwner,
    readRunAppServerCallCount: () => runAppServerCallCount,
  };
}

describe("CodexMessageDispatchOwner", () => {
  it("forwards explicit empty cwd values for known-owner IPC sends", async () => {
    const threadId = "thread-1";
    const ownerClientId = "owner-client-1";
    const context = createOwnerTestContext(threadId, ownerClientId);

    await context.owner.sendMessage(
      {
        threadId,
        text: "hello",
        cwd: "",
      },
      true,
    );

    expect(context.service.sendMessageCalls).toHaveLength(1);
    const sendCall = context.service.sendMessageCalls[0];
    expect(sendCall).toBeDefined();
    if (!sendCall) {
      throw new Error("Expected sendMessage call.");
    }
    expect(sendCall.ownerClientId).toBe(ownerClientId);
    expect(sendCall.cwd).toBe("");
    expect("cwd" in sendCall).toBe(true);
    expect(context.readRunAppServerCallCount()).toBe(0);
    expect(context.appServerTransport.requestCalls).toHaveLength(0);
  });

  it("keeps omitted cwd absent for known-owner IPC sends", async () => {
    const threadId = "thread-2";
    const ownerClientId = "owner-client-2";
    const context = createOwnerTestContext(threadId, ownerClientId);

    await context.owner.sendMessage(
      {
        threadId,
        text: "hello",
      },
      true,
    );

    expect(context.service.sendMessageCalls).toHaveLength(1);
    const sendCall = context.service.sendMessageCalls[0];
    expect(sendCall).toBeDefined();
    if (!sendCall) {
      throw new Error("Expected sendMessage call.");
    }
    expect(sendCall.ownerClientId).toBe(ownerClientId);
    expect(sendCall.cwd).toBeUndefined();
    expect("cwd" in sendCall).toBe(false);
    expect(context.readRunAppServerCallCount()).toBe(0);
    expect(context.appServerTransport.requestCalls).toHaveLength(0);
  });

  it("does not reread the thread before IPC sends when no projected turn template exists", async () => {
    const threadId = "thread-ipc-no-template";
    const ownerClientId = "owner-client-ipc-no-template";
    const context = createOwnerTestContext(threadId, ownerClientId, {
      includeInitialTurnParams: false,
    });

    await context.owner.sendMessage(
      {
        threadId,
        text: "hello without template",
      },
      true,
    );

    expect(context.service.sendMessageCalls).toHaveLength(1);
    const sendCall = context.service.sendMessageCalls[0];
    expect(sendCall).toBeDefined();
    if (!sendCall) {
      throw new Error("Expected sendMessage call.");
    }
    expect(sendCall.turnStartTemplate).toBeUndefined();
    expect("turnStartTemplate" in sendCall).toBe(false);
    expect(context.readRunAppServerCallCount()).toBe(0);
    expect(context.appServerTransport.requestCalls).toHaveLength(0);
  });

  it("stages an optimistic in-progress turn after IPC send acceptance", async () => {
    const threadId = "thread-ipc-optimistic";
    const ownerClientId = "owner-client-ipc-optimistic";
    const context = createOwnerTestContext(threadId, ownerClientId);

    await context.owner.sendMessage(
      {
        threadId,
        text: "optimistic send",
      },
      true,
    );

    const conversationState =
      context.threadStreamStateOwner.readLiveState(threadId).conversationState;
    const lastTurn = conversationState?.turns[conversationState.turns.length - 1];
    expect(lastTurn?.status).toBe("inProgress");
    expect(lastTurn?.params?.input).toEqual([{ type: "text", text: "optimistic send" }]);
  });

  it("uses turn/start for app-server sends when IPC is unavailable", async () => {
    const threadId = "thread-3";
    const ownerClientId = "owner-client-3";
    const context = createOwnerTestContext(threadId, ownerClientId);
    context.appServerTransport.setResponse("turn/start", {
      turn: {
        id: "turn-1",
      },
    });

    await context.owner.sendMessage(
      {
        threadId,
        text: "hello from app-server",
      },
      false,
    );

    expect(context.service.sendMessageCalls).toHaveLength(0);
    expect(context.readRunAppServerCallCount()).toBe(1);
    expect(context.appServerTransport.requestCalls).toEqual([
      {
        method: "turn/start",
        params: {
          threadId,
          input: [
            {
              type: "text",
              text: "hello from app-server",
            },
          ],
          attachments: [],
        },
        timeoutMs: undefined,
      },
    ]);
  });

  it("does not reread the thread before app-server sends when no projected turn template exists", async () => {
    const threadId = "thread-app-server-no-template";
    const ownerClientId = "owner-client-app-server-no-template";
    const context = createOwnerTestContext(threadId, ownerClientId, {
      includeInitialTurnParams: false,
    });
    context.appServerTransport.setResponse("turn/start", {
      turn: {
        id: "turn-without-template",
      },
    });

    await context.owner.sendMessage(
      {
        threadId,
        text: "hello without template",
      },
      false,
    );

    expect(context.readRunAppServerCallCount()).toBe(1);
    expect(context.appServerTransport.requestCalls).toEqual([
      {
        method: "turn/start",
        params: {
          threadId,
          input: [
            {
              type: "text",
              text: "hello without template",
            },
          ],
          attachments: [],
        },
        timeoutMs: undefined,
      },
    ]);
  });

  it("stages an optimistic in-progress turn after app-server send acceptance", async () => {
    const threadId = "thread-app-server-optimistic";
    const ownerClientId = "owner-client-app-server-optimistic";
    const context = createOwnerTestContext(threadId, ownerClientId);
    context.appServerTransport.setResponse("turn/start", {
      turn: {
        id: "turn-app-server",
      },
    });

    await context.owner.sendMessage(
      {
        threadId,
        text: "optimistic send",
      },
      false,
    );

    const conversationState =
      context.threadStreamStateOwner.readLiveState(threadId).conversationState;
    const lastTurn = conversationState?.turns[conversationState.turns.length - 1];
    expect(lastTurn?.status).toBe("inProgress");
    expect(lastTurn?.params?.input).toEqual([{ type: "text", text: "optimistic send" }]);
  });

  it("resumes the thread and retries turn/start after conversation-not-found errors", async () => {
    const threadId = "thread-4";
    const ownerClientId = "owner-client-4";
    const context = createOwnerTestContext(threadId, ownerClientId, {
      isConversationNotFoundError: <ErrorType>(error: ErrorType): boolean => {
        return error instanceof Error && error.message.includes("conversation not found");
      },
    });
    context.appServerTransport.setResponse("thread/resume", {
      thread: {
        id: threadId,
        turns: [],
        requests: [],
      },
    });
    context.appServerTransport.setResponse("turn/start", {
      turn: {
        id: "turn-2",
      },
    });
    context.appServerTransport.queueError("turn/start", new Error("conversation not found"));

    await context.owner.sendMessage(
      {
        threadId,
        text: "retry turn start",
      },
      false,
    );

    expect(context.readRunAppServerCallCount()).toBe(3);
    expect(context.appServerTransport.requestCalls).toEqual([
      {
        method: "turn/start",
        params: {
          threadId,
          input: [
            {
              type: "text",
              text: "retry turn start",
            },
          ],
          attachments: [],
        },
        timeoutMs: undefined,
      },
      {
        method: "thread/resume",
        params: {
          threadId,
          persistExtendedHistory: true,
        },
        timeoutMs: undefined,
      },
      {
        method: "turn/start",
        params: {
          threadId,
          input: [
            {
              type: "text",
              text: "retry turn start",
            },
          ],
          attachments: [],
        },
        timeoutMs: undefined,
      },
    ]);
  });

  it("uses turn/steer for steering sends when IPC is unavailable", async () => {
    const threadId = "thread-5";
    const ownerClientId = "owner-client-5";
    const context = createOwnerTestContext(threadId, ownerClientId, {
      initialTurnStatus: "inProgress",
      initialTurnId: "turn-in-progress",
    });
    context.appServerTransport.setResponse("turn/steer", {
      turnId: "turn-in-progress",
    });

    await context.owner.sendMessage(
      {
        threadId,
        text: "steer this turn",
        isSteering: true,
      },
      false,
    );

    expect(context.service.sendMessageCalls).toHaveLength(0);
    expect(context.readRunAppServerCallCount()).toBe(1);
    expect(context.appServerTransport.requestCalls).toEqual([
      {
        method: "turn/steer",
        params: {
          threadId,
          expectedTurnId: "turn-in-progress",
          input: [
            {
              type: "text",
              text: "steer this turn",
            },
          ],
        },
        timeoutMs: undefined,
      },
    ]);
  });

  it("fails steering sends when no in-progress turn identifier can be resolved", async () => {
    const threadId = "thread-6";
    const ownerClientId = "owner-client-6";
    const context = createOwnerTestContext(threadId, ownerClientId, {
      initialTurnStatus: "completed",
      initialTurnId: "turn-completed",
    });

    await expect(
      context.owner.sendMessage(
        {
          threadId,
          text: "steer this turn",
          isSteering: true,
        },
        false,
      ),
    ).rejects.toThrowError("Cannot steer because there is no in-progress turn for this thread.");

    expect(context.appServerTransport.requestCalls).toEqual([
      {
        method: "thread/read",
        params: {
          threadId,
          includeTurns: true,
        },
        timeoutMs: 90_000,
      },
    ]);
  });
});
