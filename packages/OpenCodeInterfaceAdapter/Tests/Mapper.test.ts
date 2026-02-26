import { describe, expect, it } from "vitest";
import {
  sessionToThreadListItem,
  sessionToConversationState
} from "../Source/SessionMapper.js";
import { messagesToTurns } from "../Source/ConversationTurnMapper.js";
import { partToTurnItem } from "../Source/TurnItemMapper.js";
import {
  OpenCodeMessageSchema,
  OpenCodePartSchema,
  parseOpenCodeSession,
  type OpenCodeMessage,
  type OpenCodePart,
  type OpenCodeSession,
  type OpenCodeStructuredDataValue
} from "../Source/Schemas.js";

interface RunningToolPartStateInput {
  status: "running";
  input: Record<string, OpenCodeStructuredDataValue>;
}

interface CompletedToolPartStateInput {
  status: "completed";
  input: Record<string, OpenCodeStructuredDataValue>;
  output?: string;
  metadata?: Record<string, OpenCodeStructuredDataValue>;
}

interface ErrorToolPartStateInput {
  status: "error";
  input: Record<string, OpenCodeStructuredDataValue>;
  error?: string;
  metadata?: Record<string, OpenCodeStructuredDataValue>;
}

type ToolPartStateInput =
  | RunningToolPartStateInput
  | CompletedToolPartStateInput
  | ErrorToolPartStateInput;

function makeSession(overrides: Partial<OpenCodeSession> = {}): OpenCodeSession {
  return parseOpenCodeSession({
    id: "sess-1",
    title: "Test Session",
    directory: "/tmp/project",
    time: { created: 1700000000, updated: 1700001000 },
    ...overrides
  });
}

interface UserMessageOptions {
  createdAt?: number;
}

function makeUserMessage(id: string, options: UserMessageOptions = {}): OpenCodeMessage {
  return OpenCodeMessageSchema.parse({
    id,
    role: "user",
    sessionID: "sess-1",
    parentID: "root",
    time: { created: options.createdAt ?? 1700000100 }
  });
}

interface AssistantMessageOptions {
  createdAt?: number;
  providerID?: string;
  modelID?: string;
  finish?: string;
  error?: OpenCodeStructuredDataValue;
}

function makeAssistantMessage(
  id: string,
  parentID: string,
  options: AssistantMessageOptions = {}
): OpenCodeMessage {
  return OpenCodeMessageSchema.parse({
    id,
    role: "assistant",
    sessionID: "sess-1",
    parentID,
    providerID: options.providerID ?? "anthropic",
    modelID: options.modelID ?? "claude-sonnet",
    ...(options.finish !== undefined ? { finish: options.finish } : {}),
    ...(options.error !== undefined ? { error: options.error } : {}),
    time: { created: options.createdAt ?? 1700000200 }
  });
}

function makeTextPart(id: string, text: string): OpenCodePart {
  return OpenCodePartSchema.parse({ id, type: "text", text });
}

function makeReasoningPart(id: string, text: string): OpenCodePart {
  return OpenCodePartSchema.parse({ id, type: "reasoning", text });
}

function makeToolPart(
  id: string,
  tool: string,
  state: ToolPartStateInput
): OpenCodePart {
  if (state.status === "running") {
    return OpenCodePartSchema.parse({
      id,
      type: "tool",
      tool,
      state: {
        status: "running",
        input: state.input,
        time: { start: 1700000100 }
      }
    });
  }

  if (state.status === "completed") {
    return OpenCodePartSchema.parse({
      id,
      type: "tool",
      tool,
      state: {
        status: "completed",
        input: state.input,
        output: state.output ?? "",
        ...(state.metadata !== undefined ? { metadata: state.metadata } : {}),
        time: { start: 1700000100, end: 1700000200 }
      }
    });
  }

  return OpenCodePartSchema.parse({
    id,
    type: "tool",
    tool,
    state: {
      status: "error",
      input: state.input,
      error: state.error ?? "tool execution failed",
      ...(state.metadata !== undefined ? { metadata: state.metadata } : {}),
      time: { start: 1700000100, end: 1700000200 }
    }
  });
}

describe("sessionToThreadListItem", () => {
  it("maps session fields correctly", () => {
    const session = makeSession();
    const result = sessionToThreadListItem(session);

    expect(result.id).toBe("sess-1");
    expect(result.preview).toBe("Test Session");
    expect(result.createdAt).toBe(1700000000);
    expect(result.updatedAt).toBe(1700001000);
    expect(result.cwd).toBe("/tmp/project");
    expect(result.source).toBe("opencode");
  });

  it("uses (untitled) for sessions without title", () => {
    const session = makeSession({ title: "" });
    const result = sessionToThreadListItem(session);
    expect(result.preview).toBe("(untitled)");
  });

  it("uses (untitled) for sessions with whitespace-only title", () => {
    const session = makeSession({ title: "   " });
    const result = sessionToThreadListItem(session);
    expect(result.preview).toBe("(untitled)");
  });
});

