import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  parseDebugErrorEvent,
  type CreateDebugClientErrorBody,
  type DebugErrorEvent
} from "@farfield/protocol";
import { logger } from "../../Shared/Logging/Logger.js";

interface RecordServerErrorInput {
  source: string;
  operation: string;
  message: string;
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
  name: string | null;
  stack: string | null;
  requestId: string | null;
  threadId: string | null;
  url: string | null;
  details: DebugErrorEvent["details"];
  occurredAt: string;
}

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
    return this.events.slice(-boundedLimit).map((entry) => ({
      ...entry,
      details: { ...entry.details }
    }));
  }

  public getById(errorId: string): DebugErrorEvent | null {
    const entry = this.byId.get(errorId);
    if (!entry) {
      return null;
    }

    return {
      ...entry,
      details: { ...entry.details }
    };
  }

  public recordClientError(input: CreateDebugClientErrorBody): DebugErrorEvent {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    return this.record({
      origin: "client",
      source: input.source,
      operation: input.operation,
      message: input.message,
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
      errorId: `error_${randomUUID()}`,
      sessionId: this.sessionId,
      origin: input.origin,
      source: input.source,
      operation: input.operation,
      message: input.message,
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
    if (this.events.length > this.maxEntries) {
      const removed = this.events.shift();
      if (removed) {
        this.byId.delete(removed.errorId);
      }
    }

    this.appendEvent(event);
    return {
      ...event,
      details: { ...event.details }
    };
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
    for (const [lineIndex, line] of lines.entries()) {
      try {
        const parsed = parseDebugErrorEvent(JSON.parse(line));
        this.events.push(parsed);
        this.byId.set(parsed.errorId, parsed);
      } catch {
        logger.warn(
          {
            sessionId: this.sessionId,
            logPath: this.filePath,
            lineNumber: lineIndex + 1
          },
          "client-error-store-skip-malformed-line"
        );
      }
    }

    if (this.events.length > this.maxEntries) {
      const nextEvents = this.events.slice(-this.maxEntries);
      this.events = nextEvents;
      this.byId.clear();
      for (const entry of this.events) {
        this.byId.set(entry.errorId, entry);
      }
    }
  }

  private appendEvent(event: DebugErrorEvent): void {
    fs.appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
  }
}
