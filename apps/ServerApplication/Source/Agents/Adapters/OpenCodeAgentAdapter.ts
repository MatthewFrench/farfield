import fs from "node:fs";
import path from "node:path";
import {
  OpenCodeConnection,
  OpenCodeMonitorService,
  type MappedThreadListItem
} from "@farfield/opencode-api";
import {
  AppServerThreadListItemSchema,
  JsonValueSchema,
  parseThreadConversationState
} from "@farfield/protocol";
import { z } from "zod";
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentCreateThreadInput,
  AgentCreateThreadResult,
  AgentInterruptInput,
  AgentListThreadsInput,
  AgentListThreadsResult,
  AgentReadThreadInput,
  AgentReadThreadResult,
  AgentSendMessageInput
} from "../Types.js";

export interface OpenCodeAgentOptions {
  url?: string;
  port?: number;
}

const OPEN_CODE_NOT_CONNECTED_ERROR_MESSAGE = "OpenCode backend is not connected";
const DIRECTORY_REQUIRED_ERROR_MESSAGE = "Directory is required";
const DIRECTORY_DOES_NOT_EXIST_ERROR_PREFIX = "Directory does not exist";
const PATH_IS_NOT_DIRECTORY_ERROR_PREFIX = "Path is not a directory";

const OPEN_CODE_THREAD_CURSOR_VERSION = 1;
const UTF8_ENCODING = "utf8";
const BASE64_URL_ENCODING = "base64url";

const OpenCodeThreadCursorSchema = z
  .object({
    version: z.literal(OPEN_CODE_THREAD_CURSOR_VERSION),
    offset: z.number().int().nonnegative()
  })
  .strict();

function encodeOpenCodeThreadCursor(offset: number): string {
  return Buffer.from(
    JSON.stringify({
      version: OPEN_CODE_THREAD_CURSOR_VERSION,
      offset
    }),
    UTF8_ENCODING
  ).toString(BASE64_URL_ENCODING);
}

function decodeOpenCodeThreadCursor(cursor: string | null): number {
  if (cursor === null || cursor.length === 0) {
    return 0;
  }

  const decodedPayload = Buffer.from(cursor, BASE64_URL_ENCODING).toString(UTF8_ENCODING);
  const parsedJson = JSON.parse(decodedPayload);
  const parsedCursor = OpenCodeThreadCursorSchema.parse(parsedJson);
  return parsedCursor.offset;
}

export class OpenCodeAgentAdapter implements AgentAdapter {
  public readonly id = "opencode";
  public readonly label = "OpenCode";
  public readonly capabilities: AgentCapabilities = {
    canListModels: false,
    canListCollaborationModes: false,
    canSetCollaborationMode: false,
    canSubmitUserInput: false,
    canReadLiveState: false,
    canReadStreamEvents: false
  };

  private readonly connection: OpenCodeConnection;
  private readonly service: OpenCodeMonitorService;
  private readonly threadDirectoryById = new Map<string, string>();

  public constructor(options: OpenCodeAgentOptions = {}) {
    this.connection = new OpenCodeConnection({
      ...(options.url !== undefined && options.url.length > 0 ? { url: options.url } : {}),
      ...(options.port !== undefined ? { port: options.port } : {})
    });
    this.service = new OpenCodeMonitorService(this.connection);
  }

  public getUrl(): string | null {
    return this.connection.getUrl();
  }

  public isEnabled(): boolean {
    return true;
  }

  public isConnected(): boolean {
    return this.connection.isConnected();
  }

  public async start(): Promise<void> {
    await this.connection.start();
  }

  public async stop(): Promise<void> {
    await this.connection.stop();
  }

  public async listThreads(input: AgentListThreadsInput): Promise<AgentListThreadsResult> {
    this.ensureConnected();
    if (input.archived) {
      return createEmptyThreadListResult();
    }

    const sessions = await this.readSessions(input.cwd);

    const mappedData = Array.from(sessions.values())
      .map((session) => AppServerThreadListItemSchema.parse(session))
      .sort((left, right) => compareThreadsBySortKey(left, right, input.sortKey));

    const cursorOffset = decodeOpenCodeThreadCursor(input.cursor);
    if (cursorOffset >= mappedData.length) {
      return createEmptyThreadListResult();
    }

    if (!input.all) {
      const pageData = mappedData.slice(cursorOffset, cursorOffset + input.limit);
      const nextOffset = cursorOffset + pageData.length;
      const nextCursor = nextOffset < mappedData.length
        ? encodeOpenCodeThreadCursor(nextOffset)
        : null;
      return {
        data: pageData,
        nextCursor,
        pages: pageData.length > 0 ? 1 : 0,
        truncated: nextCursor !== null
      };
    }

    const maxItems = input.limit * input.maxPages;
    const pageData = mappedData.slice(cursorOffset, cursorOffset + maxItems);
    const nextOffset = cursorOffset + pageData.length;
    const nextCursor = nextOffset < mappedData.length
      ? encodeOpenCodeThreadCursor(nextOffset)
      : null;

    return {
      data: pageData,
      nextCursor,
      pages: pageData.length === 0 ? 0 : Math.ceil(pageData.length / input.limit),
      truncated: nextCursor !== null
    };
  }

