import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  HttpBodyParseError,
  HttpBodyParseErrorTypeByName,
  parseBody,
  parseReplayBody,
  parseSendMessageBody,
  parseSetModeBody,
  parseStartThreadBody,
  parseSubmitUserInputBody,
  parseTraceMarkBody,
  parseTraceStartBody,
  StartThreadBodySchema,
} from "../Source/Network/RequestSchemas/HttpSchemas.js";

describe("server request schemas", () => {
  it("accepts valid send message body", () => {
    const parsed = parseSendMessageBody({
      text: "hello",
      isSteering: false,
    });

    expect(parsed.text).toBe("hello");
  });

  it("rejects unknown fields with typed request-body diagnostics", () => {
    const parseError = parseInvalidBodyAndReadError(() =>
      parseSendMessageBody({
        text: "hello",
        extra: true,
      }),
    );

    expect(parseError.details.errorType).toBe(HttpBodyParseErrorTypeByName.invalidHttpRequestBody);
    expect(parseError.details.schemaName).toBe("SendMessageBody");
    expect(parseError.details.issues).toContainEqual({
      path: "body",
      issueCode: "unrecognized_keys",
      message: expect.any(String),
    });
    expect(parseError.message).toContain("SendMessageBody");
  });

  it("validates set mode body", () => {
    const parsed = parseSetModeBody({
      collaborationMode: {
        mode: "plan",
        settings: {
          model: "gpt-5.3-codex",
          reasoning_effort: "high",
          developer_instructions: "x",
        },
      },
    });

    expect(parsed.collaborationMode.mode).toBe("plan");
  });

  it("rejects invalid request id type with typed issue localization", () => {
    const parseError = parseInvalidBodyAndReadError(() =>
      parseSubmitUserInputBody({
        requestId: "bad",
        response: {
          method: "item/tool/requestUserInput",
          payload: {
            answers: {},
          },
        },
      }),
    );

    expect(parseError.details.errorType).toBe(HttpBodyParseErrorTypeByName.invalidHttpRequestBody);
    expect(parseError.details.schemaName).toBe("SubmitUserInputBody");
    expect(parseError.details.issues).toContainEqual({
      path: "body.requestId",
      issueCode: "invalid_type",
      message: expect.any(String),
    });
  });

  it("validates replay body", () => {
    const parsed = parseReplayBody({
      entryId: "abc",
      waitForResponse: true,
    });

    expect(parsed.waitForResponse).toBe(true);
  });

  it("validates start thread body with agentId", () => {
    const parsed = parseStartThreadBody({
      agentId: "opencode",
      cwd: "/tmp/workspace",
    });

    expect(parsed.agentId).toBe("opencode");
  });

  it("rejects deprecated agentKind field with deterministic metadata", () => {
    const parseError = parseInvalidBodyAndReadError(() =>
      parseStartThreadBody({
        agentKind: "opencode",
      }),
    );

    expect(parseError.details.errorType).toBe(HttpBodyParseErrorTypeByName.invalidHttpRequestBody);
    expect(parseError.details.schemaName).toBe("StartThreadBody");
    expect(parseError.details.issues).toContainEqual({
      path: "body",
      issueCode: "unrecognized_keys",
      message: expect.any(String),
    });
  });

  it("keeps generic schema parsing available for externally owned body schemas", () => {
    const parsed = parseBody(StartThreadBodySchema, {
      cwd: "/tmp/workspace",
    });

    expect(parsed.cwd).toBe("/tmp/workspace");
  });

  it("enforces trace label maximum length with deterministic issue path", () => {
    const parseError = parseInvalidBodyAndReadError(() =>
      parseTraceStartBody({
        label: "x".repeat(121),
      }),
    );

    expect(parseError.details.errorType).toBe(HttpBodyParseErrorTypeByName.invalidHttpRequestBody);
    expect(parseError.details.schemaName).toBe("TraceStartBody");
    expect(parseError.details.issues).toContainEqual({
      path: "body.label",
      issueCode: "too_big",
      message: expect.any(String),
    });
  });

  it("enforces trace mark note maximum length with deterministic issue path", () => {
    const parseError = parseInvalidBodyAndReadError(() =>
      parseTraceMarkBody({
        note: "x".repeat(501),
      }),
    );

    expect(parseError.details.errorType).toBe(HttpBodyParseErrorTypeByName.invalidHttpRequestBody);
    expect(parseError.details.schemaName).toBe("TraceMarkBody");
    expect(parseError.details.issues).toContainEqual({
      path: "body.note",
      issueCode: "too_big",
      message: expect.any(String),
    });
  });

  it("keeps request-body parse errors in the zod validation category", () => {
    const parseError = parseInvalidBodyAndReadError(() =>
      parseSendMessageBody({
        text: "hello",
        extra: true,
      }),
    );

    expect(parseError).toBeInstanceOf(z.ZodError);
  });

  it("uses a stable schema identity for generic parseBody errors", () => {
    const parseError = parseInvalidBodyAndReadError(() =>
      parseBody(StartThreadBodySchema, {
        agentKind: "opencode",
      }),
    );

    expect(parseError.details.schemaName).toBe("GenericRequestBody");
    expect(parseError.details.issues).toContainEqual({
      path: "body",
      issueCode: "unrecognized_keys",
      message: expect.any(String),
    });
  });
});

function parseInvalidBodyAndReadError(parseOperation: () => void): HttpBodyParseError {
  try {
    parseOperation();
  } catch (error) {
    if (error instanceof HttpBodyParseError) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected parse operation to throw HttpBodyParseError");
}
