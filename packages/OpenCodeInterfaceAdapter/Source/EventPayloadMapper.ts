import { z } from "zod";
import {
  OpenCodeStructuredDataValueSchema,
  type OpenCodeStructuredDataObject,
  type OpenCodeStructuredDataValue
} from "./Schemas.js";
import { type OpenCodeEvent } from "./MapperContracts.js";

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
    sessionID: z.string().min(1)
  })
);
const OpenCodeSessionRecordSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    id: z.string().min(1)
  })
);
const OpenCodeSessionStatusSchema = z.intersection(
  OpenCodeStructuredDataObjectSchema,
  z.object({
    type: z.string().min(1)
  })
);
const OpenCodeMessageUpdatedPropertiesSchema = z
  .object({
    info: OpenCodeSessionScopedRecordSchema
  })
  .strict();
const OpenCodeMessagePartUpdatedPropertiesSchema = z
  .object({
    part: OpenCodeSessionScopedRecordSchema,
    delta: OpenCodeStructuredDataValueSchema.optional()
  })
  .strict();
const OpenCodeSessionUpdatedPropertiesSchema = z
  .object({
    info: OpenCodeSessionRecordSchema
  })
  .strict();
const OpenCodeSessionStatusPropertiesSchema = z
  .object({
    sessionID: z.string().min(1),
    status: OpenCodeSessionStatusSchema
  })
  .strict();

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
    case "message.updated": {
      const properties = OpenCodeMessageUpdatedPropertiesSchema.parse(event.properties);
      if (properties.info.sessionID !== normalizedSessionId) {
        return null;
      }

      return {
        type: "opencode-message-updated",
        sessionId: normalizedSessionId,
        message: properties.info
      };
    }

    case "message.part.updated": {
      const properties = OpenCodeMessagePartUpdatedPropertiesSchema.parse(event.properties);
      if (properties.part.sessionID !== normalizedSessionId) {
        return null;
      }

      return {
        type: "opencode-part-updated",
        sessionId: normalizedSessionId,
        part: properties.part,
        delta: properties.delta ?? null
      };
    }

    case "session.updated": {
      const properties = OpenCodeSessionUpdatedPropertiesSchema.parse(event.properties);
      if (properties.info.id !== normalizedSessionId) {
        return null;
      }

      return {
        type: "opencode-session-updated",
        sessionId: normalizedSessionId,
        session: properties.info
      };
    }

    case "session.status": {
      const properties = OpenCodeSessionStatusPropertiesSchema.parse(event.properties);
      if (properties.sessionID !== normalizedSessionId) {
        return null;
      }

      return {
        type: "opencode-session-status",
        sessionId: normalizedSessionId,
        status: properties.status
      };
    }

    case "permission.updated": {
      const properties = OpenCodeSessionScopedRecordSchema.parse(event.properties);
      if (properties.sessionID !== normalizedSessionId) {
        return null;
      }

      return {
        type: "opencode-permission-request",
        sessionId: normalizedSessionId,
        permission: properties
      };
    }

    default:
      return null;
  }
}
