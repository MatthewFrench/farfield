import {
  type AppServerCollaborationModeListResponse,
  AppServerCollaborationModeListResponseSchema,
  type AppServerConfigReadResponse,
  AppServerConfigReadResponseSchema,
  type AppServerListModelsResponse,
  AppServerListModelsResponseSchema,
  type AppServerListThreadsResponse,
  AppServerListThreadsResponseSchema,
  type AppServerReadThreadResponse,
  AppServerReadThreadResponseSchema,
  type AppServerStartThreadResponse,
  AppServerStartThreadResponseSchema,
  AppServerThreadListItemSchema,
  AppServerTurnStartResponseSchema,
  type CollaborationMode,
  JsonValueSchema,
  parseThreadConversationRequestResponse,
  type ThreadConversationRequestResponse,
  type TurnStartParams,
} from "@farfield/protocol";
import { z } from "zod";
import { APP_SERVER_CLIENT_METHODS } from "./AppServerClientMethodConstants.js";
import {
  APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT,
  buildArchiveThreadRequest,
  buildForkThreadRequest,
  buildListThreadsAllPageOptions,
  buildListThreadsRequestParameters,
  buildReadConfigRequestParameters,
  buildReadThreadRequestParameters,
  buildResumeThreadRequest,
  buildRollbackThreadRequest,
  buildSetThreadNameRequest,
  buildStartReviewRequest,
  buildStartThreadRequest,
  buildStartTurnRequest,
  buildSteerTurnRequest,
  buildTurnInterruptRequest,
  buildUnarchiveThreadRequest,
  resolveReadThreadRequestTimeoutMilliseconds,
} from "./AppServerClientRequestBuilders.js";
import {
  APP_SERVER_CLIENT_RESPONSE_CONTEXTS,
  parseAppServerResponse,
} from "./AppServerClientResponseParser.js";
import {
  type AppServerPendingServerRequest,
  type AppServerReadNotificationEventsInput,
  type AppServerReadNotificationEventsResult,
  type AppServerTransport,
  ChildProcessAppServerTransport,
  type ChildProcessAppServerTransportOptions,
  isChildProcessAppServerTransportOptions,
} from "./AppServerTransport.js";
import { AppServerTransportError } from "./Errors.js";

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

export interface ForkThreadOptions {
  persistExtendedHistory?: boolean;
}

export interface StartTurnOptions {
  threadId: string;
  text: string;
  cwd?: string;
  turnStartTemplate?: TurnStartParams | null;
  model?: string | null;
  effort?: string | null;
  collaborationMode?: CollaborationMode | null;
}

export type ReviewDelivery = "inline" | "detached";

export interface ReviewUncommittedChangesTarget {
  type: "uncommittedChanges";
}

export interface ReviewBaseBranchTarget {
  type: "baseBranch";
  branch: string;
}

export interface ReviewCommitTarget {
  type: "commit";
  sha: string;
  title?: string | null | undefined;
}

export interface ReviewCustomTarget {
  type: "custom";
  instructions: string;
}

export type StartReviewTarget =
  | ReviewUncommittedChangesTarget
  | ReviewBaseBranchTarget
  | ReviewCommitTarget
  | ReviewCustomTarget;

export interface StartReviewOptions {
  threadId: string;
  target: StartReviewTarget;
  delivery?: ReviewDelivery | null;
}

export interface StartReviewResult {
  reviewThreadId: string;
  turnId: string;
}

const AppServerArchiveThreadResponseSchema = z.object({}).passthrough();
const AppServerSetThreadNameResponseSchema = z.object({}).passthrough();
const AppServerTurnSteerResponseSchema = z
  .object({
    turnId: z.string().min(1),
  })
  .passthrough();
