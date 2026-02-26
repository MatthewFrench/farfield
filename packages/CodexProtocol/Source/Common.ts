import { z } from "zod";

export const NonEmptyStringSchema = z.string().min(1);
export const NullableNonEmptyStringSchema = NonEmptyStringSchema.nullable();
export const NullableStringSchema = z.string().nullable();
export const NonNegativeIntSchema = z.number().int().nonnegative();

export const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type JsonPrimitive = z.infer<typeof JsonPrimitiveSchema>;

export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export const JsonObjectSchema: z.ZodType<JsonObject> = z.lazy(() => z.record(JsonValueSchema));

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), JsonObjectSchema])
);

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
