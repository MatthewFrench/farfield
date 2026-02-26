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
  const normalizedSessionId = OpenCodeSessionIdentifierSchema.parse(sessionId);

  switch (event.type) {
    case OpenCodeInboundEventTypes.messageUpdated: {
      const properties = OpenCodeMessageUpdatedPropertiesSchema.parse(event.properties);
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
      const properties = OpenCodeMessagePartUpdatedPropertiesSchema.parse(event.properties);
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
      const properties = OpenCodeSessionUpdatedPropertiesSchema.parse(event.properties);
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
      const properties = OpenCodeSessionStatusPropertiesSchema.parse(event.properties);
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
      const properties = OpenCodeSessionScopedRecordSchema.parse(event.properties);
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
