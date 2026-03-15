import { describe, expect, it, type Mock, vi } from "vitest";
import type {
  OpenCodeApiResponseEnvelope,
  OpenCodeConnectionClientProvider,
  OpenCodeMonitorClient,
  OpenCodeSessionCreateRequest,
  OpenCodeSessionListRequest,
  OpenCodeSessionPromptRequest,
  OpenCodeSessionReadRequest,
} from "../Source/ClientContracts.js";
import type { OpenCodeStructuredDataValue } from "../Source/Schemas.js";
import { OpenCodeMonitorService } from "../Source/Service.js";

type SessionListFunction = (
  input?: OpenCodeSessionListRequest,
) => Promise<OpenCodeApiResponseEnvelope>;
type SessionCreateFunction = (
  input: OpenCodeSessionCreateRequest,
) => Promise<OpenCodeApiResponseEnvelope>;
type SessionReadFunction = (
  input: OpenCodeSessionReadRequest,
) => Promise<OpenCodeApiResponseEnvelope>;
type SessionPromptFunction = (
  input: OpenCodeSessionPromptRequest,
) => Promise<OpenCodeApiResponseEnvelope>;
type ProjectListFunction = () => Promise<OpenCodeApiResponseEnvelope>;

interface OpenCodeServiceClientDouble {
  provider: OpenCodeConnectionClientProvider;
  sessionList: Mock<SessionListFunction>;
  sessionCreate: Mock<SessionCreateFunction>;
  sessionGet: Mock<SessionReadFunction>;
  sessionMessages: Mock<SessionReadFunction>;
  sessionPrompt: Mock<SessionPromptFunction>;
  sessionAbort: Mock<SessionReadFunction>;
  sessionDelete: Mock<SessionReadFunction>;
  projectList: Mock<ProjectListFunction>;
}

function createResponseEnvelope(data?: OpenCodeStructuredDataValue): OpenCodeApiResponseEnvelope {
  if (data === undefined) {
    return {};
  }

  return {
    data,
  };
}

function createSessionRecord(
  id: string,
  title: string,
  directory: string,
  createdAtSeconds: number,
  updatedAtSeconds: number,
): OpenCodeStructuredDataValue {
  return {
    id,
    title,
    directory,
    time: {
      created: createdAtSeconds,
      updated: updatedAtSeconds,
    },
  };
}

function createMessageRecords(): OpenCodeStructuredDataValue {
  return [
    {
      info: {
        id: "user-1",
        role: "user",
        parentID: "root",
        time: {
          created: 1_700_000_100,
        },
      },
      parts: [
        {
          id: "part-user-1",
          type: "text",
          text: "hello",
        },
      ],
    },
    {
      info: {
        id: "assistant-1",
        role: "assistant",
        parentID: "user-1",
        providerID: "openai",
        modelID: "gpt-4.1",
        finish: "stop",
        time: {
          created: 1_700_000_200,
        },
      },
      parts: [
        {
          id: "part-assistant-1",
          type: "text",
          text: "hi",
        },
      ],
    },
  ];
}

function createServiceClientDouble(): OpenCodeServiceClientDouble {
  const sessionList = vi.fn<SessionListFunction>();
  sessionList.mockResolvedValue(
    createResponseEnvelope([
      createSessionRecord(
        "session-1",
        "Test Session",
        "/tmp/project",
        1_700_000_000,
        1_700_000_900,
      ),
    ]),
  );

  const sessionCreate = vi.fn<SessionCreateFunction>();
  sessionCreate.mockResolvedValue(
    createResponseEnvelope(
      createSessionRecord(
        "session-created",
        "Created Session",
        "/tmp/project",
        1_700_001_000,
        1_700_001_001,
      ),
    ),
  );

  const sessionGet = vi.fn<SessionReadFunction>();
  sessionGet.mockResolvedValue(
    createResponseEnvelope(
      createSessionRecord(
        "session-1",
        "State Session",
        "/tmp/project",
        1_700_000_000,
        1_700_000_900,
      ),
    ),
  );

  const sessionMessages = vi.fn<SessionReadFunction>();
  sessionMessages.mockResolvedValue(createResponseEnvelope(createMessageRecords()));

  const sessionPrompt = vi.fn<SessionPromptFunction>();
  sessionPrompt.mockResolvedValue(createResponseEnvelope());

  const sessionAbort = vi.fn<SessionReadFunction>();
  sessionAbort.mockResolvedValue(createResponseEnvelope());

  const sessionDelete = vi.fn<SessionReadFunction>();
  sessionDelete.mockResolvedValue(createResponseEnvelope());

  const projectList = vi.fn<ProjectListFunction>();
  projectList.mockResolvedValue(
    createResponseEnvelope([{ worktree: "  /tmp/project-a  " }, { worktree: "/tmp/project-b" }]),
  );

  const client: OpenCodeMonitorClient = {
    session: {
      list: sessionList,
      create: sessionCreate,
      get: sessionGet,
      messages: sessionMessages,
      prompt: sessionPrompt,
      abort: sessionAbort,
      delete: sessionDelete,
    },
    project: {
      list: projectList,
    },
  };

  return {
    provider: {
      getClient: () => client,
    },
    sessionList,
    sessionCreate,
    sessionGet,
    sessionMessages,
    sessionPrompt,
    sessionAbort,
    sessionDelete,
    projectList,
  };
}