describe("messagesToTurns", () => {
  it("pairs user and assistant messages into turns", () => {
    const userMessage = makeUserMessage("u1");
    const assistantMessage = makeAssistantMessage("a1", "u1");
    const messages: OpenCodeMessage[] = [userMessage, assistantMessage];

    const partsByMessage = new Map<string, OpenCodePart[]>();
    partsByMessage.set("u1", [makeTextPart("p1", "hello")]);
    partsByMessage.set("a1", [makeTextPart("p2", "hi there")]);

    const turns = messagesToTurns(messages, partsByMessage);

    expect(turns).toHaveLength(1);
    expect(turns[0].items).toHaveLength(2);
    expect(turns[0].items[0].type).toBe("userMessage");
    expect(turns[0].items[1].type).toBe("agentMessage");
  });

  it("creates a turn for user message without assistant response", () => {
    const userMessage = makeUserMessage("u1");
    const messages: OpenCodeMessage[] = [userMessage];

    const partsByMessage = new Map<string, OpenCodePart[]>();
    partsByMessage.set("u1", [makeTextPart("p1", "hello")]);

    const turns = messagesToTurns(messages, partsByMessage);

    expect(turns).toHaveLength(1);
    expect(turns[0].items).toHaveLength(1);
    expect(turns[0].items[0].type).toBe("userMessage");
    expect(turns[0].status).toBe("pending");
  });

  it("uses newest assistant by created timestamp for each user message", () => {
    const userMessage = makeUserMessage("u1");
    const newestAssistant = makeAssistantMessage("a-new", "u1", {
      createdAt: 1700000500,
      finish: "stop"
    });
    const olderAssistant = makeAssistantMessage("a-old", "u1", {
      createdAt: 1700000400
    });
    const messages: OpenCodeMessage[] = [userMessage, newestAssistant, olderAssistant];

    const partsByMessage = new Map<string, OpenCodePart[]>();
    partsByMessage.set("u1", [makeTextPart("p-user", "hello")]);
    partsByMessage.set("a-new", [makeTextPart("p-new", "latest reply")]);
    partsByMessage.set("a-old", [makeTextPart("p-old", "stale reply")]);

    const turns = messagesToTurns(messages, partsByMessage);

    expect(turns).toHaveLength(1);
    expect(turns[0].turnId).toBe("a-new");
    expect(turns[0].status).toBe("completed");
    expect(turns[0].items).toHaveLength(2);
    const assistantItem = turns[0].items[1];
    if (assistantItem.type !== "agentMessage") {
      throw new Error("Expected an agentMessage item");
    }
    expect(assistantItem.text).toBe("latest reply");
  });

  it("uses a deterministic identifier tie-break when assistant timestamps match", () => {
    const userMessage = makeUserMessage("u1");
    const assistantWithHigherId = makeAssistantMessage("a-z", "u1", {
      createdAt: 1700000400
    });
    const assistantWithLowerId = makeAssistantMessage("a-a", "u1", {
      createdAt: 1700000400
    });
    const messages: OpenCodeMessage[] = [
      userMessage,
      assistantWithLowerId,
      assistantWithHigherId
    ];

    const partsByMessage = new Map<string, OpenCodePart[]>();
    partsByMessage.set("u1", [makeTextPart("p-user", "hello")]);
    partsByMessage.set("a-z", [makeTextPart("p-z", "kept")]);
    partsByMessage.set("a-a", [makeTextPart("p-a", "discarded")]);

    const turns = messagesToTurns(messages, partsByMessage);
    expect(turns[0].turnId).toBe("a-z");
    const assistantItem = turns[0].items[1];
    if (assistantItem.type !== "agentMessage") {
      throw new Error("Expected an agentMessage item");
    }
    expect(assistantItem.text).toBe("kept");
  });
});

