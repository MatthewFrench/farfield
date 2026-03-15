import type {
  EventMessagePartUpdated,
  EventMessageUpdated,
  EventPermissionUpdated,
  EventSessionStatus,
  EventSessionUpdated,
} from "@opencode-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  mapOpenCodeEventToSsePayload,
  OpenCodeEventPayloadMappingError,
} from "../Source/EventPayloadMapper.js";
import type { OpenCodeStructuredDataValue } from "../Source/Schemas.js";

function makeEventMessageUpdated(sessionId: string): EventMessageUpdated {
  return {
    type: "message.updated",
    properties: {
      info: {
        id: "message-1",
        sessionID: sessionId,
        role: "user",
        time: { created: 1_700_000_100 },
        agent: "codex",
        model: {
          providerID: "openai",
          modelID: "gpt-4.1",
        },
      },
    },
  };
}

function makeEventMessagePartUpdated(
  sessionId: string,
  options: { delta?: OpenCodeStructuredDataValue } = {},
): EventMessagePartUpdated {
  return {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part-1",
        sessionID: sessionId,
        messageID: "message-1",
        type: "text",
        text: "hello",
      },
      ...(options.delta !== undefined ? { delta: options.delta } : {}),
    },
  };
}

function makeEventSessionUpdated(sessionId: string): EventSessionUpdated {
  return {
    type: "session.updated",
    properties: {
      info: {
        id: sessionId,
        projectID: "project-1",
        directory: "/tmp/project",
        title: "Session",
        version: "1",
        time: {
          created: 1_700_000_000,
          updated: 1_700_000_500,
        },
      },
    },
  };
}

function makeEventSessionStatus(sessionId: string): EventSessionStatus {
  return {
    type: "session.status",
    properties: {
      sessionID: sessionId,
      status: {
        type: "busy",
      },
    },
  };
}

function makeEventPermissionUpdated(sessionId: string): EventPermissionUpdated {
  return {
    type: "permission.updated",
    properties: {
      id: "permission-1",
      type: "shell",
      sessionID: sessionId,
      messageID: "message-1",
      title: "Run command",
      metadata: {},
      time: {
        created: 1_700_000_200,
      },
    },
  };
}

function requireMappingError(thunk: () => void): OpenCodeEventPayloadMappingError {
  try {
    thunk();
  } catch (error) {
    if (error instanceof OpenCodeEventPayloadMappingError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected OpenCodeEventPayloadMappingError");
}

describe("mapOpenCodeEventToSsePayload", () => {
  it("maps message.updated events for the active session", () => {
    const event = makeEventMessageUpdated("sess-1");

    const payload = mapOpenCodeEventToSsePayload(event, "sess-1");

    expect(payload).toEqual({
      type: "opencode-message-updated",
      sessionId: "sess-1",
      message: event.properties.info,
    });
  });

  it("maps message.part.updated and normalizes missing delta to null", () => {
    const event = makeEventMessagePartUpdated("sess-1");

    const payload = mapOpenCodeEventToSsePayload(event, "sess-1");

    expect(payload).toEqual({
      type: "opencode-part-updated",
      sessionId: "sess-1",
      part: event.properties.part,
      delta: null,
    });
  });

  it("maps message.part.updated and preserves provided delta values", () => {
    const delta: OpenCodeStructuredDataValue = {
      text: "delta",
      index: 3,
    };
    const event = makeEventMessagePartUpdated("sess-1", { delta });

    const payload = mapOpenCodeEventToSsePayload(event, "sess-1");

    expect(payload).toEqual({
      type: "opencode-part-updated",
      sessionId: "sess-1",
      part: event.properties.part,
      delta,
    });
  });

  it("maps session.updated events for the active session", () => {
    const event = makeEventSessionUpdated("sess-1");

    const payload = mapOpenCodeEventToSsePayload(event, "sess-1");

    expect(payload).toEqual({
      type: "opencode-session-updated",
      sessionId: "sess-1",
      session: event.properties.info,
    });
  });

  it("maps session.status events for the active session", () => {
    const event = makeEventSessionStatus("sess-1");

    const payload = mapOpenCodeEventToSsePayload(event, "sess-1");

    expect(payload).toEqual({
      type: "opencode-session-status",
      sessionId: "sess-1",
      status: event.properties.status,
    });
  });

  it("maps permission.updated events for the active session", () => {
    const event = makeEventPermissionUpdated("sess-1");

    const payload = mapOpenCodeEventToSsePayload(event, "sess-1");

    expect(payload).toEqual({
      type: "opencode-permission-request",
      sessionId: "sess-1",
      permission: event.properties,
    });
  });

  it("returns null when event session does not match the requested session", () => {
    const event = makeEventMessageUpdated("sess-2");

    const payload = mapOpenCodeEventToSsePayload(event, "sess-1");

    expect(payload).toBeNull();
  });

  it("trims requested session identifiers before session scope matching", () => {
    const event = makeEventSessionStatus("sess-1");

    const payload = mapOpenCodeEventToSsePayload(event, "  sess-1  ");

    expect(payload).toEqual({
      type: "opencode-session-status",
      sessionId: "sess-1",
      status: event.properties.status,
    });
  });

  it("throws a typed mapping error when required event session scope is missing", () => {
    const event = makeEventMessageUpdated("sess-1");
    Reflect.deleteProperty(event.properties.info, "sessionID");

    const error = requireMappingError(() => {
      mapOpenCodeEventToSsePayload(event, "sess-1");
    });

    expect(error.details.eventType).toBe("message.updated");
    expect(error.details.schemaContext).toBe("MessageUpdatedProperties");
    expect(error.details.issuePaths).toContain("info.sessionID");
    expect(error.details.issues.some((issue) => issue.includes("sessionID"))).toBe(true);
  });

  it("throws typed requested-session parsing errors with root issue localization", () => {
    const event = makeEventSessionStatus("sess-1");

    const error = requireMappingError(() => {
      mapOpenCodeEventToSsePayload(event, "   ");
    });

    expect(error.details.eventType).toBe("session.status");
    expect(error.details.schemaContext).toBe("RequestedSessionIdentifier");
    expect(error.details.issuePaths).toEqual(["<root>"]);
  });

  it("localizes nested schema failures for session.status payload mapping", () => {
    const event = makeEventSessionStatus("sess-1");
    Reflect.deleteProperty(event.properties.status, "type");

    const error = requireMappingError(() => {
      mapOpenCodeEventToSsePayload(event, "sess-1");
    });

    expect(error.details.eventType).toBe("session.status");
    expect(error.details.schemaContext).toBe("SessionStatusProperties");
    expect(error.details.issuePaths).toContain("status.type");
  });
});