const AppServerTurnInterruptResponseSchema = z.object({}).passthrough();
const AppServerReviewStartResponseSchema = z
  .object({
    reviewThreadId: z.string().min(1),
    turn: z
      .object({
        id: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();
const AppServerUnarchiveThreadResponseSchema = z
  .object({
    thread: AppServerThreadListItemSchema,
  })
  .passthrough();

/**
 * Owns typed request/response mapping for Codex app-server RPC methods.
 * Transport concerns stay in `AppServerTransport`; schema enforcement stays here.
 */
export class AppServerClient {
  private readonly transport: AppServerTransport;

  public constructor(
    transportOrOptions: AppServerTransport | ChildProcessAppServerTransportOptions,
  ) {
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
      APP_SERVER_CLIENT_METHODS.listThreads,
      buildListThreadsRequestParameters(options),
    );

    return parseAppServerResponse(
      AppServerListThreadsResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listThreads,
    );
  }

  public async forkThread(
    threadId: string,
    options?: ForkThreadOptions,
  ): Promise<AppServerStartThreadResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.forkThread,
      buildForkThreadRequest(threadId, options),
    );
    return parseAppServerResponse(
      AppServerStartThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.forkThread,
    );
  }

  public async listThreadsAll(
    options: ListThreadsAllOptions,
  ): Promise<AppServerListThreadsResponse> {
    const listItems: AppServerListThreadsResponse["data"] = [];

    let cursor = options.cursor;
    let pages = 0;

    while (pages < options.maxPages) {
      const page = await this.listThreads(buildListThreadsAllPageOptions(options, cursor));

      listItems.push(...page.data);
      pages += 1;

      const nextCursor = page.nextCursor ?? null;
      // Empty page data with a cursor is treated as terminal to avoid looping on a non-advancing cursor.
      if (nextCursor === null || nextCursor.length === 0 || page.data.length === 0) {
        return {
          data: listItems,
          nextCursor: null,
          pages,
          truncated: false,
        };
      }

      cursor = nextCursor;
    }

    return {
      data: listItems,
      nextCursor: cursor ?? null,
      pages,
      truncated: true,
    };
  }

  public async readThread(
    threadId: string,
    includeTurns = true,
  ): Promise<AppServerReadThreadResponse> {
    const timeoutMilliseconds = resolveReadThreadRequestTimeoutMilliseconds(includeTurns);
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readThread,
      buildReadThreadRequestParameters(threadId, includeTurns),
      timeoutMilliseconds,
    );

    return parseAppServerResponse(
      AppServerReadThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readThread,
    );
  }

  public async listModels(
    limit = APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT,
  ): Promise<AppServerListModelsResponse> {
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.listModels, {
      limit,
    });
    return parseAppServerResponse(
      AppServerListModelsResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listModels,
    );
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listCollaborationModes,
      {},
    );
    return parseAppServerResponse(
      AppServerCollaborationModeListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listCollaborationModes,
    );
  }

  public async readConfig(options?: ReadConfigOptions): Promise<AppServerConfigReadResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.readConfig,
      buildReadConfigRequestParameters(options),
    );
    return parseAppServerResponse(
      AppServerConfigReadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.readConfig,
    );
  }

  public async startThread(options: StartThreadOptions): Promise<AppServerStartThreadResponse> {
    const request = buildStartThreadRequest(options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.startThread, request);
    return parseAppServerResponse(
      AppServerStartThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startThread,
    );
  }

  public async setThreadName(threadId: string, name: string): Promise<void> {
    const request = buildSetThreadNameRequest(threadId, name);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.setThreadName, request);
    parseAppServerResponse(
      AppServerSetThreadNameResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.setThreadName,
    );
  }

  public async rollbackThread(
    threadId: string,
    numTurns: number,
  ): Promise<AppServerReadThreadResponse> {
    const request = buildRollbackThreadRequest(threadId, numTurns);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.rollbackThread, request);
    return parseAppServerResponse(
      AppServerReadThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.rollbackThread,
    );
  }

  public async startReview(options: StartReviewOptions): Promise<StartReviewResult> {
    const request = buildStartReviewRequest(options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.startReview, request);
    const parsed = parseAppServerResponse(
      AppServerReviewStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startReview,
    );
    return {
      reviewThreadId: parsed.reviewThreadId,
      turnId: parsed.turn.id,
    };
  }

  public async startTurn(options: StartTurnOptions): Promise<void> {
    const request = buildStartTurnRequest(options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.startTurn, request);
    parseAppServerResponse(
      AppServerTurnStartResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.startTurn,
    );
  }

  public async steerTurn(threadId: string, expectedTurnId: string, text: string): Promise<string> {
    const request = buildSteerTurnRequest(threadId, expectedTurnId, text);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.steerTurn, request);
    const parsedResponse = parseAppServerResponse(
      AppServerTurnSteerResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.steerTurn,
    );
    return parsedResponse.turnId;
  }

  public async interruptTurn(threadId: string, turnId: string): Promise<void> {
    const request = buildTurnInterruptRequest(threadId, turnId);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.interruptTurn, request);
    parseAppServerResponse(
      AppServerTurnInterruptResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.interruptTurn,
    );
  }

  public async submitServerRequestResponse(
    requestId: number,
    responsePayload: ThreadConversationRequestResponse,
  ): Promise<void> {
    if (!this.transport.respond) {
      throw new AppServerTransportError(
        "App-server transport does not support server-request responses.",
      );
    }

    const parsedResponsePayload = parseThreadConversationRequestResponse(
      JsonValueSchema.parse(responsePayload),
    );
    await this.transport.respond(requestId, parsedResponsePayload);
  }

  public readNotificationEvents(
    input: AppServerReadNotificationEventsInput,
  ): AppServerReadNotificationEventsResult {
    if (!this.transport.readNotificationEvents) {
      throw new AppServerTransportError(
        "App-server transport does not support notification event reads.",
      );
    }

    return this.transport.readNotificationEvents(input);
  }

  public readPendingServerRequests(): AppServerPendingServerRequest[] {
    if (!this.transport.readPendingServerRequests) {
      throw new AppServerTransportError(
        "App-server transport does not expose pending server requests.",
      );
    }

    return this.transport.readPendingServerRequests();
  }

  public async resumeThread(
    threadId: string,
    options?: ResumeThreadOptions,
  ): Promise<AppServerReadThreadResponse> {
    const request = buildResumeThreadRequest(threadId, options);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.resumeThread, request);
    return parseAppServerResponse(
      AppServerReadThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.resumeThread,
    );
  }

  public async archiveThread(threadId: string): Promise<void> {
    const request = buildArchiveThreadRequest(threadId);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.archiveThread, request);
    parseAppServerResponse(
      AppServerArchiveThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.archiveThread,
    );
  }

  public async unarchiveThread(threadId: string): Promise<AppServerStartThreadResponse["thread"]> {
    const request = buildUnarchiveThreadRequest(threadId);
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.unarchiveThread, request);
    const parsed = parseAppServerResponse(
      AppServerUnarchiveThreadResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.unarchiveThread,
    );
    return parsed.thread;
  }
}
