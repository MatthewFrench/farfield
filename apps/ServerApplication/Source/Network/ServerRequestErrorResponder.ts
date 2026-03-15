import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { logger } from "../Shared/Logging/Logger.js";
import type { HistoryEntry } from "./DebugContracts.js";
import type { ThreadRouteDependencies } from "./Routes/ThreadRoutes.js";
import type { ServerErrorEventRecordInput } from "./ServerErrorEventRecorder.js";
import {
  type ServerTransportErrorCategory,
  type ServerTransportErrorClassification,
  ServerTransportErrorClassifier,
} from "./ServerTransportErrorClassifier.js";

const SERVER_ERROR_SOURCE = "farfield-server";
const HTTP_REQUEST_OPERATION = "http:request";
const REQUEST_FAILED_SYSTEM_MESSAGE = "Request failed";
const UNKNOWN_REQUEST_METHOD = "unknown";
const UNKNOWN_REQUEST_URL = "unknown";

interface ServerRequestRuntimeMetadata {
  method: string;
  url: string;
  requestId: string;
  actionId: string | null;
  actionName: string | null;
}

interface ServerRequestErrorLogInput extends ServerRequestRuntimeMetadata {
  error: string;
  errorCategory: ServerTransportErrorCategory;
}

interface ServerRequestErrorResponseBehavior {
  shouldSetRuntimeLastError: boolean;
  shouldRecordServerError: boolean;
  shouldPushSystemEvent: boolean;
  shouldBroadcastRuntimeState: boolean;
}

interface ServerRequestErrorResponseBody {
  ok: false;
  error: string;
  requestId: string;
  actionId: string | null;
  actionName: string | null;
}

// This table is the single owner for transport-error-category side effects.
const RESPONSE_BEHAVIOR_BY_ERROR_CATEGORY: Record<
  ServerTransportErrorCategory,
  ServerRequestErrorResponseBehavior
> = {
  request_validation: {
    shouldSetRuntimeLastError: false,
    shouldRecordServerError: true,
    shouldPushSystemEvent: false,
    shouldBroadcastRuntimeState: false,
  },
  shutdown_transport: {
    shouldSetRuntimeLastError: true,
    shouldRecordServerError: false,
    shouldPushSystemEvent: false,
    shouldBroadcastRuntimeState: false,
  },
  internal: {
    shouldSetRuntimeLastError: true,
    shouldRecordServerError: true,
    shouldPushSystemEvent: true,
    shouldBroadcastRuntimeState: true,
  },
};

export interface ServerRequestErrorContext {
  requestId: string;
  actionId: string | null;
  actionName: string | null;
}

export interface ServerRequestErrorResponderDependencies {
  jsonResponse: ThreadRouteDependencies["jsonResponse"];
  toErrorMessage: <ValueType>(value: ValueType) => string;
  isExpectedShutdownTransportError: (error: Error) => boolean;
  recordServerErrorEvent: (input: ServerErrorEventRecordInput) => void;
  setRuntimeLastError: (message: string) => void;
  pushSystem: (message: string, details?: HistoryEntry["meta"]) => void;
  broadcastRuntimeState: () => void;
}

interface ServerRequestErrorResponseInput<ErrorType> {
  req: IncomingMessage;
  res: ServerResponse;
  error: ErrorType;
  context: ServerRequestErrorContext;
}

export class ServerRequestErrorResponder {
  private readonly deps: ServerRequestErrorResponderDependencies;
  private readonly classifier: ServerTransportErrorClassifier;

  public constructor(dependencies: ServerRequestErrorResponderDependencies) {
    this.deps = dependencies;
    this.classifier = new ServerTransportErrorClassifier();
  }

