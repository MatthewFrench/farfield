import { z } from "zod";
import { ProtocolValidationError } from "./Errors.js";
import { type JsonValue } from "./Common.js";

/**
 * Owns boundary schema parsing so protocol modules emit consistent validation diagnostics.
 */
export function parseSchemaOrThrow<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: z.input<Schema> | JsonValue,
  context: string
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod(context, result.error);
  }

  return result.data;
}
