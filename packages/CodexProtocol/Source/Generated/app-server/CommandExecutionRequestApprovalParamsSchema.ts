// GENERATED FILE. DO NOT EDIT.
// Source: vendor/codex-app-server-schema/stable/json/CommandExecutionRequestApprovalParams.json
import { z } from "zod";

export const CommandExecutionRequestApprovalParamsSchema = z.object({
  approvalId: z
    .union([
      z
        .string()
        .describe(
          "Unique identifier for this specific approval callback.\n\nFor regular shell/unified_exec approvals, this is null.\n\nFor zsh-exec-bridge subcommand approvals, multiple callbacks can belong to one parent `itemId`, so `approvalId` is a distinct opaque callback id (a UUID) used to disambiguate routing.",
        ),
      z
        .null()
        .describe(
          "Unique identifier for this specific approval callback.\n\nFor regular shell/unified_exec approvals, this is null.\n\nFor zsh-exec-bridge subcommand approvals, multiple callbacks can belong to one parent `itemId`, so `approvalId` is a distinct opaque callback id (a UUID) used to disambiguate routing.",
        ),
    ])
    .describe(
      "Unique identifier for this specific approval callback.\n\nFor regular shell/unified_exec approvals, this is null.\n\nFor zsh-exec-bridge subcommand approvals, multiple callbacks can belong to one parent `itemId`, so `approvalId` is a distinct opaque callback id (a UUID) used to disambiguate routing.",
    )
    .optional(),
  command: z
    .union([
      z.string().describe("The command to be executed."),
      z.null().describe("The command to be executed."),
    ])
    .describe("The command to be executed.")
    .optional(),
  commandActions: z
    .union([
      z
        .array(
          z.any().superRefine((x, ctx) => {
            const schemas = [
              z.object({
                command: z.string(),
                name: z.string(),
                path: z.string(),
                type: z.literal("read"),
              }),
              z.object({
                command: z.string(),
                path: z.union([z.string(), z.null()]).optional(),
                type: z.literal("listFiles"),
              }),
              z.object({
                command: z.string(),
                path: z.union([z.string(), z.null()]).optional(),
                query: z.union([z.string(), z.null()]).optional(),
                type: z.literal("search"),
              }),
              z.object({ command: z.string(), type: z.literal("unknown") }),
            ];
            const errors = schemas.reduce<z.ZodError[]>(
              (errors, schema) =>
                ((result) => (result.error ? [...errors, result.error] : errors))(
                  schema.safeParse(x),
                ),
              [],
            );
            if (schemas.length - errors.length !== 1) {
              ctx.addIssue({
                path: ctx.path,
                code: "invalid_union",
                unionErrors: errors,
                message: "Invalid input: Should pass single schema",
              });
            }
          }),
        )
        .describe("Best-effort parsed command actions for friendly display."),
      z.null().describe("Best-effort parsed command actions for friendly display."),
    ])
    .describe("Best-effort parsed command actions for friendly display.")
    .optional(),
  cwd: z
    .union([
      z.string().describe("The command's working directory."),
      z.null().describe("The command's working directory."),
    ])
    .describe("The command's working directory.")
    .optional(),
  itemId: z.string(),
  proposedExecpolicyAmendment: z
    .union([
      z
        .array(z.string())
        .describe(
          "Optional proposed execpolicy amendment to allow similar commands without prompting.",
        ),
      z
        .null()
        .describe(
          "Optional proposed execpolicy amendment to allow similar commands without prompting.",
        ),
    ])
    .describe("Optional proposed execpolicy amendment to allow similar commands without prompting.")
    .optional(),
  reason: z
    .union([
      z.string().describe("Optional explanatory reason (e.g. request for network access)."),
      z.null().describe("Optional explanatory reason (e.g. request for network access)."),
    ])
    .describe("Optional explanatory reason (e.g. request for network access).")
    .optional(),
  threadId: z.string(),
  turnId: z.string(),
});
