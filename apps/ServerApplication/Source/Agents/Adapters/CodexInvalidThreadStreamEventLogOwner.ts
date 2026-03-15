import fs from "node:fs";
import path from "node:path";
import { type IpcFrame, JsonValueSchema, ProtocolValidationError } from "@farfield/protocol";
import { logger } from "../../Shared/Logging/Logger.js";
import {
  describeCodexIpcFrame,
  extractThreadIdFromCodexIpcFrame,
} from "./CodexThreadStreamFrameDescriptionContracts.js";

interface InvalidThreadStreamEventDetail {
  threadId: string | null;
  error: string;
  issues?: string[];
  rawPayload: IpcFrame;
  loggedAt: string;
}

interface InvalidThreadStreamEventLogSummary {
  threadId: string | null;
  method: string;
  error: string;
  issues?: string[];
  rawPayloadByteCount: number;
  loggedAt: string;
}

const INVALID_THREAD_STREAM_EVENT_DETAIL_LOG_NAME = "codex-invalid-thread-stream-event-detail";
const INVALID_THREAD_STREAM_EVENT_DETAIL_WRITE_FAILED_LOG_NAME =
  "codex-invalid-thread-stream-event-detail-write-failed";
const INVALID_THREAD_STREAM_EVENT_DIRECTORY_CREATE_FAILED_LOG_NAME =
  "codex-invalid-thread-stream-event-detail-directory-create-failed";

/**
 * Owns malformed stream-event persistence so protocol violations can be
 * inspected without coupling parser failure handling into transport owners.
 */
export class CodexInvalidThreadStreamEventLogOwner {
  public constructor(private readonly invalidStreamEventsLogPath: string) {
    this.ensureInvalidStreamEventLogDirectoryExists();
  }

  public recordInvalidThreadStreamEvent<ErrorType>(frame: IpcFrame, error: ErrorType): void {
    const invalidEventDetail = this.createInvalidStreamEventDetail(frame, error);
    logger.warn(
      this.createInvalidStreamEventLogSummary(invalidEventDetail),
      INVALID_THREAD_STREAM_EVENT_DETAIL_LOG_NAME,
    );
    this.writeInvalidStreamEventDetail(invalidEventDetail);
  }

  private writeInvalidStreamEventDetail(detail: InvalidThreadStreamEventDetail): void {
    try {
      const parsedDetail = JsonValueSchema.parse(detail);
      fs.appendFileSync(this.invalidStreamEventsLogPath, JSON.stringify(parsedDetail) + "\n", {
        encoding: "utf8",
      });
    } catch (error) {
      logger.warn(
        {
          path: this.invalidStreamEventsLogPath,
          error: toErrorMessage(error),
        },
        INVALID_THREAD_STREAM_EVENT_DETAIL_WRITE_FAILED_LOG_NAME,
      );
    }
  }

  private ensureInvalidStreamEventLogDirectoryExists(): void {
    try {
      fs.mkdirSync(path.dirname(this.invalidStreamEventsLogPath), {
        recursive: true,
      });
    } catch (error) {
      logger.warn(
        {
          path: this.invalidStreamEventsLogPath,
          error: toErrorMessage(error),
        },
        INVALID_THREAD_STREAM_EVENT_DIRECTORY_CREATE_FAILED_LOG_NAME,
      );
    }
  }

  private createInvalidStreamEventDetail<ErrorType>(
    frame: IpcFrame,
    error: ErrorType,
  ): InvalidThreadStreamEventDetail {
    return {
      threadId: extractThreadIdFromCodexIpcFrame(frame),
      error: toErrorMessage(error),
      ...(error instanceof ProtocolValidationError ? { issues: error.issues } : {}),
      rawPayload: frame,
      loggedAt: new Date().toISOString(),
    };
  }

  private createInvalidStreamEventLogSummary(
    detail: InvalidThreadStreamEventDetail,
  ): InvalidThreadStreamEventLogSummary {
    return {
      threadId: detail.threadId,
      method: describeCodexIpcFrame(detail.rawPayload).method,
      error: detail.error,
      ...(detail.issues ? { issues: detail.issues } : {}),
      rawPayloadByteCount: Buffer.byteLength(JSON.stringify(detail.rawPayload), "utf8"),
      loggedAt: detail.loggedAt,
    };
  }
}

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}
