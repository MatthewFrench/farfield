import { z } from "zod";

export type ServerTransportErrorCategory =
  | "request_validation"
  | "shutdown_transport"
  | "internal";

export type ServerTransportErrorLogLevel = "warn" | "info" | "error";

export interface ServerTransportErrorClassification {
  category: ServerTransportErrorCategory;
  statusCode: number;
  logLevel: ServerTransportErrorLogLevel;
  logEventName: "request-validation-failed" | "request-closed-during-shutdown" | "request-failed";
  shouldRecordServerError: boolean;
  shouldPushSystemEvent: boolean;
  shouldBroadcastRuntimeState: boolean;
  runtimeErrorMessage: string;
}

export class ServerTransportErrorClassifier {
  public classifyValidationError(validationErrorMessage: string): ServerTransportErrorClassification {
    return {
      category: "request_validation",
      statusCode: 400,
      logLevel: "warn",
      logEventName: "request-validation-failed",
      shouldRecordServerError: false,
      shouldPushSystemEvent: false,
      shouldBroadcastRuntimeState: false,
      runtimeErrorMessage: validationErrorMessage
    };
  }

  public classifyRuntimeError(
    error: Error,
    isExpectedShutdownTransportError: (value: Error) => boolean,
    toErrorMessage: (value: Error) => string
  ): ServerTransportErrorClassification {
    if (error instanceof z.ZodError) {
      return this.classifyValidationError(error.message);
    }

    if (isExpectedShutdownTransportError(error)) {
      return {
        category: "shutdown_transport",
        statusCode: 503,
        logLevel: "info",
        logEventName: "request-closed-during-shutdown",
        shouldRecordServerError: false,
        shouldPushSystemEvent: false,
        shouldBroadcastRuntimeState: false,
        runtimeErrorMessage: "Server is shutting down"
      };
    }

    return {
      category: "internal",
      statusCode: 500,
      logLevel: "error",
      logEventName: "request-failed",
      shouldRecordServerError: true,
      shouldPushSystemEvent: true,
      shouldBroadcastRuntimeState: true,
      runtimeErrorMessage: toErrorMessage(error)
    };
  }
}
