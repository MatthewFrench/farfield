import { z } from "zod";
import type { FuzzyFileSearchOptions } from "./AppServerClient.js";

const AppServerFuzzyFileSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    roots: z.array(z.string().min(1)).min(1),
    cancellationToken: z.union([z.string().min(1), z.null()]).optional(),
  })
  .passthrough();

interface FuzzyFileSearchRequestParameters {
  query: string;
  roots: string[];
  cancellationToken?: string | null | undefined;
}

export function buildFuzzyFileSearchRequestParameters(
  options: FuzzyFileSearchOptions,
): FuzzyFileSearchRequestParameters {
  return AppServerFuzzyFileSearchRequestSchema.parse({
    query: options.query,
    roots: options.roots,
    ...(options.cancellationToken !== undefined
      ? { cancellationToken: options.cancellationToken }
      : {}),
  });
}
