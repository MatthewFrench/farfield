import {
  type AppServerCollaborationModeListResponse,
  AppServerCollaborationModeListResponseSchema,
  type AppServerConfigReadResponse,
  AppServerConfigReadResponseSchema,
  type JsonValue,
  type AppServerListModelsResponse,
  AppServerListModelsResponseSchema,
  type AppServerListThreadsResponse,
  AppServerListThreadsResponseSchema,
  type AppServerReadThreadResponse,
  AppServerReadThreadResponseSchema,
  AppServerSendUserMessageRequestSchema,
  AppServerSendUserMessageResponseSchema,
  AppServerThreadListItemSchema,
  type AppServerStartThreadResponse,
  AppServerStartThreadRequestSchema,
  AppServerStartThreadResponseSchema
} from "@farfield/protocol";
import { ProtocolValidationError } from "@farfield/protocol";
import { z } from "zod";
import {
  type AppServerTransport,
  ChildProcessAppServerTransport,
  type ChildProcessAppServerTransportOptions,
  isChildProcessAppServerTransportOptions
} from "./AppServerTransport.js";

const AppServerMethod = {
  listThreads: "thread/list",
  readThread: "thread/read",
  listModels: "model/list",
  listCollaborationModes: "collaborationMode/list",
  readConfig: "config/read",
  startThread: "thread/start",
  sendUserMessage: "sendUserMessage",
  resumeThread: "thread/resume",
  archiveThread: "thread/archive",
  unarchiveThread: "thread/unarchive"
} as const;

const AppServerResponseContext = {
  listThreads: "AppServerListThreadsResponse",
  readThread: "AppServerReadThreadResponse",
  listModels: "AppServerListModelsResponse",
  listCollaborationModes: "AppServerCollaborationModeListResponse",
  readConfig: "AppServerConfigReadResponse",
  startThread: "AppServerStartThreadResponse",
  sendUserMessage: "AppServerSendUserMessageResponse",
  resumeThread: "AppServerResumeThreadResponse",
  archiveThread: "AppServerArchiveThreadResponse",
  unarchiveThread: "AppServerUnarchiveThreadResponse"
} as const;

const DEFAULT_LIST_MODELS_LIMIT = 100;
const DEFAULT_READ_CONFIG_INCLUDE_LAYERS = false;
const DEFAULT_RESUME_THREAD_PERSIST_EXTENDED_HISTORY = true;
// Reading turns can include full conversation history and is expected to take longer than lightweight reads.
const READ_THREAD_WITH_TURNS_TIMEOUT_MS = 90_000;

function parseWithSchema<SchemaType extends z.ZodTypeAny>(
  schema: SchemaType,
  value: JsonValue,
  context: string
): z.infer<SchemaType> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw ProtocolValidationError.fromZod(context, parsed.error);
  }
  return parsed.data;
}

export interface ListThreadsOptions {
  limit: number;
  archived: boolean;
  cursor?: string;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

export interface ListThreadsAllOptions {
  limit: number;
  archived: boolean;
  cursor?: string;
  maxPages: number;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

export interface StartThreadOptions {
  cwd: string;
  model?: string;
  modelProvider?: string;
  personality?: string;
  sandbox?: string;
  approvalPolicy?: string;
  ephemeral?: boolean;
}

export interface ReadConfigOptions {
  includeLayers?: boolean;
}

export interface ResumeThreadOptions {
  persistExtendedHistory?: boolean;
}

interface ListThreadsRequestParameters {
  limit: number;
  archived: boolean;
  cursor: string | null;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

function buildListThreadsRequestParameters(
  options: Pick<ListThreadsOptions, "limit" | "archived" | "cursor" | "sortKey" | "cwd">
): ListThreadsRequestParameters {
  return {
    limit: options.limit,
    archived: options.archived,
    cursor: options.cursor ?? null,
    ...(options.sortKey ? { sortKey: options.sortKey } : {}),
    ...(options.cwd ? { cwd: options.cwd } : {})
  };
}

function buildListThreadsAllPageOptions(
  options: ListThreadsAllOptions,
  cursor: string | undefined
): ListThreadsOptions {
  return {
    limit: options.limit,
    archived: options.archived,
    ...(cursor ? { cursor } : {}),
    ...(options.sortKey ? { sortKey: options.sortKey } : {}),
    ...(options.cwd ? { cwd: options.cwd } : {})
  };
}

const AppServerResumeThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
    persistExtendedHistory: z.boolean()
  })
  .passthrough();
const AppServerArchiveThreadRequestSchema = z
  .object({
    threadId: z.string().min(1)
  })
  .passthrough();
const AppServerArchiveThreadResponseSchema = z.object({}).passthrough();
const AppServerUnarchiveThreadRequestSchema = z
  .object({
    threadId: z.string().min(1)
  })
  .passthrough();
const AppServerUnarchiveThreadResponseSchema = z
  .object({
    thread: AppServerThreadListItemSchema
  })
  .passthrough();

/**
 * Owns typed request/response mapping for Codex app-server RPC methods.
 * Transport concerns stay in `AppServerTransport`; schema enforcement stays here.
 */
export class AppServerClient {
  private readonly transport: AppServerTransport;

