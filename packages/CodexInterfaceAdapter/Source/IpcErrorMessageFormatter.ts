import { JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";

const StructuredJsonValueSchema = z.union([
  z.null(),
  z.boolean(),
  z.number(),
  z.array(JsonValueSchema),
  z.record(JsonValueSchema),
]);

const IpcErrorMessageValueSchema = z.union([
  z.instanceof(Error).transform((error) => error.message),
  z.string(),
  StructuredJsonValueSchema.transform((value) => JSON.stringify(value)),
]);

/**
 * Formats transport/runtime error values into deterministic user-facing strings.
 */
export function formatIpcErrorMessage<ValueType>(value: ValueType): string {
  const parsedValue = IpcErrorMessageValueSchema.safeParse(value);
  if (parsedValue.success) {
    return parsedValue.data;
  }

  return String(value);
}
