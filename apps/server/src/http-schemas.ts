import {
  CollaborationModeSchema,
  CreateDebugClientErrorBodySchema,
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema,
  DeletePushSubscriptionBodySchema
} from "@farfield/protocol";
import { z } from "zod";

export const SetModeBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    collaborationMode: CollaborationModeSchema
  })
  .strict();

export const StartThreadBodySchema = z
  .object({
    cwd: z.string().optional(),
    model: z.string().optional(),
    modelProvider: z.string().optional(),
    personality: z.string().optional(),
    sandbox: z.string().optional(),
    approvalPolicy: z.string().optional(),
    ephemeral: z.boolean().optional()
  })
  .strict();

export const SendMessageBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    text: z.string().min(1),
    cwd: z.string().optional(),
    isSteering: z.boolean().optional()
  })
  .strict();

export const SubmitUserInputBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
    requestId: z.number().int().nonnegative(),
    response: z.unknown()
  })
  .strict();

export const InterruptBodySchema = z
  .object({
    ownerClientId: z.string().optional()
  })
  .strict();

export const TraceStartBodySchema = z
  .object({
    label: z.string().min(1).max(120)
  })
  .strict();

export const TraceMarkBodySchema = z
  .object({
    note: z.string().max(500)
  })
  .strict();

export const ReplayBodySchema = z
  .object({
    entryId: z.string().min(1),
    waitForResponse: z.boolean().optional()
  })
  .strict();

export const PushTestBodySchema = z
  .object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    title: z.string().min(1).max(120).optional(),
    body: z.string().max(500).optional(),
    dryRun: z.boolean().optional()
  })
  .strict();

export {
  CreateDebugClientErrorBodySchema,
  CreatePushReceiptBodySchema,
  CreatePushSubscriptionBodySchema,
  DeletePushSubscriptionBodySchema
};

export function parseBody<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown
): z.infer<Schema> {
  return schema.parse(value);
}
