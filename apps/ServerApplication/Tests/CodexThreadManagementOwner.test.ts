import { describe, expect, it } from "vitest";
import {
  AppServerClient,
  type AppServerTransport,
  type ListThreadsAllOptions,
  type ListThreadsOptions,
  type StartThreadOptions
} from "@farfield/api";
import type {
  AppServerListThreadsResponse,
  AppServerStartThreadResponse,
  JsonValue
} from "@farfield/protocol";
import { CodexThreadManagementOwner } from "../Source/Agents/Adapters/CodexThreadManagementOwner.js";
import type {
  AgentCreateThreadInput,
  AgentListThreadsInput
} from "../Source/Agents/Types.js";

const NOOP_TRANSPORT: AppServerTransport = {
  async request(_method: string, _params: object, _timeoutMs?: number): Promise<JsonValue> {
    throw new Error("transport should not be used in this test");
  },
  async close(): Promise<void> {}
};

const EMPTY_LIST_THREADS_RESPONSE: AppServerListThreadsResponse = {
  data: [],
  nextCursor: null
};

const START_THREAD_RESPONSE: AppServerStartThreadResponse = {
  thread: {
    id: "thread-1",
    preview: "Thread preview",
    createdAt: 1,
    updatedAt: 1,
    source: "opencode"
  },
  model: "gpt-5",
  modelProvider: "openai",
  cwd: "/tmp/workspace"
};

class TestAppServerClient extends AppServerClient {
  public readonly listThreadsCalls: ListThreadsOptions[] = [];
  public readonly listThreadsAllCalls: ListThreadsAllOptions[] = [];
  public readonly startThreadCalls: StartThreadOptions[] = [];

  private readonly listThreadsResult: AppServerListThreadsResponse;
  private readonly listThreadsAllResult: AppServerListThreadsResponse;
  private readonly startThreadResult: AppServerStartThreadResponse;

  public constructor(input?: {
    listThreadsResult?: AppServerListThreadsResponse;
    listThreadsAllResult?: AppServerListThreadsResponse;
    startThreadResult?: AppServerStartThreadResponse;
  }) {
    super(NOOP_TRANSPORT);
    this.listThreadsResult = input?.listThreadsResult ?? EMPTY_LIST_THREADS_RESPONSE;
    this.listThreadsAllResult = input?.listThreadsAllResult ?? EMPTY_LIST_THREADS_RESPONSE;
    this.startThreadResult = input?.startThreadResult ?? START_THREAD_RESPONSE;
  }

  public override async listThreads(options: ListThreadsOptions): Promise<AppServerListThreadsResponse> {
    this.listThreadsCalls.push(options);
    return this.listThreadsResult;
  }

  public override async listThreadsAll(options: ListThreadsAllOptions): Promise<AppServerListThreadsResponse> {
    this.listThreadsAllCalls.push(options);
    return this.listThreadsAllResult;
  }

  public override async startThread(options: StartThreadOptions): Promise<AppServerStartThreadResponse> {
    this.startThreadCalls.push(options);
    return this.startThreadResult;
  }
}

function createOwner(appClient: AppServerClient): CodexThreadManagementOwner {
  return new CodexThreadManagementOwner({
    appClient,
    runAppServerCall: async <ValueType>(operation: () => Promise<ValueType>): Promise<ValueType> => operation(),
    ensureCodexAvailable: () => {}
  });
}

function createListThreadsInput(overrides: Partial<AgentListThreadsInput> = {}): AgentListThreadsInput {
  return {
    limit: 20,
    archived: false,
    all: false,
    maxPages: 1,
    cursor: null,
    sortKey: "updated_at",
    cwd: null,
    ...overrides
  };
}

describe("CodexThreadManagementOwner", () => {
  it("maps single-page list request options and omits optional fields when absent", async () => {
    const appClient = new TestAppServerClient({
      listThreadsResult: {
        data: [],
        nextCursor: "next-cursor"
      }
    });
    const owner = createOwner(appClient);

    const result = await owner.listThreads(
      createListThreadsInput({
        all: false,
        limit: 10,
        archived: true,
        sortKey: "created_at"
      })
    );

    expect(appClient.listThreadsCalls).toEqual([
      {
        limit: 10,
        archived: true,
        sortKey: "created_at"
      }
    ]);
    expect(result).toEqual({
      data: [],
      nextCursor: "next-cursor"
    });
    expect(result).not.toHaveProperty("pages");
    expect(result).not.toHaveProperty("truncated");
  });

  it("maps all-pages list request options and preserves optional pagination metadata", async () => {
    const appClient = new TestAppServerClient({
      listThreadsAllResult: {
        data: [],
        nextCursor: null,
        pages: 2,
        truncated: true
      }
    });
    const owner = createOwner(appClient);

    const result = await owner.listThreads(
      createListThreadsInput({
        all: true,
        cursor: "cursor-1",
        cwd: "/tmp/workspace",
        maxPages: 3
      })
    );

    expect(appClient.listThreadsAllCalls).toEqual([
      {
        limit: 20,
        archived: false,
        cursor: "cursor-1",
        sortKey: "updated_at",
        cwd: "/tmp/workspace",
        maxPages: 3
      }
    ]);
    expect(result).toEqual({
      data: [],
      nextCursor: null,
      pages: 2,
      truncated: true
    });
  });

  it("rejects create-thread requests when cwd is missing or blank", async () => {
    const owner = createOwner(new TestAppServerClient());

    await expect(owner.createThread({})).rejects.toThrowError(/requires cwd/);
    await expect(owner.createThread({ cwd: "   " })).rejects.toThrowError(/requires cwd/);
  });

  it("trims cwd before thread creation and forwards optional start-thread options", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);
    const createThreadInput: AgentCreateThreadInput = {
      cwd: "  /tmp/workspace  ",
      model: "gpt-5",
      modelProvider: "openai",
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      ephemeral: true
    };

    const result = await owner.createThread(createThreadInput);

    expect(appClient.startThreadCalls).toEqual([
      {
        cwd: "/tmp/workspace",
        model: "gpt-5",
        modelProvider: "openai",
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
        ephemeral: true
      }
    ]);
    expect(result.threadId).toBe("thread-1");
    expect(result.cwd).toBe("/tmp/workspace");
  });
});
