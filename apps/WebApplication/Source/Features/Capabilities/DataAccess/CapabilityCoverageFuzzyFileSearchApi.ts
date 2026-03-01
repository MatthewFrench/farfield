import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const FILES_FUZZY_SEARCH_ENDPOINT = "/api/files/fuzzy-search";
const FILES_FUZZY_SEARCH_SESSION_START_ENDPOINT = "/api/files/fuzzy-search/session-start";
const FILES_FUZZY_SEARCH_SESSION_UPDATE_ENDPOINT = "/api/files/fuzzy-search/session-update";
const FILES_FUZZY_SEARCH_SESSION_STOP_ENDPOINT = "/api/files/fuzzy-search/session-stop";

export interface ApiFuzzyFileSearchOptions extends ApiRequestOptions {
  agentId?: AgentId;
  query: string;
  roots: string[];
  cancellationToken?: string;
}

export interface ApiFuzzyFileSearchSessionStartOptions extends ApiRequestOptions {
  agentId?: AgentId;
  sessionId: string;
  roots: string[];
}

export interface ApiFuzzyFileSearchSessionUpdateOptions extends ApiRequestOptions {
  agentId?: AgentId;
  sessionId: string;
  query: string;
}

export interface ApiFuzzyFileSearchSessionStopOptions extends ApiRequestOptions {
  agentId?: AgentId;
  sessionId: string;
}

const FuzzyFileSearchInputSchema = z
  .object({
    query: z.string().min(1),
    roots: z.array(z.string().min(1)).min(1),
    cancellationToken: z.string().min(1).optional(),
  })
  .strict();

const FuzzyFileSearchSessionStartInputSchema = z
  .object({
    sessionId: z.string().min(1),
    roots: z.array(z.string().min(1)).min(1),
  })
  .strict();

const FuzzyFileSearchSessionUpdateInputSchema = z
  .object({
    sessionId: z.string().min(1),
    query: z.string().min(1),
  })
  .strict();

const FuzzyFileSearchSessionStopInputSchema = z
  .object({
    sessionId: z.string().min(1),
  })
  .strict();

const FuzzyFileSearchFileSchema = z
  .object({
    root: z.string().min(1),
    path: z.string().min(1),
    fileName: z.string().min(1),
    score: z.number(),
    indices: z.array(z.number().int()).nullable(),
  })
  .strict();
export type ApiFuzzyFileSearchFile = z.infer<typeof FuzzyFileSearchFileSchema>;

const FuzzyFileSearchResponseSchema = z
  .object({
    ok: z.literal(true),
    files: z.array(FuzzyFileSearchFileSchema),
  })
  .strict();
export type ApiFuzzyFileSearchResponse = z.infer<typeof FuzzyFileSearchResponseSchema>;

const FuzzyFileSearchSessionMutationResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strict();
export type ApiFuzzyFileSearchSessionStartResponse = z.infer<
  typeof FuzzyFileSearchSessionMutationResponseSchema
>;
export type ApiFuzzyFileSearchSessionUpdateResponse = z.infer<
  typeof FuzzyFileSearchSessionMutationResponseSchema
>;
export type ApiFuzzyFileSearchSessionStopResponse = z.infer<
  typeof FuzzyFileSearchSessionMutationResponseSchema
>;

function readFuzzyFileSearchPath(options: ApiFuzzyFileSearchOptions): string {
  const parsedInput = FuzzyFileSearchInputSchema.parse({
    query: options.query,
    roots: options.roots,
    ...(options.cancellationToken !== undefined
      ? { cancellationToken: options.cancellationToken }
      : {}),
  });
  const params = new URLSearchParams();
  params.set("query", parsedInput.query);
  for (const rootPath of parsedInput.roots) {
    params.append("root", rootPath);
  }
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  if (parsedInput.cancellationToken !== undefined) {
    params.set("cancellationToken", parsedInput.cancellationToken);
  }
  return `${FILES_FUZZY_SEARCH_ENDPOINT}?${params.toString()}`;
}

function readFuzzyFileSearchSessionStartPath(
  options: ApiFuzzyFileSearchSessionStartOptions,
): string {
  const parsedInput = FuzzyFileSearchSessionStartInputSchema.parse({
    sessionId: options.sessionId,
    roots: options.roots,
  });
  const params = new URLSearchParams();
  params.set("sessionId", parsedInput.sessionId);
  for (const rootPath of parsedInput.roots) {
    params.append("root", rootPath);
  }
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${FILES_FUZZY_SEARCH_SESSION_START_ENDPOINT}?${params.toString()}`;
}

function readFuzzyFileSearchSessionUpdatePath(
  options: ApiFuzzyFileSearchSessionUpdateOptions,
): string {
  const parsedInput = FuzzyFileSearchSessionUpdateInputSchema.parse({
    sessionId: options.sessionId,
    query: options.query,
  });
  const params = new URLSearchParams();
  params.set("sessionId", parsedInput.sessionId);
  params.set("query", parsedInput.query);
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${FILES_FUZZY_SEARCH_SESSION_UPDATE_ENDPOINT}?${params.toString()}`;
}

function readFuzzyFileSearchSessionStopPath(options: ApiFuzzyFileSearchSessionStopOptions): string {
  const parsedInput = FuzzyFileSearchSessionStopInputSchema.parse({
    sessionId: options.sessionId,
  });
  const params = new URLSearchParams();
  params.set("sessionId", parsedInput.sessionId);
  if (options.agentId !== undefined) {
    params.set("agentId", options.agentId);
  }
  return `${FILES_FUZZY_SEARCH_SESSION_STOP_ENDPOINT}?${params.toString()}`;
}

export async function searchFuzzyFiles(
  options: ApiFuzzyFileSearchOptions,
): Promise<ApiFuzzyFileSearchResponse> {
  return FuzzyFileSearchResponseSchema.parse(
    await request(readFuzzyFileSearchPath(options), requestInitWithOptions(options)),
  );
}

export async function startFuzzyFileSearchSession(
  options: ApiFuzzyFileSearchSessionStartOptions,
): Promise<ApiFuzzyFileSearchSessionStartResponse> {
  return FuzzyFileSearchSessionMutationResponseSchema.parse(
    await request(readFuzzyFileSearchSessionStartPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function updateFuzzyFileSearchSession(
  options: ApiFuzzyFileSearchSessionUpdateOptions,
): Promise<ApiFuzzyFileSearchSessionUpdateResponse> {
  return FuzzyFileSearchSessionMutationResponseSchema.parse(
    await request(readFuzzyFileSearchSessionUpdatePath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}

export async function stopFuzzyFileSearchSession(
  options: ApiFuzzyFileSearchSessionStopOptions,
): Promise<ApiFuzzyFileSearchSessionStopResponse> {
  return FuzzyFileSearchSessionMutationResponseSchema.parse(
    await request(readFuzzyFileSearchSessionStopPath(options), {
      ...requestInitWithOptions(options),
      method: "POST",
    }),
  );
}
