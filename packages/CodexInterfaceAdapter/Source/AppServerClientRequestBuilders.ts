import {
  AppServerStartThreadRequestSchema,
  AppServerTurnStartRequestSchema,
} from "@farfield/protocol";
import { z } from "zod";
import type {
  ForkThreadOptions,
  ListThreadsAllOptions,
  ListThreadsOptions,
  ReadConfigOptions,
  ResumeThreadOptions,
  StartReviewOptions,
  StartThreadOptions,
  StartTurnOptions,
} from "./AppServerClient.js";
import { buildTurnStartMessageParameters } from "./TurnStartMessageParametersBuilder.js";

const AppServerResumeThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
    persistExtendedHistory: z.boolean(),
  })
  .passthrough();
const AppServerArchiveThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerUnarchiveThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
  })
  .passthrough();
const AppServerForkThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
    persistExtendedHistory: z.boolean(),
  })
  .passthrough();
const AppServerSetThreadNameRequestSchema = z
  .object({
    threadId: z.string().min(1),
    name: z.string().trim().min(1),
  })
  .passthrough();
const AppServerRollbackThreadRequestSchema = z
  .object({
    threadId: z.string().min(1),
    numTurns: z.number().int().min(1),
  })
  .passthrough();
const AppServerTurnInterruptRequestSchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
  })
  .passthrough();
const AppServerTurnSteerTextInputSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .passthrough();
const AppServerTurnSteerRequestSchema = z
  .object({
    threadId: z.string().min(1),
    expectedTurnId: z.string().min(1),
    input: z.array(AppServerTurnSteerTextInputSchema).min(1),
  })
  .passthrough();
const AppServerReviewDeliverySchema = z.enum(["inline", "detached"]);
const AppServerReviewTargetSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("uncommittedChanges"),
    })
    .strict(),
  z
    .object({
      type: z.literal("baseBranch"),
      branch: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("commit"),
      sha: z.string().min(1),
      title: z.string().nullable().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("custom"),
      instructions: z.string().min(1),
    })
    .strict(),
]);
const AppServerReviewStartRequestSchema = z
  .object({
    threadId: z.string().min(1),
    target: AppServerReviewTargetSchema,
    delivery: AppServerReviewDeliverySchema.nullable().optional(),
  })
  .passthrough();

/**
 * Centralized request defaults for AppServerClient methods.
 */
export const APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT = 100;
export const APP_SERVER_CLIENT_DEFAULT_READ_CONFIG_INCLUDE_LAYERS = false;
export const APP_SERVER_CLIENT_DEFAULT_RESUME_THREAD_PERSIST_EXTENDED_HISTORY = true;
export const APP_SERVER_CLIENT_DEFAULT_FORK_THREAD_PERSIST_EXTENDED_HISTORY = true;
// Reading turns can include full conversation history and is expected to take longer than lightweight reads.
export const APP_SERVER_CLIENT_READ_THREAD_WITH_TURNS_TIMEOUT_MILLISECONDS = 90_000;

interface ListThreadsRequestParameters {
  limit: number;
  archived: boolean;
  cursor: string | null;
  sortKey?: "created_at" | "updated_at";
  cwd?: string;
}

