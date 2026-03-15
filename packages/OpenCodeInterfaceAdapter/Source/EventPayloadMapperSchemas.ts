import { z } from "zod";
import { OpenCodeEventMapperFieldNames } from "./EventPayloadMapperFieldNames.js";
import { OpenCodeStructuredDataValueSchema } from "./Schemas.js";

const OpenCodeStructuredDataObjectSchema = z.record(OpenCodeStructuredDataValueSchema);

export const OpenCodeSessionIdentifierSchema = z.string().trim().min(1);

export const OpenCodeSessionScopedRecordSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    [OpenCodeEventMapperFieldNames.sessionIdentifier]: z.string().min(1),
  }),
);

const OpenCodeSessionRecordSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    [OpenCodeEventMapperFieldNames.identifier]: z.string().min(1),
  }),
);

const OpenCodeSessionStatusSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    [OpenCodeEventMapperFieldNames.statusType]: z.string().min(1),
  }),
);

export const OpenCodeMessageUpdatedPropertiesSchema = z
  .object({
    [OpenCodeEventMapperFieldNames.info]: OpenCodeSessionScopedRecordSchema,
  })
  .strict();

export const OpenCodeMessagePartUpdatedPropertiesSchema = z
  .object({
    [OpenCodeEventMapperFieldNames.part]: OpenCodeSessionScopedRecordSchema,
    [OpenCodeEventMapperFieldNames.delta]: OpenCodeStructuredDataValueSchema.optional(),
  })
  .strict();

export const OpenCodeSessionUpdatedPropertiesSchema = z
  .object({
    [OpenCodeEventMapperFieldNames.info]: OpenCodeSessionRecordSchema,
  })
  .strict();

export const OpenCodeSessionStatusPropertiesSchema = z
  .object({
    [OpenCodeEventMapperFieldNames.sessionIdentifier]: z.string().min(1),
    [OpenCodeEventMapperFieldNames.status]: OpenCodeSessionStatusSchema,
  })
  .strict();
