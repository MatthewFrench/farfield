import { z } from "zod";

/**
 * Shared structured-data contract for transport-boundary payload content.
 * This shape intentionally mirrors JSON-compatible values only.
 */
export type StructuredDataPrimitive = string | number | boolean | null;
export type StructuredDataObject = { [key: string]: StructuredDataValue };
export type StructuredDataValue =
  | StructuredDataPrimitive
  | StructuredDataValue[]
  | StructuredDataObject;

export const StructuredDataPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const StructuredDataValueSchemaOwner: z.ZodType<StructuredDataValue> = z.lazy(() =>
  z.union([
    StructuredDataPrimitiveSchema,
    z.array(StructuredDataValueSchemaOwner),
    z.record(z.string(), StructuredDataValueSchemaOwner),
  ]),
);

export const StructuredDataValueSchema = StructuredDataValueSchemaOwner;
export const StructuredDataObjectSchema: z.ZodType<StructuredDataObject> = z.record(
  z.string(),
  StructuredDataValueSchemaOwner,
);
