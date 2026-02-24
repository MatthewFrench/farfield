import type { ClientErrorStore } from "../Modules/Debugging/ClientErrorStore.js";
import { logger } from "../Shared/Logging/Logger.js";

export interface ServerErrorEventRecordInput {
  source: string;
  operation: string;
  message: string;
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
      name: input.name,
      stack: input.stack,
      requestId: input.requestId,
      threadId: input.threadId,
      url: input.url,
      details: input.details,
      occurredAt
    });

    logger.error(
      {
        errorId: event.errorId,
        origin: event.origin,
        source: event.source,
        operation: event.operation,
        requestId: event.requestId,
        threadId: event.threadId,
        message: event.message
      },
      "client-error-recorded"
    );
  }
}
