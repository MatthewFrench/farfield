import { z } from "zod";
import type { ClientErrorStore } from "../Modules/Debugging/ClientErrorStore.js";
import { logger } from "../Shared/Logging/Logger.js";

const CLIENT_ERROR_RECORDED_LOG_EVENT = "client-error-recorded";

const ServerErrorEventRecordInputSchema = z
  .object({
    source: z.string().trim().min(1),
    operation: z.string().trim().min(1),
    message: z.string().trim().min(1),
    severity: z.enum(["warning", "error"]),
    name: z.string().trim().min(1).nullable(),
    stack: z.string().min(1).nullable(),
    requestId: z.string().trim().min(1).nullable(),
    threadId: z.string().trim().min(1).nullable(),
    url: z.string().trim().min(1).nullable(),
    details: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  })
  .strict();

export type ServerErrorEventRecordInput = z.infer<typeof ServerErrorEventRecordInputSchema>;

interface ServerErrorEventRecorderDependencies {
  readNowIsoString?: () => string;
}

export class ServerErrorEventRecorder {
  private readonly clientErrorStore: ClientErrorStore;
  private readonly readNowIsoString: () => string;

  public constructor(clientErrorStore: ClientErrorStore, dependencies?: ServerErrorEventRecorderDependencies) {
    this.clientErrorStore = clientErrorStore;
    this.readNowIsoString = dependencies?.readNowIsoString ?? (() => new Date().toISOString());
  }

  public record(input: ServerErrorEventRecordInput): void {
    const parsedInput = ServerErrorEventRecordInputSchema.parse(input);
    const occurredAt = this.readNowIsoString();
    const event = this.clientErrorStore.recordServerError({
      source: parsedInput.source,
      operation: parsedInput.operation,
      message: parsedInput.message,
      severity: parsedInput.severity,
      name: parsedInput.name,
      stack: parsedInput.stack,
      requestId: parsedInput.requestId,
      threadId: parsedInput.threadId,
      url: parsedInput.url,
      details: parsedInput.details,
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
      logger.warn(loggerInput, CLIENT_ERROR_RECORDED_LOG_EVENT);
      return;
    }
    logger.error(loggerInput, CLIENT_ERROR_RECORDED_LOG_EVENT);
  }
}
