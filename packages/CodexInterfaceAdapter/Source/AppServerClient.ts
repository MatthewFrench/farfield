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
const READ_THREAD_WITH_TURNS_TIMEOUT_MS = 90_000;

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
    const result = await this.transport.request("thread/list", buildListThreadsRequestParameters(options));

    return parseWithSchema(AppServerListThreadsResponseSchema, result, "AppServerListThreadsResponse");
  }

  public async listThreadsAll(options: ListThreadsAllOptions): Promise<AppServerListThreadsResponse> {
    const listItems: AppServerListThreadsResponse["data"] = [];

    let cursor = options.cursor;
    let pages = 0;

    while (pages < options.maxPages) {
      const page = await this.listThreads({
        limit: options.limit,
        archived: options.archived,
        ...(cursor ? { cursor } : {}),
        ...(options.sortKey ? { sortKey: options.sortKey } : {}),
        ...(options.cwd ? { cwd: options.cwd } : {})
      });

      listItems.push(...page.data);
      pages += 1;

      const nextCursor = page.nextCursor ?? null;
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
    const result = await this.transport.request("thread/read", {
      threadId,
      includeTurns
    }, includeTurns ? READ_THREAD_WITH_TURNS_TIMEOUT_MS : undefined);

    return parseWithSchema(AppServerReadThreadResponseSchema, result, "AppServerReadThreadResponse");
  }

  public async listModels(limit = 100): Promise<AppServerListModelsResponse> {
    const result = await this.transport.request("model/list", { limit });
    return parseWithSchema(AppServerListModelsResponseSchema, result, "AppServerListModelsResponse");
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    const result = await this.transport.request("collaborationMode/list", {});
    return parseWithSchema(
      AppServerCollaborationModeListResponseSchema,
      result,
      "AppServerCollaborationModeListResponse"
    );
  }

  public async readConfig(options?: { includeLayers?: boolean }): Promise<AppServerConfigReadResponse> {
    const result = await this.transport.request("config/read", {
      includeLayers: options?.includeLayers ?? false
    });
    return parseWithSchema(AppServerConfigReadResponseSchema, result, "AppServerConfigReadResponse");
  }

  public async startThread(options: StartThreadOptions): Promise<AppServerStartThreadResponse> {
    const request = AppServerStartThreadRequestSchema.parse(options);
    const result = await this.transport.request("thread/start", request);
    return parseWithSchema(AppServerStartThreadResponseSchema, result, "AppServerStartThreadResponse");
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
    const result = await this.transport.request("sendUserMessage", request);
    parseWithSchema(AppServerSendUserMessageResponseSchema, result, "AppServerSendUserMessageResponse");
  }

  public async resumeThread(
    threadId: string,
    options?: { persistExtendedHistory?: boolean }
  ): Promise<AppServerReadThreadResponse> {
    const request = AppServerResumeThreadRequestSchema.parse({
      threadId,
      persistExtendedHistory: options?.persistExtendedHistory ?? true
    });
    const result = await this.transport.request("thread/resume", request);
    return parseWithSchema(AppServerReadThreadResponseSchema, result, "AppServerResumeThreadResponse");
  }

  public async archiveThread(threadId: string): Promise<void> {
    const request = AppServerArchiveThreadRequestSchema.parse({
      threadId
    });
    const result = await this.transport.request("thread/archive", request);
    parseWithSchema(AppServerArchiveThreadResponseSchema, result, "AppServerArchiveThreadResponse");
  }

  public async unarchiveThread(threadId: string): Promise<AppServerStartThreadResponse["thread"]> {
    const request = AppServerUnarchiveThreadRequestSchema.parse({
      threadId
    });
    const result = await this.transport.request("thread/unarchive", request);
    const parsed = parseWithSchema(
      AppServerUnarchiveThreadResponseSchema,
      result,
      "AppServerUnarchiveThreadResponse"
    );
    return parsed.thread;
  }
}
