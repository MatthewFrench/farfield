import { z } from "zod";
import type { FeedbackUploadOptions } from "./AppServerClient.js";

const AppServerFeedbackUploadRequestSchema = z
  .object({
    classification: z.string().min(1),
    reason: z.union([z.string().min(1), z.null()]).optional(),
    threadId: z.union([z.string().min(1), z.null()]).optional(),
    includeLogs: z.boolean(),
  })
  .passthrough();

interface FeedbackUploadRequestParameters {
  classification: string;
  reason?: string | null | undefined;
  threadId?: string | null | undefined;
  includeLogs: boolean;
}

export function buildFeedbackUploadRequestParameters(
  options: FeedbackUploadOptions,
): FeedbackUploadRequestParameters {
  return AppServerFeedbackUploadRequestSchema.parse({
    classification: options.classification,
    includeLogs: options.includeLogs,
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
    ...(options.threadId !== undefined ? { threadId: options.threadId } : {}),
  });
}
