import { z } from "zod";
import { type AgentId, type ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";
import { request, requestInitWithOptions } from "@/Shared/Transport/FarfieldHttpTransport";

const FILES_FUZZY_SEARCH_ENDPOINT = "/api/files/fuzzy-search";

export interface ApiFuzzyFileSearchOptions extends ApiRequestOptions {
  agentId?: AgentId;
  query: string;
  roots: string[];
  cancellationToken?: string;
}

const FuzzyFileSearchInputSchema = z
  .object({
    query: z.string().min(1),
    roots: z.array(z.string().min(1)).min(1),
    cancellationToken: z.string().min(1).optional(),
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

export async function searchFuzzyFiles(
  options: ApiFuzzyFileSearchOptions,
): Promise<ApiFuzzyFileSearchResponse> {
  return FuzzyFileSearchResponseSchema.parse(
    await request(readFuzzyFileSearchPath(options), requestInitWithOptions(options)),
  );
}
