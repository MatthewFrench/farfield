import {
  type OpenCodeEventPayloadMappingErrorDetails,
  OpenCodeInboundEventTypes,
  type OpenCodeMappedSsePayload,
  OpenCodeMappedSsePayloadTypes,
  OpenCodeMapperSchemaContext,
} from "./EventPayloadMapperContracts.js";
import {
  OpenCodeEventPayloadMappingError,
  parseMapperSchemaOrThrow,
  parseRequestedSessionIdentifierOrThrow,
} from "./EventPayloadMapperParsing.js";
import {
  OpenCodeMessagePartUpdatedPropertiesSchema,
  OpenCodeMessageUpdatedPropertiesSchema,
  OpenCodeSessionScopedRecordSchema,
  OpenCodeSessionStatusPropertiesSchema,
  OpenCodeSessionUpdatedPropertiesSchema,
} from "./EventPayloadMapperSchemas.js";
import { type OpenCodeEvent } from "./MapperContracts.js";

export type { OpenCodeEventPayloadMappingErrorDetails, OpenCodeMappedSsePayload };
export { OpenCodeEventPayloadMappingError };

function isDifferentSessionIdentifier(
  eventSessionIdentifier: string,
  requestedSessionIdentifier: string,
): boolean {
  return eventSessionIdentifier !== requestedSessionIdentifier;
}

/**
 * Maps OpenCode SSE events to a Farfield-compatible SSE payload.
 * Returns null for events that should be filtered out.
 */
export function mapOpenCodeEventToSsePayload(
  event: OpenCodeEvent,
  sessionId: string,
): OpenCodeMappedSsePayload | null {
  const normalizedSessionId = parseRequestedSessionIdentifierOrThrow(event.type, sessionId);

  switch (event.type) {
    case OpenCodeInboundEventTypes.messageUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeMessageUpdatedPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.messageUpdatedProperties,
      );
      if (isDifferentSessionIdentifier(properties.info.sessionID, normalizedSessionId)) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.messageUpdated,
        sessionId: normalizedSessionId,
        message: properties.info,
      };
    }

    case OpenCodeInboundEventTypes.messagePartUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeMessagePartUpdatedPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.messagePartUpdatedProperties,
      );
      if (isDifferentSessionIdentifier(properties.part.sessionID, normalizedSessionId)) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.partUpdated,
        sessionId: normalizedSessionId,
        part: properties.part,
        delta: properties.delta ?? null,
      };
    }

    case OpenCodeInboundEventTypes.sessionUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeSessionUpdatedPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.sessionUpdatedProperties,
      );
      if (isDifferentSessionIdentifier(properties.info.id, normalizedSessionId)) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.sessionUpdated,
        sessionId: normalizedSessionId,
        session: properties.info,
      };
    }

    case OpenCodeInboundEventTypes.sessionStatus: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeSessionStatusPropertiesSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.sessionStatusProperties,
      );
      if (isDifferentSessionIdentifier(properties.sessionID, normalizedSessionId)) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.sessionStatus,
        sessionId: normalizedSessionId,
        status: properties.status,
      };
    }

    case OpenCodeInboundEventTypes.permissionUpdated: {
      const properties = parseMapperSchemaOrThrow(
        OpenCodeSessionScopedRecordSchema,
        event.properties,
        event.type,
        OpenCodeMapperSchemaContext.permissionUpdatedProperties,
      );
      if (isDifferentSessionIdentifier(properties.sessionID, normalizedSessionId)) {
        return null;
      }

      return {
        type: OpenCodeMappedSsePayloadTypes.permissionRequest,
        sessionId: normalizedSessionId,
        permission: properties,
      };
    }

    default:
      return null;
  }
}
