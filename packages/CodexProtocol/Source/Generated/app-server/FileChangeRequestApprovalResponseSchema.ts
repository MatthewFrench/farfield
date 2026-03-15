// GENERATED FILE. DO NOT EDIT.
// Source: vendor/codex-app-server-schema/stable/json/FileChangeRequestApprovalResponse.json
import { z } from "zod";

export const FileChangeRequestApprovalResponseSchema = z.object({
  decision: z.any().superRefine((x, ctx) => {
    const schemas = [
      z.literal("accept").describe("User approved the file changes."),
      z
        .literal("acceptForSession")
        .describe(
          "User approved the file changes and future changes to the same files should run without prompting.",
        ),
      z
        .literal("decline")
        .describe("User denied the file changes. The agent will continue the turn."),
      z
        .literal("cancel")
        .describe("User denied the file changes. The turn will also be immediately interrupted."),
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