  public respond<ErrorType>(input: ServerRequestErrorResponseInput<ErrorType>): void {
    const { req, res, error, context } = input;
    const normalizedError = this.normalizeError(error);
    const classification =
      normalizedError instanceof z.ZodError
        ? this.classifier.classifyValidationError(normalizedError.message)
        : this.classifier.classifyRuntimeError(
            normalizedError,
            this.deps.isExpectedShutdownTransportError,
            this.deps.toErrorMessage,
          );
    const responseBehavior = RESPONSE_BEHAVIOR_BY_ERROR_CATEGORY[classification.category];
    const requestRuntimeMetadata = this.createRequestRuntimeMetadata(req, context);
    const logInput = this.createLogInput(requestRuntimeMetadata, classification);

    if (responseBehavior.shouldSetRuntimeLastError) {
      this.deps.setRuntimeLastError(classification.runtimeErrorMessage);
    }

    this.recordServerErrorIfNeeded({
      normalizedError,
      requestUrl: req.url ?? null,
      logInput,
      classification,
      shouldRecordServerError: responseBehavior.shouldRecordServerError,
    });
    this.logClassification(classification, logInput);

    if (responseBehavior.shouldPushSystemEvent) {
      this.deps.pushSystem(REQUEST_FAILED_SYSTEM_MESSAGE, {
        ...logInput,
      });
    }

    if (responseBehavior.shouldBroadcastRuntimeState) {
      this.deps.broadcastRuntimeState();
    }

    this.writeErrorResponse({
      res,
      classification,
      context,
    });
  }

  private recordServerErrorIfNeeded(input: {
    normalizedError: Error;
    requestUrl: string | null;
    logInput: ServerRequestErrorLogInput;
    classification: ServerTransportErrorClassification;
    shouldRecordServerError: boolean;
  }): void {
    const { normalizedError, requestUrl, logInput, classification, shouldRecordServerError } =
      input;
    if (!shouldRecordServerError) {
      return;
    }

    try {
      const serverErrorEventDetails = this.createServerErrorEventDetails(logInput);
      this.deps.recordServerErrorEvent({
        source: SERVER_ERROR_SOURCE,
        operation: HTTP_REQUEST_OPERATION,
        message: classification.runtimeErrorMessage,
        severity: classification.severity,
        name: normalizedError.name,
        stack: normalizedError.stack ?? null,
        requestId: logInput.requestId,
        threadId: null,
        url: requestUrl,
        details: serverErrorEventDetails,
      });
    } catch (recordError) {
      logger.error(
        {
          error: this.deps.toErrorMessage(recordError),
          originalError: classification.runtimeErrorMessage,
          errorCategory: classification.category,
        },
        "server-error-record-failed",
      );
    }
  }

  private logClassification(
    classification: ServerTransportErrorClassification,
    logInput: ServerRequestErrorLogInput,
  ): void {
    if (classification.logLevel === "info") {
      logger.info(logInput, classification.logEventName);
      return;
    }

    if (classification.logLevel === "warn") {
      logger.warn(logInput, classification.logEventName);
      return;
    }

    logger.error(logInput, classification.logEventName);
  }

  private normalizeError<ErrorType>(error: ErrorType): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(this.deps.toErrorMessage(error));
  }

  private createRequestRuntimeMetadata(
    req: IncomingMessage,
    context: ServerRequestErrorContext,
  ): ServerRequestRuntimeMetadata {
    return {
      method: req.method ?? UNKNOWN_REQUEST_METHOD,
      url: req.url ?? UNKNOWN_REQUEST_URL,
      requestId: context.requestId,
      actionId: context.actionId,
      actionName: context.actionName,
    };
  }

  private createLogInput(
    runtimeMetadata: ServerRequestRuntimeMetadata,
    classification: ServerTransportErrorClassification,
  ): ServerRequestErrorLogInput {
    return {
      ...runtimeMetadata,
      error: classification.runtimeErrorMessage,
      errorCategory: classification.category,
    };
  }

  private createServerErrorEventDetails(
    logInput: ServerRequestErrorLogInput,
  ): Record<string, string> {
    const details: Record<string, string> = {
      method: logInput.method,
      errorCategory: logInput.errorCategory,
    };
    if (logInput.actionId !== null) {
      details["actionId"] = logInput.actionId;
    }
    if (logInput.actionName !== null) {
      details["actionName"] = logInput.actionName;
    }
    return details;
  }

  private writeErrorResponse(input: {
    res: ServerResponse;
    classification: ServerTransportErrorClassification;
    context: ServerRequestErrorContext;
  }): void {
    const { res, classification, context } = input;
    if (res.headersSent) {
      return;
    }

    const responseBody: ServerRequestErrorResponseBody = {
      ok: false,
      error: classification.runtimeErrorMessage,
      requestId: context.requestId,
      actionId: context.actionId,
      actionName: context.actionName,
    };

    this.deps.jsonResponse(res, classification.statusCode, responseBody);
  }
}
