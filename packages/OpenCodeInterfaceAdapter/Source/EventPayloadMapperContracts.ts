import type { OpenCodeEvent } from "./MapperContracts.js";
import type { OpenCodeStructuredDataObject, OpenCodeStructuredDataValue } from "./Schemas.js";

export const OpenCodeInboundEventTypes = {
  messageUpdated: "message.updated",
  messagePartUpdated: "message.part.updated",
  sessionUpdated: "session.updated",
  sessionStatus: "session.status",
  permissionUpdated: "permission.updated",
} as const;

export const OpenCodeMappedSsePayloadTypes = {
  messageUpdated: "opencode-message-updated",
  partUpdated: "opencode-part-updated",
  sessionUpdated: "opencode-session-updated",
  sessionStatus: "opencode-session-status",
  permissionRequest: "opencode-permission-request",
} as const;

export const OpenCodeMapperSchemaContext = {
  requestedSessionIdentifier: "RequestedSessionIdentifier",
  messageUpdatedProperties: "MessageUpdatedProperties",
  messagePartUpdatedProperties: "MessagePartUpdatedProperties",
  sessionUpdatedProperties: "SessionUpdatedProperties",
  sessionStatusProperties: "SessionStatusProperties",
  permissionUpdatedProperties: "PermissionUpdatedProperties",
} as const;

export type OpenCodeMapperSchemaContextValue =
  (typeof OpenCodeMapperSchemaContext)[keyof typeof OpenCodeMapperSchemaContext];

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
