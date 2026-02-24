import { z } from "zod";

export const NonEmptyStringSchema = z.string().min(1);
export const NullableNonEmptyStringSchema = z.union([NonEmptyStringSchema, z.null()]);
export const NullableStringSchema = z.union([z.string(), z.null()]);
export const NonNegativeIntSchema = z.number().int().nonnegative();

export const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type JsonPrimitive = z.infer<typeof JsonPrimitiveSchema>;

export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(JsonValueSchema)])
);

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