describe("OpenCodeMonitorService", () => {
  it("maps session list results and normalizes directory input", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    const result = await service.listSessions({
      directory: "  /tmp/project  ",
    });

    expect(clientDouble.sessionList).toHaveBeenCalledWith({
      query: {
        directory: "/tmp/project",
      },
    });
    expect(result.data).toEqual([
      {
        id: "session-1",
        preview: "Test Session",
        createdAt: 1_700_000_000,
        updatedAt: 1_700_000_900,
        cwd: "/tmp/project",
        source: "opencode",
      },
    ]);
  });

  it("rejects blank listSessions directory at boundary parse", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await expect(
      service.listSessions({
        directory: "    ",
      }),
    ).rejects.toThrow();

    expect(clientDouble.sessionList).not.toHaveBeenCalled();
  });

  it("maps and trims project directories", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    const directories = await service.listProjectDirectories();

    expect(directories).toEqual(["/tmp/project-a", "/tmp/project-b"]);
  });

  it("rejects whitespace-only project worktree values", async () => {
    const clientDouble = createServiceClientDouble();
    clientDouble.projectList.mockResolvedValue(createResponseEnvelope([{ worktree: "   " }]));
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await expect(service.listProjectDirectories()).rejects.toThrow();
  });

  it("builds createSession request from parsed input and maps response", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    const result = await service.createSession({
      title: "  Created Session  ",
      directory: "  /tmp/project  ",
    });

    expect(clientDouble.sessionCreate).toHaveBeenCalledWith({
      body: {
        title: "Created Session",
      },
      query: {
        directory: "/tmp/project",
      },
    });
    expect(result.threadId).toBe("session-created");
    expect(result.mapped.preview).toBe("Created Session");
  });

  it("rejects blank createSession title", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await expect(
      service.createSession({
        title: "   ",
      }),
    ).rejects.toThrow();

    expect(clientDouble.sessionCreate).not.toHaveBeenCalled();
  });

  it("maps session state from session and message payloads", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    const state = await service.getSessionState("  session-1  ", "  /tmp/project  ");

    expect(clientDouble.sessionGet).toHaveBeenCalledWith({
      path: {
        id: "session-1",
      },
      query: {
        directory: "/tmp/project",
      },
    });
    expect(clientDouble.sessionMessages).toHaveBeenCalledWith({
      path: {
        id: "session-1",
      },
      query: {
        directory: "/tmp/project",
      },
    });
    expect(state.id).toBe("session-1");
    expect(state.latestModel).toBe("openai/gpt-4.1");
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].status).toBe("completed");
    expect(state.turns[0].items.map((item) => item.type)).toEqual(["userMessage", "agentMessage"]);
  });

  it("maps getSession request using parsed identifiers", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    const session = await service.getSession("  session-1  ", "  /tmp/project  ");

    expect(clientDouble.sessionGet).toHaveBeenCalledWith({
      path: {
        id: "session-1",
      },
      query: {
        directory: "/tmp/project",
      },
    });
    expect(session.id).toBe("session-1");
    expect(session.directory).toBe("/tmp/project");
  });

  it("rejects blank getSession session identifier", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await expect(service.getSession("   ")).rejects.toThrow();

    expect(clientDouble.sessionGet).not.toHaveBeenCalled();
  });

  it("validates sendMessage input and maps prompt payload", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await service.sendMessage({
      sessionId: "  session-1  ",
      text: "  hello world  ",
      directory: "  /tmp/project  ",
    });

    expect(clientDouble.sessionPrompt).toHaveBeenCalledWith({
      path: {
        id: "session-1",
      },
      query: {
        directory: "/tmp/project",
      },
      body: {
        parts: [
          {
            type: "text",
            text: "hello world",
          },
        ],
      },
    });
  });

  it("rejects blank sendMessage text before invoking client", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await expect(
      service.sendMessage({
        sessionId: "session-1",
        text: "    ",
      }),
    ).rejects.toThrow("Message text is required");

    expect(clientDouble.sessionPrompt).not.toHaveBeenCalled();
  });

  it("maps abort and delete requests using parsed identifiers", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await service.abort("  session-1  ", "  /tmp/project  ");
    await service.deleteSession("  session-1  ", "  /tmp/project  ");

    expect(clientDouble.sessionAbort).toHaveBeenCalledWith({
      path: {
        id: "session-1",
      },
      query: {
        directory: "/tmp/project",
      },
    });
    expect(clientDouble.sessionDelete).toHaveBeenCalledWith({
      path: {
        id: "session-1",
      },
      query: {
        directory: "/tmp/project",
      },
    });
  });

  it("rejects blank abort session identifier", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await expect(service.abort("   ")).rejects.toThrow();

    expect(clientDouble.sessionAbort).not.toHaveBeenCalled();
  });

  it("rejects blank deleteSession session identifier", async () => {
    const clientDouble = createServiceClientDouble();
    const service = new OpenCodeMonitorService(clientDouble.provider);

    await expect(service.deleteSession("   ")).rejects.toThrow();

    expect(clientDouble.sessionDelete).not.toHaveBeenCalled();
  });
});
