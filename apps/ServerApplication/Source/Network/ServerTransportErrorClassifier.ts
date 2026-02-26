import { z } from "zod";
import { type DebugErrorSeverity } from "@farfield/protocol";

const STATUS_CODE_BAD_REQUEST = 400;
const STATUS_CODE_SERVICE_UNAVAILABLE = 503;
const STATUS_CODE_INTERNAL_SERVER_ERROR = 500;
const SHUTDOWN_RUNTIME_ERROR_MESSAGE = "Server is shutting down";

export type ServerTransportErrorCategory =
  | "request_validation"
  | "shutdown_transport"
  | "internal";

export type ServerTransportErrorLogLevel = "warn" | "info" | "error";

export interface ServerTransportErrorClassification {
  category: ServerTransportErrorCategory;
  statusCode: number;
  severity: DebugErrorSeverity;
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
      statusCode: STATUS_CODE_BAD_REQUEST,
      severity: "warning",
      logLevel: "warn",
      logEventName: "request-validation-failed",
      shouldRecordServerError: true,
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
        statusCode: STATUS_CODE_SERVICE_UNAVAILABLE,
        severity: "warning",
        logLevel: "info",
        logEventName: "request-closed-during-shutdown",
        shouldRecordServerError: false,
        shouldPushSystemEvent: false,
        shouldBroadcastRuntimeState: false,
        runtimeErrorMessage: SHUTDOWN_RUNTIME_ERROR_MESSAGE
      };
    }

    return {
      category: "internal",
      statusCode: STATUS_CODE_INTERNAL_SERVER_ERROR,
      severity: "error",
      logLevel: "error",
      logEventName: "request-failed",
      shouldRecordServerError: true,
      shouldPushSystemEvent: true,
      shouldBroadcastRuntimeState: true,
      runtimeErrorMessage: toErrorMessage(error)
    };
  }
}
