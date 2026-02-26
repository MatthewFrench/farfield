import { z } from "zod";
import {
  OpenCodeStructuredDataValueSchema,
  type OpenCodeStructuredDataObject,
  type OpenCodeStructuredDataValue
} from "./Schemas.js";
import { type OpenCodeEvent } from "./MapperContracts.js";

const OpenCodeInboundEventTypes = {
  messageUpdated: "message.updated",
  messagePartUpdated: "message.part.updated",
  sessionUpdated: "session.updated",
  sessionStatus: "session.status",
  permissionUpdated: "permission.updated"
} as const;

const OpenCodeMappedSsePayloadTypes = {
  messageUpdated: "opencode-message-updated",
  partUpdated: "opencode-part-updated",
  sessionUpdated: "opencode-session-updated",
  sessionStatus: "opencode-session-status",
  permissionRequest: "opencode-permission-request"
} as const;

const OpenCodeMapperFieldNames = {
  sessionIdentifier: "sessionID",
  identifier: "id",
  statusType: "type",
  info: "info",
  part: "part",
  delta: "delta",
  status: "status"
} as const;
const OPEN_CODE_EVENT_PAYLOAD_MAPPING_ERROR_NAME = "OpenCodeEventPayloadMappingError";
const ROOT_ISSUE_PATH = "<root>";

const OpenCodeMapperSchemaContext = {
  requestedSessionIdentifier: "RequestedSessionIdentifier",
  messageUpdatedProperties: "MessageUpdatedProperties",
  messagePartUpdatedProperties: "MessagePartUpdatedProperties",
  sessionUpdatedProperties: "SessionUpdatedProperties",
  sessionStatusProperties: "SessionStatusProperties",
  permissionUpdatedProperties: "PermissionUpdatedProperties"
} as const;

type OpenCodeMapperSchemaContextValue = (
  typeof OpenCodeMapperSchemaContext
)[keyof typeof OpenCodeMapperSchemaContext];

interface OpenCodeMessageUpdatedSsePayload {
  type: "opencode-message-updated";
  sessionId: string;
  message: OpenCodeStructuredDataObject & { sessionID: string };
}

interface OpenCodePartUpdatedSsePayload {
  type: "opencode-part-updated";
  sessionId: string;
  part: OpenCodeStructuredDataObject & { sessionID: string };
  delta: OpenCodeStructuredDataValue;
}

interface OpenCodeSessionUpdatedSsePayload {
  type: "opencode-session-updated";
  sessionId: string;
  session: OpenCodeStructuredDataObject & { id: string };
}

interface OpenCodeSessionStatusSsePayload {
  type: "opencode-session-status";
  sessionId: string;
  status: OpenCodeStructuredDataObject & { type: string };
}

interface OpenCodePermissionRequestSsePayload {
  type: "opencode-permission-request";
  sessionId: string;
  permission: OpenCodeStructuredDataObject & { sessionID: string };
}

export type OpenCodeMappedSsePayload =
  | OpenCodeMessageUpdatedSsePayload
  | OpenCodePartUpdatedSsePayload
  | OpenCodeSessionUpdatedSsePayload
  | OpenCodeSessionStatusSsePayload
  | OpenCodePermissionRequestSsePayload;

export interface OpenCodeEventPayloadMappingErrorDetails {
  eventType: OpenCodeEvent["type"];
  schemaContext: OpenCodeMapperSchemaContextValue;
  issues: string[];
  issuePaths: string[];
}

/**
 * Owns deterministic mapper diagnostics for OpenCode event parsing failures.
 * Consumers can rely on `details` metadata instead of inspecting raw Zod issues.
 */
export class OpenCodeEventPayloadMappingError extends Error {
  public readonly details: OpenCodeEventPayloadMappingErrorDetails;
  public override readonly cause: z.ZodError;

  public constructor(
    details: OpenCodeEventPayloadMappingErrorDetails,
    cause: z.ZodError
  ) {
    super(
      `OpenCode event mapping failed (${details.eventType}, ${details.schemaContext}): ${details.issues.join("; ")}`
    );
    this.name = OPEN_CODE_EVENT_PAYLOAD_MAPPING_ERROR_NAME;
    this.details = details;
    this.cause = cause;
  }
}

const OpenCodeSessionIdentifierSchema = z.string().trim().min(1);
const OpenCodeStructuredDataObjectSchema = z.record(OpenCodeStructuredDataValueSchema);
const OpenCodeSessionScopedRecordSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    [OpenCodeMapperFieldNames.sessionIdentifier]: z.string().min(1)
  })
);
const OpenCodeSessionRecordSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    [OpenCodeMapperFieldNames.identifier]: z.string().min(1)
  })
);
const OpenCodeSessionStatusSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    [OpenCodeMapperFieldNames.statusType]: z.string().min(1)
  })
);
const OpenCodeMessageUpdatedPropertiesSchema = z
  .object({
    [OpenCodeMapperFieldNames.info]: OpenCodeSessionScopedRecordSchema
  })
  .strict();