  public constructor(transportOrOptions: AppServerTransport | ChildProcessAppServerTransportOptions) {
    if (isChildProcessAppServerTransportOptions(transportOrOptions)) {
      this.transport = new ChildProcessAppServerTransport(transportOrOptions);
      return;
    }

    this.transport = transportOrOptions;
  }

  public async close(): Promise<void> {
    await this.transport.close();
  }

  public async listThreads(options: ListThreadsOptions): Promise<AppServerListThreadsResponse> {
    const result = await this.transport.request(
      AppServerMethod.listThreads,
      buildListThreadsRequestParameters(options)
    );

    return parseWithSchema(
      AppServerListThreadsResponseSchema,
      result,
      AppServerResponseContext.listThreads
    );
  }

  public async listThreadsAll(options: ListThreadsAllOptions): Promise<AppServerListThreadsResponse> {
    const listItems: AppServerListThreadsResponse["data"] = [];

    let cursor = options.cursor;
    let pages = 0;

    while (pages < options.maxPages) {
      const page = await this.listThreads(buildListThreadsAllPageOptions(options, cursor));

      listItems.push(...page.data);
      pages += 1;

      const nextCursor = page.nextCursor ?? null;
      // Empty page data with a cursor is treated as terminal to avoid looping on a non-advancing cursor.
      if (!nextCursor || page.data.length === 0) {
        return {
          data: listItems,
          nextCursor: null,
          pages,
          truncated: false
        };
      }

      cursor = nextCursor;
    }

    return {
      data: listItems,
      nextCursor: cursor ?? null,
      pages,
      truncated: true
    };
  }

  public async readThread(threadId: string, includeTurns = true): Promise<AppServerReadThreadResponse> {
    const timeoutMilliseconds = includeTurns ? READ_THREAD_WITH_TURNS_TIMEOUT_MS : undefined;
    const result = await this.transport.request(
      AppServerMethod.readThread,
      {
        threadId,
        includeTurns
      },
      timeoutMilliseconds
    );

    return parseWithSchema(AppServerReadThreadResponseSchema, result, AppServerResponseContext.readThread);
  }

  public async listModels(limit = DEFAULT_LIST_MODELS_LIMIT): Promise<AppServerListModelsResponse> {
    const result = await this.transport.request(AppServerMethod.listModels, { limit });
    return parseWithSchema(AppServerListModelsResponseSchema, result, AppServerResponseContext.listModels);
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    const result = await this.transport.request(AppServerMethod.listCollaborationModes, {});
    return parseWithSchema(
      AppServerCollaborationModeListResponseSchema,
      result,
      AppServerResponseContext.listCollaborationModes
    );
  }

  public async readConfig(options?: ReadConfigOptions): Promise<AppServerConfigReadResponse> {
    const result = await this.transport.request(AppServerMethod.readConfig, {
      includeLayers: options?.includeLayers ?? DEFAULT_READ_CONFIG_INCLUDE_LAYERS
    });
    return parseWithSchema(AppServerConfigReadResponseSchema, result, AppServerResponseContext.readConfig);
  }

  public async startThread(options: StartThreadOptions): Promise<AppServerStartThreadResponse> {
    const request = AppServerStartThreadRequestSchema.parse(options);
    const result = await this.transport.request(AppServerMethod.startThread, request);
    return parseWithSchema(AppServerStartThreadResponseSchema, result, AppServerResponseContext.startThread);
  }

  public async sendUserMessage(threadId: string, text: string): Promise<void> {
    const request = AppServerSendUserMessageRequestSchema.parse({
      conversationId: threadId,
      items: [
        {
          type: "text",
          data: {
            text
          }
        }
      ]
    });
    const result = await this.transport.request(AppServerMethod.sendUserMessage, request);
    parseWithSchema(
      AppServerSendUserMessageResponseSchema,
      result,
      AppServerResponseContext.sendUserMessage
    );
  }

  public async resumeThread(
    threadId: string,
    options?: ResumeThreadOptions
  ): Promise<AppServerReadThreadResponse> {
    const request = AppServerResumeThreadRequestSchema.parse({
      threadId,
      persistExtendedHistory:
        options?.persistExtendedHistory ?? DEFAULT_RESUME_THREAD_PERSIST_EXTENDED_HISTORY
    });
    const result = await this.transport.request(AppServerMethod.resumeThread, request);
    return parseWithSchema(AppServerReadThreadResponseSchema, result, AppServerResponseContext.resumeThread);
  }

  public async archiveThread(threadId: string): Promise<void> {
    const request = AppServerArchiveThreadRequestSchema.parse({
      threadId
    });
    const result = await this.transport.request(AppServerMethod.archiveThread, request);
    parseWithSchema(AppServerArchiveThreadResponseSchema, result, AppServerResponseContext.archiveThread);
  }

  public async unarchiveThread(threadId: string): Promise<AppServerStartThreadResponse["thread"]> {
    const request = AppServerUnarchiveThreadRequestSchema.parse({
      threadId
    });
    const result = await this.transport.request(AppServerMethod.unarchiveThread, request);
    const parsed = parseWithSchema(
      AppServerUnarchiveThreadResponseSchema,
      result,
      AppServerResponseContext.unarchiveThread
    );
    return parsed.thread;
  }
}
