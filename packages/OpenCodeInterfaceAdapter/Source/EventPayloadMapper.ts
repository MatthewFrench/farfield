import { OpenCodeStructuredDataValueSchema, type OpenCodeStructuredDataValue } from "./Schemas.js";
import { type OpenCodeEvent } from "./MapperContracts.js";

/**
 * Maps OpenCode SSE events to a Farfield-compatible SSE payload.
 * Returns null for events that should be filtered out.
 */
export function mapOpenCodeEventToSsePayload(
  event: OpenCodeEvent,
  sessionId: string
): OpenCodeStructuredDataValue | null {
  switch (event.type) {
    case "message.updated": {
      const msg = event.properties.info;
      if (msg.sessionID !== sessionId) {
        return null;
      }
      return OpenCodeStructuredDataValueSchema.parse({
        type: "opencode-message-updated",
        sessionId,
        message: OpenCodeStructuredDataValueSchema.parse(msg)
      });
    }

    case "message.part.updated": {
      const part = event.properties.part;
      if (part.sessionID !== sessionId) {
        return null;
      }
      return OpenCodeStructuredDataValueSchema.parse({
        type: "opencode-part-updated",
        sessionId,
        part: OpenCodeStructuredDataValueSchema.parse(part),
        delta: OpenCodeStructuredDataValueSchema.parse(event.properties.delta ?? null)
      });
    }

    case "session.updated": {
      const info = event.properties.info;
      if (info.id !== sessionId) {
        return null;
      }
      return OpenCodeStructuredDataValueSchema.parse({
        type: "opencode-session-updated",
        sessionId,
        session: OpenCodeStructuredDataValueSchema.parse(info)
      });
    }

    case "session.status": {
      if (event.properties.sessionID !== sessionId) {
        return null;
      }
      return OpenCodeStructuredDataValueSchema.parse({
        type: "opencode-session-status",
        sessionId,
        status: OpenCodeStructuredDataValueSchema.parse(event.properties.status)
      });
    }

    case "permission.updated": {
      if (event.properties.sessionID !== sessionId) {
        return null;
      }
      return OpenCodeStructuredDataValueSchema.parse({
        type: "opencode-permission-request",
        sessionId,
        permission: OpenCodeStructuredDataValueSchema.parse(event.properties)
      });
    }

    default:
      return null;
  }
}
