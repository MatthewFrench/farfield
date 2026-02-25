import { describe, expect, it } from "vitest";
import { ServerTransportErrorClassifier } from "../Source/Network/ServerTransportErrorClassifier.js";

describe("ServerTransportErrorClassifier", () => {
  it("classifies validation errors with transport-safe mapping", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyValidationError("invalid payload");

    expect(classification.category).toBe("request_validation");
    expect(classification.statusCode).toBe(400);
    expect(classification.severity).toBe("warning");
    expect(classification.logLevel).toBe("warn");
    expect(classification.logEventName).toBe("request-validation-failed");
    expect(classification.shouldRecordServerError).toBe(true);
    expect(classification.shouldPushSystemEvent).toBe(false);
    expect(classification.shouldBroadcastRuntimeState).toBe(false);
  });

  it("classifies expected shutdown transport errors", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyRuntimeError(
      new Error("app-server transport closed"),
      () => true,
      (value) => value.message
    );

    expect(classification.category).toBe("shutdown_transport");
    expect(classification.statusCode).toBe(503);
    expect(classification.severity).toBe("warning");
    expect(classification.logLevel).toBe("info");
    expect(classification.logEventName).toBe("request-closed-during-shutdown");
    expect(classification.runtimeErrorMessage).toBe("Server is shutting down");
    expect(classification.shouldRecordServerError).toBe(false);
  });

  it("classifies internal runtime errors with recording and system updates", () => {
    const classifier = new ServerTransportErrorClassifier();
    const classification = classifier.classifyRuntimeError(
      new Error("boom"),
      () => false,
      (value) => value.message
    );

    expect(classification.category).toBe("internal");
    expect(classification.statusCode).toBe(500);
    expect(classification.severity).toBe("error");
    expect(classification.logLevel).toBe("error");
    expect(classification.logEventName).toBe("request-failed");
    expect(classification.runtimeErrorMessage).toBe("boom");
    expect(classification.shouldRecordServerError).toBe(true);
    expect(classification.shouldPushSystemEvent).toBe(true);
    expect(classification.shouldBroadcastRuntimeState).toBe(true);
  });
});
