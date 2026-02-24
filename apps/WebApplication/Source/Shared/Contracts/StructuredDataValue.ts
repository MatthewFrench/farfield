import { z } from "zod";

export type StructuredDataPrimitive = string | number | boolean | null;
export type StructuredDataValue =
  | StructuredDataPrimitive
  | StructuredDataValue[]
  | { [key: string]: StructuredDataValue };

export const StructuredDataPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);

export const StructuredDataValueSchema: z.ZodType<StructuredDataValue> = z.lazy(() =>
  z.union([
    StructuredDataPrimitiveSchema,
    z.array(StructuredDataValueSchema),
    z.record(StructuredDataValueSchema)
  ])
);
