import { type JsonValue } from "@farfield/protocol";
import { z } from "zod";

export interface AppServerNotificationIdentity {
  threadId: string | null;
  turnId: string | null;
}

const AppServerNotificationEnvelopeSchema = z
  .object({
    threadId: z.string().min(1).optional(),
    thread_id: z.string().min(1).optional(),
    conversationId: z.string().min(1).optional(),
    conversation_id: z.string().min(1).optional(),
    turnId: z.string().min(1).optional(),
    turn_id: z.string().min(1).optional(),
    thread: z
      .object({
        id: z.string().min(1),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Owns app-server notification identity parsing at the transport boundary so downstream
 * stream-read owners can consume strict projected identifiers instead of reparsing envelopes.
 */
export function parseAppServerNotificationIdentity(
  params: JsonValue | null,
): AppServerNotificationIdentity {
  if (params === null) {
    return {
      threadId: null,
      turnId: null,
    };
  }

  const parsedNotificationEnvelope = AppServerNotificationEnvelopeSchema.safeParse(params);
  if (!parsedNotificationEnvelope.success) {
    return {
      threadId: null,
      turnId: null,
    };
  }

  const parsedEnvelope = parsedNotificationEnvelope.data;
  return {
    threadId:
      parsedEnvelope.threadId ??
      parsedEnvelope.thread_id ??
      parsedEnvelope.conversationId ??
      parsedEnvelope.conversation_id ??
      parsedEnvelope.thread?.id ??
      null,
    turnId: parsedEnvelope.turnId ?? parsedEnvelope.turn_id ?? null,
  };
}
