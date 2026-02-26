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
    const boundedLimit = Number.isInteger(limit) && limit > 0 ? limit : this.maxEntries;
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
    const event = parseDebugErrorEvent({
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

    this.events.push(event);
    this.byId.set(event.errorId, event);
    let didTrimEntries = false;
    if (this.events.length > this.maxEntries) {
      const removed = this.events.shift();
      if (removed) {
        this.byId.delete(removed.errorId);
        didTrimEntries = true;
      }
    }

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
      fs.writeFileSync(this.filePath, "", "utf8");
    }
  }

  private loadExisting(): void {
    const raw = fs.readFileSync(this.filePath, "utf8");
    if (raw.trim().length === 0) {
      return;
    }

    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    const malformedLineSummary: MalformedLineSummary = {
      malformedLineCount: 0,
      sampledLineNumbers: []
    };
    for (const [lineIndex, line] of lines.entries()) {
      try {
        const parsed = parseDebugErrorEvent(JSON.parse(line));
        this.events.push(parsed);
        this.byId.set(parsed.errorId, parsed);
      } catch {
        this.recordMalformedLine(lineIndex + 1, malformedLineSummary);
      }
    }

    if (malformedLineSummary.malformedLineCount > 0) {
      this.logMalformedLineSummary(malformedLineSummary);
    }

    if (this.events.length > this.maxEntries) {
      const nextEvents = this.events.slice(-this.maxEntries);
      this.events = nextEvents;
      this.byId.clear();
      for (const entry of this.events) {
        this.byId.set(entry.errorId, entry);
      }
      this.writeAllEvents();
    }
  }

  public clear(): number {
    const clearedCount = this.events.length;
    this.events = [];
    this.byId.clear();
    fs.writeFileSync(this.filePath, "", "utf8");
    return clearedCount;
  }

  private cloneEvent(event: DebugErrorEvent): DebugErrorEvent {
    return {
      ...event,
      details: { ...event.details }
    };
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
    fs.appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  private writeAllEvents(): void {
    const lines = this.events.map((event) => JSON.stringify(event)).join("\n");
    if (lines.length === 0) {
      fs.writeFileSync(this.filePath, "", "utf8");
      return;
    }
    fs.writeFileSync(this.filePath, `${lines}\n`, "utf8");
  }
}
