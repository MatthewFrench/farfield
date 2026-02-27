import { type DebugErrorSeverity } from "@farfield/protocol";
import { z } from "zod";

const STATUS_CODE_BAD_REQUEST = 400;
const STATUS_CODE_SERVICE_UNAVAILABLE = 503;
const STATUS_CODE_INTERNAL_SERVER_ERROR = 500;
const SHUTDOWN_RUNTIME_ERROR_MESSAGE = "Server is shutting down";
const INTERNAL_RUNTIME_ERROR_MESSAGE = "Request failed";

export type ServerTransportErrorCategory = "request_validation" | "shutdown_transport" | "internal";

export type ServerTransportErrorLogLevel = "warn" | "info" | "error";
export type ServerTransportErrorLogEventName =
  | "request-validation-failed"
  | "request-closed-during-shutdown"
  | "request-failed";

export type ShutdownTransportErrorPredicate = (value: Error) => boolean;
export type RuntimeErrorMessageMapper = (value: Error) => string;

interface ServerTransportErrorClassificationTemplate {
  statusCode: number;
  severity: DebugErrorSeverity;
  logLevel: ServerTransportErrorLogLevel;
  logEventName: ServerTransportErrorLogEventName;
  shouldRecordServerError: boolean;
  shouldPushSystemEvent: boolean;
  shouldBroadcastRuntimeState: boolean;
}

export interface ServerTransportErrorClassification {
  category: ServerTransportErrorCategory;
  statusCode: number;
  severity: DebugErrorSeverity;
  logLevel: ServerTransportErrorLogLevel;
  logEventName: ServerTransportErrorLogEventName;
  shouldRecordServerError: boolean;
  shouldPushSystemEvent: boolean;
  shouldBroadcastRuntimeState: boolean;
  runtimeErrorMessage: string;
}

const CLASSIFICATION_TEMPLATE_BY_CATEGORY: Record<
  ServerTransportErrorCategory,
  ServerTransportErrorClassificationTemplate
> = {
  request_validation: {
    statusCode: STATUS_CODE_BAD_REQUEST,
    severity: "warning",
    logLevel: "warn",
    logEventName: "request-validation-failed",
    shouldRecordServerError: true,
    shouldPushSystemEvent: false,
    shouldBroadcastRuntimeState: false,
  },
  shutdown_transport: {
    statusCode: STATUS_CODE_SERVICE_UNAVAILABLE,
    severity: "warning",
    logLevel: "info",
    logEventName: "request-closed-during-shutdown",
    shouldRecordServerError: false,
    shouldPushSystemEvent: false,
    shouldBroadcastRuntimeState: false,
  },
  internal: {
    statusCode: STATUS_CODE_INTERNAL_SERVER_ERROR,
    severity: "error",
    logLevel: "error",
    logEventName: "request-failed",
    shouldRecordServerError: true,
    shouldPushSystemEvent: true,
    shouldBroadcastRuntimeState: true,
  },
};

export class ServerTransportErrorClassifier {
  public classifyValidationError(
    validationErrorMessage: string,
  ): ServerTransportErrorClassification {
    return this.createClassification("request_validation", validationErrorMessage);
  }

  public classifyRuntimeError(
    error: Error,
    isExpectedShutdownTransportError: ShutdownTransportErrorPredicate,
    toErrorMessage: RuntimeErrorMessageMapper,
  ): ServerTransportErrorClassification {
    if (error instanceof z.ZodError) {
      return this.classifyValidationError(error.message);
    }

    if (this.isExpectedShutdownTransportError(error, isExpectedShutdownTransportError)) {
      return this.createClassification("shutdown_transport", SHUTDOWN_RUNTIME_ERROR_MESSAGE);
    }

    return this.createClassification(
      "internal",
      this.mapInternalErrorMessage(error, toErrorMessage),
    );
  }

  private createClassification(
    category: ServerTransportErrorCategory,
    runtimeErrorMessage: string,
  ): ServerTransportErrorClassification {
    const classificationTemplate = CLASSIFICATION_TEMPLATE_BY_CATEGORY[category];
    return {
      category,
      statusCode: classificationTemplate.statusCode,
      severity: classificationTemplate.severity,
      logLevel: classificationTemplate.logLevel,
      logEventName: classificationTemplate.logEventName,
      shouldRecordServerError: classificationTemplate.shouldRecordServerError,
      shouldPushSystemEvent: classificationTemplate.shouldPushSystemEvent,
      shouldBroadcastRuntimeState: classificationTemplate.shouldBroadcastRuntimeState,
      runtimeErrorMessage,
    };
  }

  private isExpectedShutdownTransportError(
    error: Error,
    shutdownErrorPredicate: ShutdownTransportErrorPredicate,
  ): boolean {
    try {
      return shutdownErrorPredicate(error);
    } catch {
      return false;
    }
  }

  private mapInternalErrorMessage(error: Error, toErrorMessage: RuntimeErrorMessageMapper): string {
    try {
      return toErrorMessage(error);
    } catch {
      return this.resolveRuntimeErrorMessage(error.message, INTERNAL_RUNTIME_ERROR_MESSAGE);
    }
  }

  private resolveRuntimeErrorMessage(runtimeErrorMessage: string, defaultMessage: string): string {
    if (runtimeErrorMessage.length === 0) {
      return defaultMessage;
    }

    return runtimeErrorMessage;
  }
}
