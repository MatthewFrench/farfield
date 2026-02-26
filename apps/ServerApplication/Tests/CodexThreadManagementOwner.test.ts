import { describe, expect, it } from "vitest";
import {
  AppServerClient,
  type AppServerTransport,
  type ListThreadsAllOptions,
  type ListThreadsOptions,
  type ReadConfigOptions,
  type StartThreadOptions
} from "@farfield/api";
import type {
  AppServerConfigReadResponse,
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

const EMPTY_READ_CONFIG_RESPONSE: AppServerConfigReadResponse = {
  config: {
    profile: null,
    model: null,
    model_reasoning_effort: null,
    profiles: {}
  }
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
  public readonly readConfigCalls: Array<ReadConfigOptions | undefined> = [];

  private readonly listThreadsResult: AppServerListThreadsResponse;
  private readonly listThreadsAllResult: AppServerListThreadsResponse;
  private readonly startThreadResult: AppServerStartThreadResponse;
  private readonly readConfigResult: AppServerConfigReadResponse;

  public constructor(input?: {
    listThreadsResult?: AppServerListThreadsResponse;
    listThreadsAllResult?: AppServerListThreadsResponse;
    startThreadResult?: AppServerStartThreadResponse;
    readConfigResult?: AppServerConfigReadResponse;
  }) {
    super(NOOP_TRANSPORT);
    this.listThreadsResult = input?.listThreadsResult ?? EMPTY_LIST_THREADS_RESPONSE;
    this.listThreadsAllResult = input?.listThreadsAllResult ?? EMPTY_LIST_THREADS_RESPONSE;
    this.startThreadResult = input?.startThreadResult ?? START_THREAD_RESPONSE;
    this.readConfigResult = input?.readConfigResult ?? EMPTY_READ_CONFIG_RESPONSE;
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

  public override async readConfig(
    options?: ReadConfigOptions
  ): Promise<AppServerConfigReadResponse> {
    this.readConfigCalls.push(options);
    return this.readConfigResult;
  }
}

function createOwner(appClient: AppServerClient): CodexThreadManagementOwner {
  return new CodexThreadManagementOwner({
    appClient,
    runAppServerCall: async <ValueType>(operation: () => Promise<ValueType>): Promise<ValueType> => operation(),
    ensureCodexAvailable: () => {}
  });
}

interface AgentListThreadsInputOverrides {
  limit?: AgentListThreadsInput["limit"];
  archived?: AgentListThreadsInput["archived"];
  all?: AgentListThreadsInput["all"];
  maxPages?: AgentListThreadsInput["maxPages"];
  cursor?: AgentListThreadsInput["cursor"];
  sortKey?: AgentListThreadsInput["sortKey"];
  cwd?: AgentListThreadsInput["cwd"];
}

function createListThreadsInput(overrides: AgentListThreadsInputOverrides = {}): AgentListThreadsInput {
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

  it("preserves explicit empty-string list-thread optional values", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.listThreads(
      createListThreadsInput({
        cursor: "",
        cwd: ""
      })
    );

    expect(appClient.listThreadsCalls).toEqual([
      {
        limit: 20,
        archived: false,
        cursor: "",
        sortKey: "updated_at",
        cwd: ""
      }
    ]);
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

  it("normalizes undefined nextCursor to null for list results", async () => {
    const appClient = new TestAppServerClient({
      listThreadsResult: {
        data: []
      }
    });
    const owner = createOwner(appClient);

    const result = await owner.listThreads(createListThreadsInput());

    expect(result).toEqual({
      data: [],
      nextCursor: null
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

  it("preserves explicit empty-string optional create-thread values", async () => {
    const appClient = new TestAppServerClient();
    const owner = createOwner(appClient);

    await owner.createThread({
      cwd: "  /tmp/workspace  ",
      model: "",
      modelProvider: "",
      personality: "",
      sandbox: "",
      approvalPolicy: "",
      ephemeral: false
    });

    expect(appClient.startThreadCalls).toEqual([
      {
        cwd: "/tmp/workspace",
        model: "",
        modelProvider: "",
        personality: "",
        sandbox: "",
        approvalPolicy: "",
        ephemeral: false
      }
    ]);
  });

  it("maps create-thread response contract metadata", async () => {
    const appClient = new TestAppServerClient({
      startThreadResult: {
        ...START_THREAD_RESPONSE,
        model: "gpt-5",
        modelProvider: "openai",
        cwd: "/tmp/workspace",
        approvalPolicy: "never",
        sandbox: "workspace-write",
        reasoningEffort: "medium"
      }
    });
    const owner = createOwner(appClient);

    const result = await owner.createThread({ cwd: "/tmp/workspace" });

    expect(result).toEqual({
      threadId: "thread-1",
      thread: START_THREAD_RESPONSE.thread,
      model: "gpt-5",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
      approvalPolicy: "never",
      sandbox: "workspace-write",
      reasoningEffort: "medium"
    });
  });

  it("prefers active profile config defaults and requests config without layers", async () => {
    const appClient = new TestAppServerClient({
      readConfigResult: {
        config: {
          profile: "work",
          model: "global-model",
          model_reasoning_effort: "minimal",
          profiles: {
            work: {
              model: "profile-model",
              model_reasoning_effort: "high"
            }
          }
        }
      }
    });
    const owner = createOwner(appClient);

    const result = await owner.readConfigDefaults();

    expect(appClient.readConfigCalls).toEqual([
      {
        includeLayers: false
      }
    ]);
    expect(result).toEqual({
      model: "profile-model",
      reasoningEffort: "high"
    });
  });

  it("uses global config defaults when active profile is missing", async () => {
    const appClient = new TestAppServerClient({
      readConfigResult: {
        config: {
          profile: "missing",
          model: "global-model",
          model_reasoning_effort: "medium",
          profiles: {}
        }
      }
    });
    const owner = createOwner(appClient);

    const result = await owner.readConfigDefaults();

    expect(result).toEqual({
      model: "global-model",
      reasoningEffort: "medium"
    });
  });
});
