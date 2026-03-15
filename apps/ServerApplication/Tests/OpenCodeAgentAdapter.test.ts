import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { MappedThreadListItem, OpenCodeCreateSessionInput } from "@farfield/opencode-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenCodeAgentAdapter } from "../Source/Agents/Adapters/OpenCodeAgentAdapter.js";
import type { AgentListThreadsInput } from "../Source/Agents/Types.js";

const DIRECTORY_REQUIRED_ERROR_MESSAGE = "Directory is required";

const openCodeApiMock = vi.hoisted(() => {
  interface ListSessionsCall {
    directory?: string;
  }

  interface SendMessageCall {
    sessionId: string;
    text: string;
    directory?: string;
  }

  interface OpenCodeCreateSessionResult {
    threadId: string;
    mapped: MappedThreadListItem;
  }

  interface OpenCodeApiMockState {
    connected: boolean;
    url: string | null;
    projectDirectories: string[];
    listSessionsByDirectory: Map<string, MappedThreadListItem[]>;
    unscopedSessions: MappedThreadListItem[];
    listSessionsCalls: ListSessionsCall[];
    sendMessageCalls: SendMessageCall[];
    createSessionCalls: OpenCodeCreateSessionInput[];
    createSessionResult: OpenCodeCreateSessionResult;
  }

  function createDefaultCreateSessionResult(): OpenCodeCreateSessionResult {
    return {
      threadId: "thread_create_session",
      mapped: {
        id: "thread_create_session",
        preview: "thread_create_session preview",
        createdAt: 1,
        updatedAt: 2,
        source: "opencode",
      },
    };
  }

  function createState(): OpenCodeApiMockState {
    return {
      connected: true,
      url: "http://127.0.0.1:4096",
      projectDirectories: [],
      listSessionsByDirectory: new Map<string, MappedThreadListItem[]>(),
      unscopedSessions: [],
      listSessionsCalls: [],
      sendMessageCalls: [],
      createSessionCalls: [],
      createSessionResult: createDefaultCreateSessionResult(),
    };
  }

  let state = createState();

  class OpenCodeConnectionMock {
    public constructor(_options: { url?: string; port?: number } = {}) {}

    public getUrl(): string | null {
      return state.url;
    }

    public isConnected(): boolean {
      return state.connected;
    }

    public async start(): Promise<void> {
      state.connected = true;
    }

    public async stop(): Promise<void> {
      state.connected = false;
    }
  }

  class OpenCodeMonitorServiceMock {
    public constructor(_connection: OpenCodeConnectionMock) {}

    public async listSessions(input?: {
      directory?: string;
    }): Promise<{ data: MappedThreadListItem[] }> {
      if (input?.directory !== undefined) {
        state.listSessionsCalls.push({ directory: input.directory });
        return {
          data: state.listSessionsByDirectory.get(input.directory) ?? [],
        };
      }
      state.listSessionsCalls.push({});
      return {
        data: state.unscopedSessions,
      };
    }

    public async listProjectDirectories(): Promise<string[]> {
      return [...state.projectDirectories];
    }

    public async sendMessage(input: {
      sessionId: string;
      text: string;
      directory?: string;
    }): Promise<void> {
      state.sendMessageCalls.push(input);
    }

    public async createSession(
      input?: OpenCodeCreateSessionInput,
    ): Promise<OpenCodeCreateSessionResult> {
      state.createSessionCalls.push(input ?? {});
      return state.createSessionResult;
    }

    public async getSessionState(): Promise<never> {
      throw new Error("not used in this test");
    }

    public async abort(): Promise<void> {
      throw new Error("not used in this test");
    }
  }

  return {
    getState(): OpenCodeApiMockState {
      return state;
    },
    resetState(): void {
      state = createState();
    },
    OpenCodeConnectionMock,
    OpenCodeMonitorServiceMock,
  };
});

vi.mock("@farfield/opencode-api", () => {
  return {
    OpenCodeConnection: openCodeApiMock.OpenCodeConnectionMock,
    OpenCodeMonitorService: openCodeApiMock.OpenCodeMonitorServiceMock,
  };
});

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(prefix: string): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

function createThreadListItem(input: {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  cwd?: string;
}): MappedThreadListItem {
  return {
    id: input.id,
    preview: `${input.id} preview`,
    createdAt: input.createdAt ?? 1,
    updatedAt: input.updatedAt ?? 2,
    ...(input.cwd ? { cwd: input.cwd } : {}),
    source: "opencode",
  };
}

