import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  parseDebugErrorEvent,
  type CreateDebugClientErrorBody,
  type DebugErrorEvent,
  type DebugErrorSeverity
} from "@farfield/protocol";
import { logger } from "../../Shared/Logging/Logger.js";

const ERROR_IDENTIFIER_PREFIX = "error_";
const MALFORMED_LINE_LOG_EVENT = "client-error-store-skip-malformed-line";
const MALFORMED_LINE_NUMBER_SAMPLE_LIMIT = 5;
const LIST_LIMIT_MINIMUM = 1;
const TEXT_FILE_ENCODING = "utf8";
const NDJSON_LINE_BREAK = "\n";

interface RecordServerErrorInput {
  source: string;
  operation: string;
  message: string;
  severity: DebugErrorSeverity;
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  url: string | null;
  details: DebugErrorEvent["details"];
  occurredAt: string;
}

interface RecordErrorInput {
  origin: DebugErrorEvent["origin"];
  source: string;
  operation: string;
  message: string;
  severity: DebugErrorSeverity;
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  url: string | null;
  details: DebugErrorEvent["details"];
  occurredAt: string;
}

interface MalformedLineSummary {
  malformedLineCount: number;
  sampledLineNumbers: number[];
}

/**
 * Owns the debug client-error session log lifecycle (read, append, trim, clear).
 * Invalid existing NDJSON lines are skipped with one bounded summary warning per load.
 */
export class ClientErrorStore {
  private readonly filePath: string;
  private readonly sessionId: string;
  private readonly maxEntries: number;
  private events: DebugErrorEvent[];
  private readonly byId: Map<string, DebugErrorEvent>;

  public constructor(filePath: string, sessionId: string, maxEntries: number) {
    if (filePath.trim().length === 0) {
      throw new Error("filePath must be a non-empty string");
    }
    if (sessionId.trim().length === 0) {
      throw new Error("sessionId must be a non-empty string");
    }
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error("maxEntries must be a positive integer");
    }

    this.filePath = path.resolve(filePath);
    this.sessionId = sessionId;
    this.maxEntries = maxEntries;
    this.events = [];
    this.byId = new Map();

    this.ensureFile();
    this.loadExisting();
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getSessionLogPath(): string {
    return this.filePath;
  }

  public getCount(): number {
    return this.events.length;
  }

  public list(limit: number): DebugErrorEvent[] {
    const boundedLimit = this.resolveListLimit(limit);
    return this.events.slice(-boundedLimit).map((entry) => this.cloneEvent(entry));
  }

  public getById(errorId: string): DebugErrorEvent | null {
    const entry = this.byId.get(errorId);
    if (!entry) {
      return null;
    }

    return this.cloneEvent(entry);
  }

  public recordClientError(input: CreateDebugClientErrorBody): DebugErrorEvent {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    return this.record({
      origin: "client",
      source: input.source,
      operation: input.operation,
      message: input.message,
      severity: input.severity,
      name: input.name ?? null,
      stack: input.stack ?? null,
      requestId: input.requestId ?? null,
      threadId: input.threadId ?? null,
      url: input.url ?? null,
      details: input.details ?? {},
      occurredAt
    });
  }

  public recordServerError(input: RecordServerErrorInput): DebugErrorEvent {
    return this.record({
      origin: "server",
      source: input.source,
      operation: input.operation,
      message: input.message,
      severity: input.severity,
      name: input.name ?? null,
      stack: input.stack ?? null,
      requestId: input.requestId ?? null,
      threadId: input.threadId ?? null,
      url: input.url ?? null,
      details: input.details ?? {},
      occurredAt: input.occurredAt
    });
  }

  private record(input: RecordErrorInput): DebugErrorEvent {
    const event = this.createEvent(input);

    this.events.push(event);
    this.byId.set(event.errorId, event);
    const didTrimEntries = this.trimToMaximumEntries();

    if (didTrimEntries) {
      this.writeAllEvents();
    } else {
      this.appendEvent(event);
    }
    return this.cloneEvent(event);
  }

