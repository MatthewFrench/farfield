import { ThreadTurnSchema } from "@farfield/protocol";
import { z } from "zod";
import type { StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
import {
  type FlattenedConversationItem,
  FlattenedConversationItemSchema,
} from "../DomainModel/ConversationItemFlattener";

const RequestIdentifierSchema = z.number().int().nonnegative();

export interface ConversationItemFlatteningInput {
  turns: z.infer<typeof ThreadTurnSchema>[];
  isGenerating: boolean;
}

const ConversationItemFlatteningInputSchema = z
  .object({
    turns: z.array(ThreadTurnSchema),
    isGenerating: z.boolean(),
  })
  .strict();

export interface ConversationItemFlatteningWorkerRequest {
  requestId: number;
  input: ConversationItemFlatteningInput;
}

const ConversationItemFlatteningWorkerRequestSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    input: ConversationItemFlatteningInputSchema,
  })
  .strict();

export interface ConversationItemFlatteningWorkerSuccessResponse {
  requestId: number;
  kind: "success";
  flattenedItems: FlattenedConversationItem[];
}

const ConversationItemFlatteningWorkerSuccessResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("success"),
    flattenedItems: z.array(FlattenedConversationItemSchema),
  })
  .strict();

export interface ConversationItemFlatteningWorkerFailureResponse {
  requestId: number;
  kind: "failure";
  reason: string;
}

const ConversationItemFlatteningWorkerFailureResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("failure"),
    reason: z.string().trim().min(1),
  })
  .strict();

export type ConversationItemFlatteningWorkerResponse =
  | ConversationItemFlatteningWorkerSuccessResponse
  | ConversationItemFlatteningWorkerFailureResponse;

const ConversationItemFlatteningWorkerResponseSchema = z.discriminatedUnion("kind", [
  ConversationItemFlatteningWorkerSuccessResponseSchema,
  ConversationItemFlatteningWorkerFailureResponseSchema,
]);

export function parseConversationItemFlatteningWorkerRequest(
  value: StructuredDataValue | ConversationItemFlatteningWorkerRequest,
): ConversationItemFlatteningWorkerRequest {
  return ConversationItemFlatteningWorkerRequestSchema.parse(value);
}

export function safeParseConversationItemFlatteningWorkerResponse(
  value: StructuredDataValue | ConversationItemFlatteningWorkerResponse,
):
  | { success: true; data: ConversationItemFlatteningWorkerResponse }
  | { success: false; error: z.ZodError } {
  const result = ConversationItemFlatteningWorkerResponseSchema.safeParse(value);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    data: result.data,
  };
}
