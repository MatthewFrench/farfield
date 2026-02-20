import {
  type AppServerCollaborationModeListResponse,
  AppServerCollaborationModeListResponseSchema,
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
  AppServerTransport,
  ChildProcessAppServerTransport,
  type ChildProcessAppServerTransportOptions
} from "./app-server-transport.js";

function parseWithSchema<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
  context: string
): T {
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

const AppServerReasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh"
]);

const AppServerConfigProfileSchema = z
  .object({
    model: z.union([z.string(), z.null()]).optional().default(null),
    model_reasoning_effort: z.union([AppServerReasoningEffortSchema, z.null()]).optional().default(null)
  })
  .passthrough();

const AppServerConfigReadResponseSchema = z
  .object({
    config: z
      .object({
        profile: z.union([z.string(), z.null()]).optional().default(null),
        model: z.union([z.string(), z.null()]).optional().default(null),
        model_reasoning_effort: z.union([AppServerReasoningEffortSchema, z.null()]).optional().default(null),
        profiles: z.record(AppServerConfigProfileSchema).optional().default({})
      })
      .passthrough()
  })
  .passthrough();

export type AppServerConfigReadResponse = z.infer<typeof AppServerConfigReadResponseSchema>;

export class AppServerClient {
  private readonly transport: AppServerTransport;

  public constructor(transportOrOptions: AppServerTransport | ChildProcessAppServerTransportOptions) {
    if ("request" in transportOrOptions && "close" in transportOrOptions) {
      this.transport = transportOrOptions;
      return;
    }

    this.transport = new ChildProcessAppServerTransport(transportOrOptions);
  }

  public async close(): Promise<void> {
    await this.transport.close();
  }

  public async listThreads(options: ListThreadsOptions): Promise<AppServerListThreadsResponse> {
    const result = await this.transport.request("thread/list", {
      limit: options.limit,
      archived: options.archived,
      cursor: options.cursor ?? null,
      ...(options.sortKey ? { sortKey: options.sortKey } : {}),
      ...(options.cwd ? { cwd: options.cwd } : {})
    });

    return parseWithSchema(AppServerListThreadsResponseSchema, result, "AppServerListThreadsResponse");
  }

  public async listThreadsAll(options: ListThreadsAllOptions): Promise<AppServerListThreadsResponse> {
    const listItems: AppServerListThreadsResponse["data"] = [];

    let cursor = options.cursor;
    let pages = 0;

    while (pages < options.maxPages) {
      const page = await this.listThreads(
        cursor
          ? {
              limit: options.limit,
              archived: options.archived,
              cursor,
              ...(options.sortKey ? { sortKey: options.sortKey } : {}),
              ...(options.cwd ? { cwd: options.cwd } : {})
            }
          : {
              limit: options.limit,
              archived: options.archived,
              ...(options.sortKey ? { sortKey: options.sortKey } : {}),
              ...(options.cwd ? { cwd: options.cwd } : {})
            }
      );

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
    });

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
