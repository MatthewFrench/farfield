import { z } from "zod";
import type {
  FuzzyFileSearchOptions,
  FuzzyFileSearchSessionStartOptions,
  FuzzyFileSearchSessionStopOptions,
  FuzzyFileSearchSessionUpdateOptions,
} from "./AppServerClient.js";

const AppServerFuzzyFileSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    roots: z.array(z.string().min(1)).min(1),
    cancellationToken: z.union([z.string().min(1), z.null()]).optional(),
  })
  .passthrough();
const AppServerFuzzyFileSearchSessionStartRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    roots: z.array(z.string().min(1)).min(1),
  })
  .passthrough();
const AppServerFuzzyFileSearchSessionUpdateRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    query: z.string().min(1),
  })
  .passthrough();
const AppServerFuzzyFileSearchSessionStopRequestSchema = z
  .object({
    sessionId: z.string().min(1),
  })
  .passthrough();

interface FuzzyFileSearchRequestParameters {
  query: string;
  roots: string[];
  cancellationToken?: string | null | undefined;
}

interface FuzzyFileSearchSessionStartRequestParameters {
  sessionId: string;
  roots: string[];
}

interface FuzzyFileSearchSessionUpdateRequestParameters {
  sessionId: string;
  query: string;
}

interface FuzzyFileSearchSessionStopRequestParameters {
  sessionId: string;
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

export function buildFuzzyFileSearchSessionStartRequestParameters(
  options: FuzzyFileSearchSessionStartOptions,
): FuzzyFileSearchSessionStartRequestParameters {
  return AppServerFuzzyFileSearchSessionStartRequestSchema.parse({
    sessionId: options.sessionId,
    roots: options.roots,
  });
}

export function buildFuzzyFileSearchSessionUpdateRequestParameters(
  options: FuzzyFileSearchSessionUpdateOptions,
): FuzzyFileSearchSessionUpdateRequestParameters {
  return AppServerFuzzyFileSearchSessionUpdateRequestSchema.parse({
    sessionId: options.sessionId,
    query: options.query,
  });
}

export function buildFuzzyFileSearchSessionStopRequestParameters(
  options: FuzzyFileSearchSessionStopOptions,
): FuzzyFileSearchSessionStopRequestParameters {
  return AppServerFuzzyFileSearchSessionStopRequestSchema.parse({
    sessionId: options.sessionId,
  });
}
