import { type DebugErrorSeverity } from "@farfield/protocol";
import type { ClientErrorStore } from "../Modules/Debugging/ClientErrorStore.js";
import { logger } from "../Shared/Logging/Logger.js";

export interface ServerErrorEventRecordInput {
  source: string;
  operation: string;
  message: string;
  severity: DebugErrorSeverity;
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  url: string | null;
  details: Record<string, string | number | boolean | null>;
}

export class ServerErrorEventRecorder {
  private readonly clientErrorStore: ClientErrorStore;

  public constructor(clientErrorStore: ClientErrorStore) {
    this.clientErrorStore = clientErrorStore;
  }

  public record(input: ServerErrorEventRecordInput): void {
    const occurredAt = new Date().toISOString();
    const event = this.clientErrorStore.recordServerError({
      source: input.source,
      operation: input.operation,
      message: input.message,
      severity: input.severity,
      name: input.name,
      stack: input.stack,
      requestId: input.requestId,
      threadId: input.threadId,
      url: input.url,
      details: input.details,
      occurredAt
    });

    const loggerInput = {
      errorId: event.errorId,
      origin: event.origin,
      severity: event.severity,
      source: event.source,
      operation: event.operation,
      requestId: event.requestId,
      threadId: event.threadId,
      message: event.message
    };
    if (event.severity === "warning") {
      logger.warn(loggerInput, "client-error-recorded");
      return;
    }
    logger.error(loggerInput, "client-error-recorded");
  }
}