  private ensureFile(): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "", TEXT_FILE_ENCODING);
    }
  }

  private loadExisting(): void {
    const raw = fs.readFileSync(this.filePath, TEXT_FILE_ENCODING);
    if (raw.trim().length === 0) {
      return;
    }

    const lines = this.readStoredLines(raw);
    const malformedLineSummary: MalformedLineSummary = {
      malformedLineCount: 0,
      sampledLineNumbers: []
    };
    for (const [lineIndex, line] of lines.entries()) {
      const parsed = this.tryParseStoredLine(line, lineIndex + 1, malformedLineSummary);
      if (parsed) {
        this.events.push(parsed);
        this.byId.set(parsed.errorId, parsed);
      }
    }

    if (malformedLineSummary.malformedLineCount > 0) {
      this.logMalformedLineSummary(malformedLineSummary);
    }

    if (this.trimToMaximumEntries()) {
      this.writeAllEvents();
    }
  }

  public clear(): number {
    const clearedCount = this.events.length;
    this.events = [];
    this.byId.clear();
    fs.writeFileSync(this.filePath, "", TEXT_FILE_ENCODING);
    return clearedCount;
  }

  private cloneEvent(event: DebugErrorEvent): DebugErrorEvent {
    return {
      ...event,
      details: structuredClone(event.details)
    };
  }

  private createEvent(input: RecordErrorInput): DebugErrorEvent {
    return parseDebugErrorEvent({
      errorId: `${ERROR_IDENTIFIER_PREFIX}${randomUUID()}`,
      sessionId: this.sessionId,
      origin: input.origin,
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
      occurredAt: input.occurredAt,
      recordedAt: new Date().toISOString()
    });
  }

  private resolveListLimit(limit: number): number {
    if (Number.isInteger(limit) && limit >= LIST_LIMIT_MINIMUM) {
      return limit;
    }
    return this.maxEntries;
  }

  private readStoredLines(raw: string): string[] {
    return raw.split(NDJSON_LINE_BREAK).filter((line) => line.trim().length > 0);
  }

  private parseStoredLine(line: string): DebugErrorEvent {
    return parseDebugErrorEvent(JSON.parse(line));
  }

  private tryParseStoredLine(
    line: string,
    lineNumber: number,
    malformedLineSummary: MalformedLineSummary
  ): DebugErrorEvent | null {
    try {
      return this.parseStoredLine(line);
    } catch {
      this.recordMalformedLine(lineNumber, malformedLineSummary);
      return null;
    }
  }

  private recordMalformedLine(
    lineNumber: number,
    malformedLineSummary: MalformedLineSummary
  ): void {
    malformedLineSummary.malformedLineCount += 1;
    if (malformedLineSummary.sampledLineNumbers.length < MALFORMED_LINE_NUMBER_SAMPLE_LIMIT) {
      malformedLineSummary.sampledLineNumbers.push(lineNumber);
    }
  }

  private logMalformedLineSummary(malformedLineSummary: MalformedLineSummary): void {
    logger.warn(
      {
        sessionId: this.sessionId,
        logPath: this.filePath,
        malformedLineCount: malformedLineSummary.malformedLineCount,
        sampledLineNumbers: malformedLineSummary.sampledLineNumbers
      },
      MALFORMED_LINE_LOG_EVENT
    );
  }

  private appendEvent(event: DebugErrorEvent): void {
    fs.appendFileSync(
      this.filePath,
      `${this.serializeEvent(event)}${NDJSON_LINE_BREAK}`,
      TEXT_FILE_ENCODING
    );
  }

  private serializeEvent(event: DebugErrorEvent): string {
    return JSON.stringify(event);
  }

  private trimToMaximumEntries(): boolean {
    if (this.events.length <= this.maxEntries) {
      return false;
    }
    this.events = this.events.slice(-this.maxEntries);
    this.rebuildIndex();
    return true;
  }

  private rebuildIndex(): void {
    this.byId.clear();
    for (const entry of this.events) {
      this.byId.set(entry.errorId, entry);
    }
  }

  private writeAllEvents(): void {
    const lines = this.events.map((event) => this.serializeEvent(event)).join(NDJSON_LINE_BREAK);
    if (lines.length === 0) {
      fs.writeFileSync(this.filePath, "", TEXT_FILE_ENCODING);
      return;
    }
    fs.writeFileSync(this.filePath, `${lines}${NDJSON_LINE_BREAK}`, TEXT_FILE_ENCODING);
  }
}