export function buildListThreadsRequestParameters(
  options: ListThreadsOptions,
): ListThreadsRequestParameters {
  return {
    limit: options.limit,
    archived: options.archived,
    cursor: options.cursor ?? null,
    ...(options.sortKey !== undefined ? { sortKey: options.sortKey } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  };
}

export function buildListThreadsAllPageOptions(
  options: ListThreadsAllOptions,
  cursor: string | undefined,
): ListThreadsOptions {
  return {
    limit: options.limit,
    archived: options.archived,
    ...(cursor !== undefined ? { cursor } : {}),
    ...(options.sortKey !== undefined ? { sortKey: options.sortKey } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  };
}

export function buildReadThreadRequestParameters(
  threadId: string,
  includeTurns: boolean,
): { threadId: string; includeTurns: boolean } {
  return {
    threadId,
    includeTurns,
  };
}

export function resolveReadThreadRequestTimeoutMilliseconds(
  includeTurns: boolean,
): number | undefined {
  return includeTurns ? APP_SERVER_CLIENT_READ_THREAD_WITH_TURNS_TIMEOUT_MILLISECONDS : undefined;
}

export function buildReadConfigRequestParameters(options?: ReadConfigOptions): {
  includeLayers: boolean;
} {
  return {
    includeLayers: options?.includeLayers ?? APP_SERVER_CLIENT_DEFAULT_READ_CONFIG_INCLUDE_LAYERS,
  };
}

export function buildStartThreadRequest(
  options: StartThreadOptions,
): z.infer<typeof AppServerStartThreadRequestSchema> {
  return AppServerStartThreadRequestSchema.parse(options);
}

export function buildStartTurnRequest(
  options: StartTurnOptions,
): z.infer<typeof AppServerTurnStartRequestSchema> {
  const turnStartParameters = buildTurnStartMessageParameters({
    threadId: options.threadId,
    text: options.text,
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.turnStartTemplate !== undefined
      ? { turnStartTemplate: options.turnStartTemplate }
      : {}),
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(options.effort !== undefined ? { effort: options.effort } : {}),
    ...(options.collaborationMode !== undefined
      ? { collaborationMode: options.collaborationMode }
      : {}),
  });
  return AppServerTurnStartRequestSchema.parse(turnStartParameters);
}

export function buildResumeThreadRequest(
  threadId: string,
  options?: ResumeThreadOptions,
): z.infer<typeof AppServerResumeThreadRequestSchema> {
  return AppServerResumeThreadRequestSchema.parse({
    threadId,
    persistExtendedHistory:
      options?.persistExtendedHistory ??
      APP_SERVER_CLIENT_DEFAULT_RESUME_THREAD_PERSIST_EXTENDED_HISTORY,
  });
}

export function buildArchiveThreadRequest(
  threadId: string,
): z.infer<typeof AppServerArchiveThreadRequestSchema> {
  return AppServerArchiveThreadRequestSchema.parse({
    threadId,
  });
}

export function buildForkThreadRequest(
  threadId: string,
  options?: ForkThreadOptions,
): z.infer<typeof AppServerForkThreadRequestSchema> {
  return AppServerForkThreadRequestSchema.parse({
    threadId,
    persistExtendedHistory:
      options?.persistExtendedHistory ??
      APP_SERVER_CLIENT_DEFAULT_FORK_THREAD_PERSIST_EXTENDED_HISTORY,
  });
}

export function buildSetThreadNameRequest(
  threadId: string,
  name: string,
): z.infer<typeof AppServerSetThreadNameRequestSchema> {
  return AppServerSetThreadNameRequestSchema.parse({
    threadId,
    name,
  });
}

export function buildRollbackThreadRequest(
  threadId: string,
  numTurns: number,
): z.infer<typeof AppServerRollbackThreadRequestSchema> {
  return AppServerRollbackThreadRequestSchema.parse({
    threadId,
    numTurns,
  });
}

export function buildUnarchiveThreadRequest(
  threadId: string,
): z.infer<typeof AppServerUnarchiveThreadRequestSchema> {
  return AppServerUnarchiveThreadRequestSchema.parse({
    threadId,
  });
}

export function buildTurnInterruptRequest(
  threadId: string,
  turnId: string,
): z.infer<typeof AppServerTurnInterruptRequestSchema> {
  return AppServerTurnInterruptRequestSchema.parse({
    threadId,
    turnId,
  });
}

export function buildSteerTurnRequest(
  threadId: string,
  expectedTurnId: string,
  text: string,
): z.infer<typeof AppServerTurnSteerRequestSchema> {
  return AppServerTurnSteerRequestSchema.parse({
    threadId,
    expectedTurnId,
    input: [
      {
        type: "text",
        text,
      },
    ],
  });
}

export function buildStartReviewRequest(
  options: StartReviewOptions,
): z.infer<typeof AppServerReviewStartRequestSchema> {
  return AppServerReviewStartRequestSchema.parse({
    threadId: options.threadId,
    target: options.target,
    ...(options.delivery !== undefined ? { delivery: options.delivery } : {}),
  });
}
