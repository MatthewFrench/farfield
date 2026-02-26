import { AppServerClient, CodexMonitorService, type AppServerTransport, type CodexMonitorIpcClient, type SendMessageInput } from "@farfield/api";
import { parseThreadStreamStateChangedBroadcast, type IpcResponseFrame, type JsonValue } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { CodexMessageDispatchOwner } from "../Source/Agents/Adapters/CodexMessageDispatchOwner.js";
import { CodexThreadStreamStateOwner } from "../Source/Agents/Adapters/CodexThreadStreamStateOwner.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../Source/Agents/ThreadStreamStateChangedContract.js";

const DEFAULT_IPC_RESPONSE_FRAME: IpcResponseFrame = {
  type: "response",
  requestId: "response-1",
  resultType: "success",
  result: {
    status: "ok"
  }
};

const NOOP_MONITOR_IPC_CLIENT: CodexMonitorIpcClient = {
  async sendRequestAndWait(): Promise<IpcResponseFrame> {
    return DEFAULT_IPC_RESPONSE_FRAME;
  }
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

  public async request(method: string, params: object, timeoutMs?: number): Promise<JsonValue> {
    this.requestCalls.push({
      method,
      params,
      timeoutMs
    });
    return {
      thread: {
        id: "unused-thread-id",
        turns: [],
        requests: []
      }
    };
  }

  public async close(): Promise<void> {}
}

function createThreadStreamStateOwner(threadId: string, ownerClientId: string): CodexThreadStreamStateOwner {
  const threadStreamStateOwner = new CodexThreadStreamStateOwner();
  threadStreamStateOwner.ingestInboundFrame(parseThreadStreamStateChangedBroadcast({
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
              params: {
                threadId,
                input: [{ type: "text", text: "existing input" }],
                attachments: []
              },
              status: "completed",
              items: []
            }
          ],
          requests: []
        }
      }
    }
  }));
  return threadStreamStateOwner;
}

function createOwnerTestContext(threadId: string, ownerClientId: string): OwnerTestContext {
  const appServerTransport = new TestAppServerTransport();
  const appClient = new AppServerClient(appServerTransport);
  const service = new TestCodexMonitorService();
  const threadStreamStateOwner = createThreadStreamStateOwner(threadId, ownerClientId);
  let runAppServerCallCount = 0;

  const owner = new CodexMessageDispatchOwner({
    appClient,
    service,
    threadStreamStateOwner,
    runAppServerCall: async <ValueType,>(operation: () => Promise<ValueType>): Promise<ValueType> => {
      runAppServerCallCount += 1;
      return operation();
    },
    isConversationNotFoundError: <ErrorType,>(_error: ErrorType): boolean => false
  });

  return {
    owner,
    service,
    appServerTransport,
    readRunAppServerCallCount: () => runAppServerCallCount
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
        cwd: ""
      },
      true
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
        text: "hello"
      },
      true
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
});
