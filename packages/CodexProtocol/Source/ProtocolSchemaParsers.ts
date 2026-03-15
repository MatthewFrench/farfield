import { z } from "zod";
import { type JsonValue } from "./Common.js";
import { ProtocolValidationError } from "./Errors.js";

/**
 * Owns boundary schema parsing so protocol modules emit consistent validation diagnostics
 * and deterministic ProtocolValidationError metadata.
 */
export function parseSchemaOrThrow<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: z.input<Schema> | JsonValue,
  context: string,
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod(context, result.error);
  }

  return result.data;
}
