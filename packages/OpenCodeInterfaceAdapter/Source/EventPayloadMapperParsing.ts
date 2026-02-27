import { z } from "zod";
import {
  type OpenCodeEventPayloadMappingErrorDetails,
  OpenCodeMapperSchemaContext,
  type OpenCodeMapperSchemaContextValue,
} from "./EventPayloadMapperContracts.js";
import { OpenCodeSessionIdentifierSchema } from "./EventPayloadMapperSchemas.js";
import type { OpenCodeEvent } from "./MapperContracts.js";

const OPEN_CODE_EVENT_PAYLOAD_MAPPING_ERROR_NAME = "OpenCodeEventPayloadMappingError";
const ROOT_ISSUE_PATH = "<root>";

/**
 * Owns deterministic mapper diagnostics for OpenCode event parsing failures.
 * Consumers can rely on `details` metadata instead of inspecting raw Zod issues.
 */
export class OpenCodeEventPayloadMappingError extends Error {
  public readonly details: OpenCodeEventPayloadMappingErrorDetails;
  public override readonly cause: z.ZodError;

  public constructor(details: OpenCodeEventPayloadMappingErrorDetails, cause: z.ZodError) {
    super(
      `OpenCode event mapping failed (${details.eventType}, ${details.schemaContext}): ${details.issues.join("; ")}`,
    );
    this.name = OPEN_CODE_EVENT_PAYLOAD_MAPPING_ERROR_NAME;
    this.details = details;
    this.cause = cause;
  }
}

function formatIssuePath(path: (string | number)[]): string {
  if (path.length === 0) {
    return ROOT_ISSUE_PATH;
  }

  return path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
    .join(".")
    .replace(/\.\[/g, "[");
}

function createOpenCodeEventPayloadMappingError(input: {
  eventType: OpenCodeEvent["type"];
  schemaContext: OpenCodeMapperSchemaContextValue;
  error: z.ZodError;
}): OpenCodeEventPayloadMappingError {
  const issues = input.error.issues.map(
    (issue) => `${formatIssuePath(issue.path)}: ${issue.message}`,
  );
  const issuePaths = input.error.issues.map((issue) => formatIssuePath(issue.path));

  return new OpenCodeEventPayloadMappingError(
    {
      eventType: input.eventType,
      schemaContext: input.schemaContext,
      issues,
      issuePaths,
    },
    input.error,
  );
}

export function parseMapperSchemaOrThrow<SchemaType extends z.ZodTypeAny>(
  schema: SchemaType,
  value: object,
  eventType: OpenCodeEvent["type"],
  schemaContext: OpenCodeMapperSchemaContextValue,
): z.output<SchemaType> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw createOpenCodeEventPayloadMappingError({
      eventType,
      schemaContext,
      error: parsed.error,
    });
  }
  return parsed.data;
}

export function parseRequestedSessionIdentifierOrThrow(
  eventType: OpenCodeEvent["type"],
  sessionId: string,
): string {
  const parsed = OpenCodeSessionIdentifierSchema.safeParse(sessionId);
  if (!parsed.success) {
    throw createOpenCodeEventPayloadMappingError({
      eventType,
      schemaContext: OpenCodeMapperSchemaContext.requestedSessionIdentifier,
      error: parsed.error,
    });
  }
  return parsed.data;
}
