import { type DebugErrorEvent, type DebugErrorSeverity, JsonValueSchema } from "@farfield/protocol";
import { z } from "zod";
import type { ClientErrorStore } from "../Modules/Debugging/ClientErrorStore.js";
import { logger } from "../Shared/Logging/Logger.js";

const CLIENT_ERROR_RECORDED_LOG_EVENT = "client-error-recorded";
const ISO_TIMESTAMP_SCHEMA = z.string().datetime();

// Owns the severity-to-log-level mapping for persisted server error events.
const LOG_LEVEL_BY_SEVERITY: Record<DebugErrorSeverity, "warn" | "error"> = {
  warning: "warn",
  error: "error",
};

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
    details: z.record(JsonValueSchema),
  })
  .strict();

export type ServerErrorEventRecordInput = z.infer<typeof ServerErrorEventRecordInputSchema>;

interface ServerErrorRecordedLogInput {
  errorId: string;
  origin: DebugErrorEvent["origin"];
  severity: DebugErrorSeverity;
  source: string;
  operation: string;
  requestId: string | null;
  threadId: string | null;
  message: string;
}

interface ServerErrorEventRecorderDependencies {
  readNowIsoString?: () => string;
}

export class ServerErrorEventRecorder {
  private readonly clientErrorStore: ClientErrorStore;
  private readonly readNowIsoString: () => string;

  public constructor(
    clientErrorStore: ClientErrorStore,
    dependencies?: ServerErrorEventRecorderDependencies,
  ) {
    this.clientErrorStore = clientErrorStore;
    this.readNowIsoString = dependencies?.readNowIsoString ?? (() => new Date().toISOString());
  }

  public record(input: ServerErrorEventRecordInput): void {
    const parsedInput = ServerErrorEventRecordInputSchema.parse(input);
    const occurredAt = this.readOccurredAtIsoString();
    const recordedEvent = this.clientErrorStore.recordServerError({
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
      occurredAt,
    });
    this.logRecordedEvent(recordedEvent);
  }

  private readOccurredAtIsoString(): string {
    return ISO_TIMESTAMP_SCHEMA.parse(this.readNowIsoString());
  }

  private createRecordedLogInput(recordedEvent: DebugErrorEvent): ServerErrorRecordedLogInput {
    return {
      errorId: recordedEvent.errorId,
      origin: recordedEvent.origin,
      severity: recordedEvent.severity,
      source: recordedEvent.source,
      operation: recordedEvent.operation,
      requestId: recordedEvent.requestId,
      threadId: recordedEvent.threadId,
      message: recordedEvent.message,
    };
  }

  private logRecordedEvent(recordedEvent: DebugErrorEvent): void {
    const loggerInput = this.createRecordedLogInput(recordedEvent);
    const logLevel = LOG_LEVEL_BY_SEVERITY[recordedEvent.severity];
    if (logLevel === "warn") {
      logger.warn(loggerInput, CLIENT_ERROR_RECORDED_LOG_EVENT);
      return;
    }
    logger.error(loggerInput, CLIENT_ERROR_RECORDED_LOG_EVENT);
  }
}