  public async createThread(input: AgentCreateThreadInput): Promise<AgentCreateThreadResult> {
    this.ensureConnected();

    const directory = input.cwd !== undefined ? normalizeDirectoryInput(input.cwd) : undefined;
    const result = await this.service.createSession({
      ...(input.model !== undefined ? { title: input.model } : {}),
      ...(directory !== undefined && directory.length > 0 ? { directory } : {})
    });

    if (hasTrimmedText(result.mapped.cwd)) {
      this.cacheThreadDirectory(result.threadId, result.mapped.cwd);
    } else if (directory !== undefined && directory.length > 0) {
      this.threadDirectoryById.set(result.threadId, directory);
    }

    const mappedThread = AppServerThreadListItemSchema.parse(result.mapped);

    return {
      threadId: result.threadId,
      thread: mappedThread,
      cwd: mappedThread.cwd
    };
  }

  public async readThread(input: AgentReadThreadInput): Promise<AgentReadThreadResult> {
    this.ensureConnected();

    const directory = this.resolveThreadDirectory(input.threadId);
    const state = await this.service.getSessionState(input.threadId, directory);

    this.cacheThreadDirectory(input.threadId, state.cwd);

    return {
      thread: parseThreadConversationState(JsonValueSchema.parse(state))
    };
  }

  public async sendMessage(input: AgentSendMessageInput): Promise<void> {
    this.ensureConnected();

    const directory = input.cwd !== undefined
      ? normalizeDirectoryInput(input.cwd)
      : this.resolveThreadDirectory(input.threadId);

    await this.service.sendMessage({
      sessionId: input.threadId,
      text: input.text,
      ...(directory !== undefined && directory.length > 0 ? { directory } : {})
    });
  }

  public async interrupt(input: AgentInterruptInput): Promise<void> {
    this.ensureConnected();
    const directory = this.resolveThreadDirectory(input.threadId);
    await this.service.abort(input.threadId, directory);
  }

  public async listProjectDirectories(): Promise<string[]> {
    this.ensureConnected();
    return normalizeDirectoryList(await this.service.listProjectDirectories());
  }

  private ensureConnected(): void {
    if (!this.connection.isConnected()) {
      throw new Error(OPEN_CODE_NOT_CONNECTED_ERROR_MESSAGE);
    }
  }

  private async readSessions(inputDirectory: string | null): Promise<Map<string, MappedThreadListItem>> {
    const directories = await this.resolveSessionDirectories(inputDirectory);
    const sessionMap = new Map<string, MappedThreadListItem>();

    if (directories.length === 0) {
      const result = await this.service.listSessions();
      this.mergeSessions(sessionMap, result.data);
      return sessionMap;
    }

    await Promise.all(
      directories.map(async (directory) => {
        const result = await this.service.listSessions({ directory });
        this.mergeSessions(sessionMap, result.data);
      })
    );

    return sessionMap;
  }

  private async resolveSessionDirectories(inputDirectory: string | null): Promise<string[]> {
    if (hasTrimmedText(inputDirectory)) {
      return [normalizeDirectoryInput(inputDirectory)];
    }
    return this.listProjectDirectories();
  }

  private mergeSessions(
    targetSessionMap: Map<string, MappedThreadListItem>,
    sessions: ReadonlyArray<MappedThreadListItem>
  ): void {
    for (const session of sessions) {
      targetSessionMap.set(session.id, session);
      this.cacheThreadDirectory(session.id, session.cwd);
    }
  }

  private cacheThreadDirectory(threadId: string, directory: string | undefined): void {
    if (!hasTrimmedText(directory)) {
      return;
    }
    // OpenCode can return workspace paths with outer whitespace; trim before caching so later requests reuse a valid path.
    this.threadDirectoryById.set(threadId, resolveDirectoryPath(directory));
  }

  private resolveThreadDirectory(threadId: string): string | undefined {
    const directory = this.threadDirectoryById.get(threadId);
    if (directory === undefined || directory.length === 0) {
      return undefined;
    }
    return path.resolve(directory);
  }
}

function normalizeDirectoryInput(directory: string): string {
  const trimmed = directory.trim();
  if (trimmed.length === 0) {
    throw new Error(DIRECTORY_REQUIRED_ERROR_MESSAGE);
  }

  const resolved = resolveDirectoryPath(trimmed);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${DIRECTORY_DOES_NOT_EXIST_ERROR_PREFIX}: ${resolved}`);
  }
  const stats = fs.statSync(resolved);
  if (!stats.isDirectory()) {
    throw new Error(`${PATH_IS_NOT_DIRECTORY_ERROR_PREFIX}: ${resolved}`);
  }
  return resolved;
}

function normalizeDirectoryList(directories: string[]): string[] {
  const deduped = new Set<string>();
  for (const directory of directories) {
    const normalized = directory.trim();
    if (normalized.length > 0) {
      deduped.add(path.resolve(normalized));
    }
  }
  return Array.from(deduped).sort((left, right) => left.localeCompare(right));
}

function resolveDirectoryPath(directory: string): string {
  return path.resolve(directory.trim());
}

function hasTrimmedText(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value.trim().length > 0;
}

function createEmptyThreadListResult(): AgentListThreadsResult {
  return {
    data: [],
    nextCursor: null,
    pages: 0,
    truncated: false
  };
}

function compareThreadsBySortKey(
  left: AgentListThreadsResult["data"][number],
  right: AgentListThreadsResult["data"][number],
  sortKey: "created_at" | "updated_at"
): number {
  const leftValue = sortKey === "created_at" ? left.createdAt : left.updatedAt;
  const rightValue = sortKey === "created_at" ? right.createdAt : right.updatedAt;
  if (leftValue !== rightValue) {
    return rightValue - leftValue;
  }
  return left.id.localeCompare(right.id);
}