function createListThreadsInput(
  overrides: Partial<AgentListThreadsInput> = {},
): AgentListThreadsInput {
  return {
    limit: 20,
    archived: false,
    all: false,
    maxPages: 5,
    cursor: null,
    sortKey: "updated_at",
    cwd: null,
    ...overrides,
  };
}

beforeEach(() => {
  openCodeApiMock.resetState();
});

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

describe("OpenCodeAgentAdapter", () => {
  it("returns an empty page for archived listings without session reads", async () => {
    const adapter = new OpenCodeAgentAdapter();

    const result = await adapter.listThreads(
      createListThreadsInput({
        archived: true,
      }),
    );

    expect(result).toEqual({
      data: [],
      nextCursor: null,
      pages: 0,
      truncated: false,
    });
    expect(openCodeApiMock.getState().listSessionsCalls).toEqual([]);
  });

  it("uses unscoped session listing when no project directories are available", async () => {
    const adapter = new OpenCodeAgentAdapter();
    const state = openCodeApiMock.getState();
    state.projectDirectories = [];
    state.unscopedSessions = [
      createThreadListItem({
        id: "thread_unscoped",
      }),
    ];

    const result = await adapter.listThreads(createListThreadsInput());

    expect(result.data.map((thread) => thread.id)).toEqual(["thread_unscoped"]);
    expect(state.listSessionsCalls).toEqual([{}]);
  });

  it("caches trimmed session directories and reuses them when sending messages", async () => {
    const adapter = new OpenCodeAgentAdapter();
    const state = openCodeApiMock.getState();

    const projectDirectory = createTemporaryDirectory("farfield-opencode-project-");
    const threadDirectory = path.join(projectDirectory, "thread-workspace");
    fs.mkdirSync(threadDirectory, { recursive: true });

    state.projectDirectories = [projectDirectory];
    state.listSessionsByDirectory.set(projectDirectory, [
      createThreadListItem({
        id: "thread_cached_directory",
        cwd: `  ${threadDirectory}  `,
      }),
    ]);

    await adapter.listThreads(createListThreadsInput());
    await adapter.sendMessage({
      threadId: "thread_cached_directory",
      text: "hello world",
    });

    expect(state.listSessionsCalls).toEqual([
      {
        directory: projectDirectory,
      },
    ]);
    expect(state.sendMessageCalls).toEqual([
      {
        sessionId: "thread_cached_directory",
        text: "hello world",
        directory: threadDirectory,
      },
    ]);
  });

  it("rejects createThread when explicit cwd is an empty string", async () => {
    const adapter = new OpenCodeAgentAdapter();

    await expect(
      adapter.createThread({
        cwd: "",
      }),
    ).rejects.toThrow(DIRECTORY_REQUIRED_ERROR_MESSAGE);
  });

  it("preserves explicit empty model values when forwarding createThread input", async () => {
    const adapter = new OpenCodeAgentAdapter();
    const state = openCodeApiMock.getState();

    const result = await adapter.createThread({
      model: "",
    });

    expect(state.createSessionCalls).toEqual([
      {
        title: "",
      },
    ]);
    expect(result.threadId).toBe("thread_create_session");
  });

  it("rejects sendMessage when explicit cwd is an empty string even when directory is cached", async () => {
    const adapter = new OpenCodeAgentAdapter();
    const state = openCodeApiMock.getState();

    const projectDirectory = createTemporaryDirectory("farfield-opencode-project-");
    const threadDirectory = path.join(projectDirectory, "thread-workspace");
    fs.mkdirSync(threadDirectory, { recursive: true });

    state.projectDirectories = [projectDirectory];
    state.listSessionsByDirectory.set(projectDirectory, [
      createThreadListItem({
        id: "thread_cached_directory_explicit_empty_cwd",
        cwd: `  ${threadDirectory}  `,
      }),
    ]);

    await adapter.listThreads(createListThreadsInput());
    await expect(
      adapter.sendMessage({
        threadId: "thread_cached_directory_explicit_empty_cwd",
        text: "hello world",
        cwd: "",
      }),
    ).rejects.toThrow(DIRECTORY_REQUIRED_ERROR_MESSAGE);
    expect(state.sendMessageCalls).toEqual([]);
  });
});
