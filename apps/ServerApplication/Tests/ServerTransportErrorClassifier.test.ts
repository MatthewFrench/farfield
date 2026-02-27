import { type DebugErrorSeverity } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ServerTransportErrorCategory,
  type ServerTransportErrorClassification,
  ServerTransportErrorClassifier,
  type ServerTransportErrorLogEventName,
  type ServerTransportErrorLogLevel,
} from "../Source/Network/ServerTransportErrorClassifier.js";

const STATUS_CODE_BAD_REQUEST = 400;
const STATUS_CODE_SERVICE_UNAVAILABLE = 503;
const STATUS_CODE_INTERNAL_SERVER_ERROR = 500;
const SHUTDOWN_RUNTIME_ERROR_MESSAGE = "Server is shutting down";
const INTERNAL_RUNTIME_ERROR_MESSAGE = "Request failed";

interface ServerTransportErrorExpectationTemplate {
  category: ServerTransportErrorCategory;
  statusCode: number;
  severity: DebugErrorSeverity;
  logLevel: ServerTransportErrorLogLevel;
  logEventName: ServerTransportErrorLogEventName;
  shouldRecordServerError: boolean;
  shouldPushSystemEvent: boolean;
  shouldBroadcastRuntimeState: boolean;
}

const CLASSIFICATION_EXPECTATION_BY_CATEGORY: Record<
  ServerTransportErrorCategory,
  ServerTransportErrorExpectationTemplate
> = {
  request_validation: {
    category: "request_validation",
    statusCode: STATUS_CODE_BAD_REQUEST,
    severity: "warning",
    logLevel: "warn",
    logEventName: "request-validation-failed",
    shouldRecordServerError: true,
    shouldPushSystemEvent: false,
    shouldBroadcastRuntimeState: false,
  },
  shutdown_transport: {
    category: "shutdown_transport",
    statusCode: STATUS_CODE_SERVICE_UNAVAILABLE,
    severity: "warning",
    logLevel: "info",
    logEventName: "request-closed-during-shutdown",
    shouldRecordServerError: false,
    shouldPushSystemEvent: false,
    shouldBroadcastRuntimeState: false,
  },
  internal: {
    category: "internal",
    statusCode: STATUS_CODE_INTERNAL_SERVER_ERROR,
    severity: "error",
    logLevel: "error",
    logEventName: "request-failed",
    shouldRecordServerError: true,
    shouldPushSystemEvent: true,
    shouldBroadcastRuntimeState: true,
  },
};

function createExpectedClassification(
  category: ServerTransportErrorCategory,
  runtimeErrorMessage: string,
): ServerTransportErrorClassification {
  const expectationTemplate = CLASSIFICATION_EXPECTATION_BY_CATEGORY[category];
  return {
    category: expectationTemplate.category,
    statusCode: expectationTemplate.statusCode,
    severity: expectationTemplate.severity,
    logLevel: expectationTemplate.logLevel,
    logEventName: expectationTemplate.logEventName,
    shouldRecordServerError: expectationTemplate.shouldRecordServerError,
    shouldPushSystemEvent: expectationTemplate.shouldPushSystemEvent,
    shouldBroadcastRuntimeState: expectationTemplate.shouldBroadcastRuntimeState,
    runtimeErrorMessage,
  };
}

describe("ServerTransportErrorClassifier", () => {
  it("classifies validation errors with deterministic transport mapping", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyValidationError("invalid payload");

    expect(classification).toEqual(
      createExpectedClassification("request_validation", "invalid payload"),
    );
  });

  it("classifies expected shutdown transport errors without invoking internal message mapping", () => {
    const classifier = new ServerTransportErrorClassifier();
    let toErrorMessageInvocationCount = 0;
    const classification = classifier.classifyRuntimeError(
      new Error("app-server transport closed"),
      () => true,
      (value) => {
        toErrorMessageInvocationCount += 1;
        return value.message;
      },
    );

    expect(classification).toEqual(
      createExpectedClassification("shutdown_transport", SHUTDOWN_RUNTIME_ERROR_MESSAGE),
    );
    expect(toErrorMessageInvocationCount).toBe(0);
  });

  it("classifies internal runtime errors with deterministic internal mapping", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyRuntimeError(
      new Error("boom"),
      () => false,
      (value) => value.message,
    );

    expect(classification).toEqual(createExpectedClassification("internal", "boom"));
  });

  it("maps runtime zod errors to validation classification", () => {
    const classifier = new ServerTransportErrorClassifier();
    const zodError = z.object({ value: z.string() }).safeParse({ value: 7 });
    if (zodError.success) {
      throw new Error("Expected zod parse failure fixture");
    }

    const classification = classifier.classifyRuntimeError(
      zodError.error,
      () => false,
      (value) => value.message,
    );

    expect(classification).toEqual(
      createExpectedClassification("request_validation", zodError.error.message),
    );
  });

  it("classifies as internal when the shutdown predicate throws", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyRuntimeError(
      new Error("boom"),
      () => {
        throw new Error("shutdown predicate failure");
      },
      (value) => `mapped:${value.message}`,
    );

    expect(classification).toEqual(createExpectedClassification("internal", "mapped:boom"));
  });

  it("uses the error message when internal message mapping throws", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyRuntimeError(
      new Error("boom"),
      () => false,
      () => {
        throw new Error("mapper failure");
      },
    );

    expect(classification).toEqual(createExpectedClassification("internal", "boom"));
  });

  it("uses the generic internal message when mapping throws and the error message is empty", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyRuntimeError(
      new Error(""),
      () => false,
      () => {
        throw new Error("mapper failure");
      },
    );

    expect(classification).toEqual(
      createExpectedClassification("internal", INTERNAL_RUNTIME_ERROR_MESSAGE),
    );
  });
});