describe("partToTurnItem", () => {
  it("maps text part to agentMessage", () => {
    const part = makeTextPart("p1", "Hello world");
    const result = partToTurnItem(part);

    expect(result).not.toBeNull();
    if (result === null || result.type !== "agentMessage") {
      throw new Error("Expected an agentMessage item");
    }
    expect(result.text).toBe("Hello world");
  });

  it("maps reasoning part", () => {
    const part = makeReasoningPart("p1", "thinking about it...");
    const result = partToTurnItem(part);

    expect(result).not.toBeNull();
    if (result === null || result.type !== "reasoning") {
      throw new Error("Expected a reasoning item");
    }
    expect(result.text).toBe("thinking about it...");
  });

  it("maps bash tool part to commandExecution", () => {
    const part = makeToolPart("p1", "bash", {
      status: "completed",
      input: { command: "ls -la", cwd: "/tmp" },
      output: "file1.txt\nfile2.txt"
    });
    const result = partToTurnItem(part);

    expect(result).not.toBeNull();
    if (result === null || result.type !== "commandExecution") {
      throw new Error("Expected a commandExecution item");
    }
    expect(result.command).toBe("ls -la");
    expect(result.cwd).toBe("/tmp");
    expect(result.aggregatedOutput).toBe("file1.txt\nfile2.txt");
  });

  it("maps write tool part to fileChange", () => {
    const part = makeToolPart("p1", "write", {
      status: "completed",
      input: { file_path: "/tmp/foo.ts" },
      output: "wrote 50 lines"
    });
    const result = partToTurnItem(part);

    expect(result).not.toBeNull();
    if (result === null || result.type !== "fileChange") {
      throw new Error("Expected a fileChange item");
    }
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].path).toBe("/tmp/foo.ts");
    expect(result.changes[0].kind.type).toBe("created");
  });

  it("maps edit tool part to fileChange with modified kind", () => {
    const part = makeToolPart("p1", "edit", {
      status: "completed",
      input: { path: "/tmp/bar.ts" },
      output: "updated file"
    });
    const result = partToTurnItem(part);

    expect(result).not.toBeNull();
    if (result === null || result.type !== "fileChange") {
      throw new Error("Expected a fileChange item");
    }
    expect(result.changes[0].kind.type).toBe("modified");
  });

  it("uses unknown path placeholder when file-edit tool input has no path", () => {
    const part = makeToolPart("p1", "write", {
      status: "completed",
      input: {},
      output: "created file"
    });
    const result = partToTurnItem(part);

    expect(result).not.toBeNull();
    if (result === null || result.type !== "fileChange") {
      throw new Error("Expected a fileChange item");
    }
    expect(result.changes[0].path).toBe("(unknown)");
  });

  it("throws when command input type does not match contract", () => {
    const part = makeToolPart("p1", "bash", {
      status: "completed",
      input: { command: 42 },
      output: "done"
    });

    expect(() => partToTurnItem(part)).toThrow(/command/i);
  });

  it("throws when exit_code metadata type does not match contract", () => {
    const part = makeToolPart("p1", "bash", {
      status: "completed",
      input: { command: "echo ok" },
      output: "ok",
      metadata: { exit_code: "0" }
    });

    expect(() => partToTurnItem(part)).toThrow(/exit_code/i);
  });
});

describe("sessionToConversationState", () => {
  it("builds full conversation state", () => {
    const session = makeSession();
    const userMessage = makeUserMessage("u1");
    const assistantMessage = makeAssistantMessage("a1", "u1");
    const messages: OpenCodeMessage[] = [userMessage, assistantMessage];

    const partsByMessage = new Map<string, OpenCodePart[]>();
    partsByMessage.set("u1", [makeTextPart("p1", "hello")]);
    partsByMessage.set("a1", [makeTextPart("p2", "hi there")]);

    const state = sessionToConversationState(session, messages, partsByMessage);

    expect(state.id).toBe("sess-1");
    expect(state.turns).toHaveLength(1);
    expect(state.requests).toEqual([]);
    expect(state.title).toBe("Test Session");
    expect(state.latestModel).toBe("anthropic/claude-sonnet");
    expect(state.source).toBe("opencode");
  });

  it("normalizes whitespace-only session title to null", () => {
    const session = makeSession({ title: "  " });
    const userMessage = makeUserMessage("u1");
    const messages: OpenCodeMessage[] = [userMessage];
    const partsByMessage = new Map<string, OpenCodePart[]>();
    partsByMessage.set("u1", [makeTextPart("p1", "hello")]);

    const state = sessionToConversationState(session, messages, partsByMessage);
    expect(state.title).toBeNull();
  });

  it("uses the newest assistant message to derive latest model", () => {
    const session = makeSession();
    const userMessage = makeUserMessage("u1");
    const newestAssistant = makeAssistantMessage("a-new", "u1", {
      createdAt: 1700000600,
      providerID: "openai",
      modelID: "gpt-4.1"
    });
    const olderAssistant = makeAssistantMessage("a-old", "u1", {
      createdAt: 1700000500,
      providerID: "anthropic",
      modelID: "claude-sonnet"
    });
    const messages: OpenCodeMessage[] = [userMessage, newestAssistant, olderAssistant];

    const partsByMessage = new Map<string, OpenCodePart[]>();
    partsByMessage.set("u1", [makeTextPart("p1", "hello")]);
    partsByMessage.set("a-new", [makeTextPart("p2", "latest")]);
    partsByMessage.set("a-old", [makeTextPart("p3", "older")]);

    const state = sessionToConversationState(session, messages, partsByMessage);

    expect(state.latestModel).toBe("openai/gpt-4.1");
    expect(state.turns[0].turnId).toBe("a-new");
  });
});
