// GENERATED FILE. DO NOT EDIT.
// Source: vendor/codex-app-server-schema/stable/json/DynamicToolCallResponse.json
import { z } from "zod";

export const DynamicToolCallResponseSchema = z.object({
  contentItems: z.array(
    z.any().superRefine((x, ctx) => {
      const schemas = [
        z.object({ text: z.string(), type: z.literal("inputText") }),
        z.object({ imageUrl: z.string(), type: z.literal("inputImage") }),
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
  ),
  success: z.boolean(),
});