const OpenCodeMessagePartUpdatedPropertiesSchema = z
  .object({
    [OpenCodeMapperFieldNames.part]: OpenCodeSessionScopedRecordSchema,
    [OpenCodeMapperFieldNames.delta]: OpenCodeStructuredDataValueSchema.optional()
  })
  .strict();
const OpenCodeSessionUpdatedPropertiesSchema = z
  .object({
    [OpenCodeMapperFieldNames.info]: OpenCodeSessionRecordSchema
  })
  .strict();
const OpenCodeSessionStatusPropertiesSchema = z
  .object({
    [OpenCodeMapperFieldNames.sessionIdentifier]: z.string().min(1),
    [OpenCodeMapperFieldNames.status]: OpenCodeSessionStatusSchema
  })
  .strict();

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
  const issues = input.error.issues.map((issue) => (
    `${formatIssuePath(issue.path)}: ${issue.message}`
  ));
  const issuePaths = input.error.issues.map((issue) => formatIssuePath(issue.path));

  return new OpenCodeEventPayloadMappingError(
    {
      eventType: input.eventType,
      schemaContext: input.schemaContext,
      issues,
      issuePaths
    },
    input.error
  );
}

function parseMapperSchemaOrThrow<SchemaType extends z.ZodTypeAny>(
  schema: SchemaType,
  value: object,
  eventType: OpenCodeEvent["type"],
  schemaContext: OpenCodeMapperSchemaContextValue
): z.output<SchemaType> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw createOpenCodeEventPayloadMappingError({
      eventType,
      schemaContext,
      error: parsed.error
    });
  }
  return parsed.data;
}

function parseRequestedSessionIdentifierOrThrow(
  eventType: OpenCodeEvent["type"],
  sessionId: string
): string {
  const parsed = OpenCodeSessionIdentifierSchema.safeParse(sessionId);
  if (!parsed.success) {
    throw createOpenCodeEventPayloadMappingError({
      eventType,
      schemaContext: OpenCodeMapperSchemaContext.requestedSessionIdentifier,
      error: parsed.error
    });
  }
  return parsed.data;
}

function isDifferentSessionIdentifier(
  eventSessionIdentifier: string,
  requestedSessionIdentifier: string
): boolean {
  return eventSessionIdentifier !== requestedSessionIdentifier;
}

/**
 * Maps OpenCode SSE events to a Farfield-compatible SSE payload.
 * Returns null for events that should be filtered out.
 */
export function mapOpenCodeEventToSsePayload(
  event: OpenCodeEvent,
  sessionId: string
): OpenCodeMappedSsePayload | null {
  const normalizedSessionId = parseRequestedSessionIdentifierOrThrow(event.type, sessionId);

  switch (event.type) {
    case OpenCodeInboundEventTypes.messageUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeMessageUpdatedPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.messageUpdatedProperties
      );
      if (
        isDifferentSessionIdentifier(
          properties.info.sessionID,
          normalizedSessionId
        )
      ) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.messageUpdated,
        sessionId: normalizedSessionId,
        message: properties.info
      };
    }

    case OpenCodeInboundEventTypes.messagePartUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeMessagePartUpdatedPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.messagePartUpdatedProperties
      );
      if (
        isDifferentSessionIdentifier(
          properties.part.sessionID,
          normalizedSessionId
        )
      ) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.partUpdated,
        sessionId: normalizedSessionId,
        part: properties.part,
        delta: properties.delta ?? null
      };
    }

    case OpenCodeInboundEventTypes.sessionUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeSessionUpdatedPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.sessionUpdatedProperties
      );
      if (
        isDifferentSessionIdentifier(
          properties.info.id,
          normalizedSessionId
        )
      ) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.sessionUpdated,
        sessionId: normalizedSessionId,
        session: properties.info
      };
    }

    case OpenCodeInboundEventTypes.sessionStatus: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeSessionStatusPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.sessionStatusProperties
      );
      if (
        isDifferentSessionIdentifier(
          properties.sessionID,
          normalizedSessionId
        )
      ) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.sessionStatus,
        sessionId: normalizedSessionId,
        status: properties.status
      };
    }

    case OpenCodeInboundEventTypes.permissionUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeSessionScopedRecordSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.permissionUpdatedProperties
      );
      if (
        isDifferentSessionIdentifier(
          properties.sessionID,
          normalizedSessionId
        )
      ) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.permissionRequest,
        sessionId: normalizedSessionId,
        permission: properties
      };
    }

    default:
      return null;
  }
}
