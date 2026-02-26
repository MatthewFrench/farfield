import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { logger } from "../Shared/Logging/Logger.js";
import type { ServerErrorEventRecordInput } from "./ServerErrorEventRecorder.js";
import {
  ServerTransportErrorClassifier,
  type ServerTransportErrorClassification
} from "./ServerTransportErrorClassifier.js";
import type { HistoryEntry } from "./Routes/DebugTypes.js";
import type { ThreadRouteDependencies } from "./Routes/ThreadRoutes.js";

const SERVER_ERROR_SOURCE = "farfield-server";
const HTTP_REQUEST_OPERATION = "http:request";
const REQUEST_FAILED_SYSTEM_MESSAGE = "Request failed";
const UNKNOWN_REQUEST_METHOD = "unknown";
const UNKNOWN_REQUEST_URL = "unknown";

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

    if (error instanceof z.ZodError) {
      const validationClassification = this.classifier.classifyValidationError(error.message);
      this.recordServerErrorIfNeeded({
        classification: validationClassification,
        normalizedError: error,
        req,
        context
      });
      this.logClassification({
        classification: validationClassification,
        req,
        context
      });
      this.writeErrorResponse({
        res,
        classification: validationClassification,
        context
      });
      return;
    }

    const normalizedError = error instanceof Error
      ? error
      : new Error(this.deps.toErrorMessage(error));
    const classification = this.classifier.classifyRuntimeError(
      normalizedError,
      this.deps.isExpectedShutdownTransportError,
      this.deps.toErrorMessage
    );

    this.deps.setRuntimeLastError(classification.runtimeErrorMessage);
    this.recordServerErrorIfNeeded({
      classification,
      normalizedError,
      req,
      context
    });
    this.logClassification({
      classification,
      req,
      context
    });

    if (classification.shouldPushSystemEvent) {
      this.deps.pushSystem(REQUEST_FAILED_SYSTEM_MESSAGE, {
        error: classification.runtimeErrorMessage,
        errorCategory: classification.category,
        method: req.method ?? UNKNOWN_REQUEST_METHOD,
        url: req.url ?? UNKNOWN_REQUEST_URL,
        requestId: context.requestId,
        actionId: context.actionId,
        actionName: context.actionName
      });
    }

    if (classification.shouldBroadcastRuntimeState) {
      this.deps.broadcastRuntimeState();
    }

    this.writeErrorResponse({
      res,
      classification,
      context
    });
  }

  private recordServerErrorIfNeeded(input: {
    classification: ServerTransportErrorClassification;
    normalizedError: Error;
    req: IncomingMessage;
    context: ServerRequestErrorContext;
  }): void {
    const { classification, normalizedError, req, context } = input;
    if (!classification.shouldRecordServerError) {
      return;
    }

    try {
      this.deps.recordServerErrorEvent({
        source: SERVER_ERROR_SOURCE,
        operation: HTTP_REQUEST_OPERATION,
        message: classification.runtimeErrorMessage,
        severity: classification.severity,
        name: normalizedError.name,
        stack: normalizedError.stack ?? null,
        requestId: context.requestId,
        threadId: null,
        url: req.url ?? null,
        details: {
          method: req.method ?? UNKNOWN_REQUEST_METHOD,
          actionId: context.actionId,
          actionName: context.actionName,
          errorCategory: classification.category
        }
      });
    } catch (recordError) {
      logger.error(
        {
          error: this.deps.toErrorMessage(recordError),
          originalError: classification.runtimeErrorMessage,
          errorCategory: classification.category
        },
        "server-error-record-failed"
      );
    }
  }

  private logClassification(input: {
    classification: ServerTransportErrorClassification;
    req: IncomingMessage;
    context: ServerRequestErrorContext;
  }): void {
    const { classification, req, context } = input;
    const logInput = {
      method: req.method ?? UNKNOWN_REQUEST_METHOD,
      url: req.url ?? UNKNOWN_REQUEST_URL,
      error: classification.runtimeErrorMessage,
      errorCategory: classification.category,
      requestId: context.requestId,
      actionId: context.actionId,
      actionName: context.actionName
    };

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

  private writeErrorResponse(input: {
    res: ServerResponse;
    classification: ServerTransportErrorClassification;
    context: ServerRequestErrorContext;
  }): void {
    const { res, classification, context } = input;
    if (res.headersSent) {
      return;
    }

    this.deps.jsonResponse(res, classification.statusCode, {
      ok: false,
      error: classification.runtimeErrorMessage,
      requestId: context.requestId,
      actionId: context.actionId,
      actionName: context.actionName
    });
  }
}
