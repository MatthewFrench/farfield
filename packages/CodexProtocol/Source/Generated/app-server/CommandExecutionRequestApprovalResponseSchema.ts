// GENERATED FILE. DO NOT EDIT.
// Source: vendor/codex-app-server-schema/stable/json/CommandExecutionRequestApprovalResponse.json
import { z } from "zod";

export const CommandExecutionRequestApprovalResponseSchema = z.object({
  decision: z.any().superRefine((x, ctx) => {
    const schemas = [
      z.literal("accept").describe("User approved the command."),
      z
        .literal("acceptForSession")
        .describe(
          "User approved the command and future identical commands should run without prompting.",
        ),
      z
        .object({
          acceptWithExecpolicyAmendment: z.object({ execpolicy_amendment: z.array(z.string()) }),
        })
        .strict()
        .describe(
          "User approved the command, and wants to apply the proposed execpolicy amendment so future matching commands can run without prompting.",
        ),
      z.literal("decline").describe("User denied the command. The agent will continue the turn."),
      z
        .literal("cancel")
        .describe("User denied the command. The turn will also be immediately interrupted."),
    ];
    const errors = schemas.reduce<z.ZodError[]>(
      (errors, schema) =>
        ((result) => (result.error ? [...errors, result.error] : errors))(schema.safeParse(x)),
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
});
