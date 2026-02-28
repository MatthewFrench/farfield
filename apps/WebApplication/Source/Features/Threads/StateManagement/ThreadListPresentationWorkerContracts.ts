import { z } from "zod";
import type { StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
import {
  type ThreadListItem,
  ThreadListItemSchema,
  type ThreadProjectGroup,
  ThreadProjectGroupSchema,
} from "../DomainModel/ThreadGroupTypes";

const RequestIdentifierSchema = z.number().int().nonnegative();

export interface ThreadListPresentationWorkerInput {
  threads: ThreadListItem[];
  archivedThreads: ThreadListItem[];
  selectedThreadIdentifier: string | null;
}

const ThreadListPresentationWorkerInputSchema = z
  .object({
    threads: z.array(ThreadListItemSchema),
    archivedThreads: z.array(ThreadListItemSchema),
    selectedThreadIdentifier: z.string().min(1).nullable(),
  })
  .strict();

export interface ThreadListPresentationWorkerRequest {
  requestId: number;
  input: ThreadListPresentationWorkerInput;
}

const ThreadListPresentationWorkerRequestSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    input: ThreadListPresentationWorkerInputSchema,
  })
  .strict();

export interface ThreadListPresentationWorkerResult {
  selectedThread: ThreadListItem | null;
  activeProjectGroups: ThreadProjectGroup[];
  archivedProjectGroups: ThreadProjectGroup[];
  archivedThreadIdentifiers: string[];
  archivedSectionThreadCount: number;
}

const ThreadListPresentationWorkerResultSchema = z
  .object({
    selectedThread: ThreadListItemSchema.nullable(),
    activeProjectGroups: z.array(ThreadProjectGroupSchema),
    archivedProjectGroups: z.array(ThreadProjectGroupSchema),
    archivedThreadIdentifiers: z.array(z.string().min(1)),
    archivedSectionThreadCount: z.number().int().nonnegative(),
  })
  .strict();

export interface ThreadListPresentationWorkerSuccessResponse {
  requestId: number;
  kind: "success";
  result: ThreadListPresentationWorkerResult;
}

const ThreadListPresentationWorkerSuccessResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("success"),
    result: ThreadListPresentationWorkerResultSchema,
  })
  .strict();

export interface ThreadListPresentationWorkerFailureResponse {
  requestId: number;
  kind: "failure";
  reason: string;
}

const ThreadListPresentationWorkerFailureResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("failure"),
    reason: z.string().trim().min(1),
  })
  .strict();

export type ThreadListPresentationWorkerResponse =
  | ThreadListPresentationWorkerSuccessResponse
  | ThreadListPresentationWorkerFailureResponse;

const ThreadListPresentationWorkerResponseSchema = z.discriminatedUnion("kind", [
  ThreadListPresentationWorkerSuccessResponseSchema,
  ThreadListPresentationWorkerFailureResponseSchema,
]);

export function parseThreadListPresentationWorkerRequest(
  value: StructuredDataValue | ThreadListPresentationWorkerRequest,
): ThreadListPresentationWorkerRequest {
  return ThreadListPresentationWorkerRequestSchema.parse(value);
}

export function safeParseThreadListPresentationWorkerResponse(
  value: StructuredDataValue | ThreadListPresentationWorkerResponse,
):
  | { success: true; data: ThreadListPresentationWorkerResponse }
  | { success: false; error: z.ZodError } {
  const result = ThreadListPresentationWorkerResponseSchema.safeParse(value);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    data: result.data,
  };
}
