import { FarfieldThreadStreamDeltaSchema } from "@farfield/protocol";
import { z } from "zod";
import type { StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
import {
  type EventStreamRefreshDecision,
  type EventStreamRefreshDecisionInput,
} from "./EventStreamRefreshDecisionEngine";

const ThreadOnlyHistoryMethodIdentifierSchema = z.string().trim().min(1);
const RequestIdentifierSchema = z.number().int().nonnegative();
const EventStreamRefreshDecisionInputSchema = z
  .object({
    activeTab: z.enum(["chat", "debug"]),
    selectedThreadId: z.string().min(1).nullable(),
    eventData: z.string(),
  })
  .strict();
const EventStreamRefreshDecisionSchema = z
  .object({
    refreshCore: z.boolean(),
    refreshHistory: z.boolean(),
    refreshSelectedThread: z.boolean(),
    threadStreamDelta: FarfieldThreadStreamDeltaSchema.nullable(),
  })
  .strict();

export interface EventStreamRefreshDecisionWorkerRequest {
  requestId: number;
  threadOnlyHistoryMethods: string[];
  input: EventStreamRefreshDecisionInput;
}

const EventStreamRefreshDecisionWorkerRequestSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    threadOnlyHistoryMethods: z.array(ThreadOnlyHistoryMethodIdentifierSchema),
    input: EventStreamRefreshDecisionInputSchema,
  })
  .strict();

export interface EventStreamRefreshDecisionWorkerSuccessResponse {
  requestId: number;
  kind: "success";
  decision: EventStreamRefreshDecision;
}

const EventStreamRefreshDecisionWorkerSuccessResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("success"),
    decision: EventStreamRefreshDecisionSchema,
  })
  .strict();

export interface EventStreamRefreshDecisionWorkerFailureResponse {
  requestId: number;
  kind: "failure";
  reason: string;
}

const EventStreamRefreshDecisionWorkerFailureResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("failure"),
    reason: z.string().trim().min(1),
  })
  .strict();

export type EventStreamRefreshDecisionWorkerResponse =
  | EventStreamRefreshDecisionWorkerSuccessResponse
  | EventStreamRefreshDecisionWorkerFailureResponse;

const EventStreamRefreshDecisionWorkerResponseSchema = z.discriminatedUnion("kind", [
  EventStreamRefreshDecisionWorkerSuccessResponseSchema,
  EventStreamRefreshDecisionWorkerFailureResponseSchema,
]);

export function parseEventStreamRefreshDecisionWorkerRequest(
  value: StructuredDataValue | EventStreamRefreshDecisionWorkerRequest,
): EventStreamRefreshDecisionWorkerRequest {
  return EventStreamRefreshDecisionWorkerRequestSchema.parse(value);
}

export function safeParseEventStreamRefreshDecisionWorkerResponse(
  value: StructuredDataValue | EventStreamRefreshDecisionWorkerResponse,
):
  | { success: true; data: EventStreamRefreshDecisionWorkerResponse }
  | { success: false; error: z.ZodError } {
  const result = EventStreamRefreshDecisionWorkerResponseSchema.safeParse(value);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    data: result.data,
  };
}
