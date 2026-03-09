import type { JsonValue } from "@farfield/protocol";

export interface AppServerNotificationEvent {
  sequence: number;
  method: string;
  params: JsonValue | null;
  receivedAtMilliseconds: number;
}

export interface AppServerReadNotificationEventsInput {
  limit: number;
  sinceSequence: number | null;
}

export interface AppServerReadNotificationEventsResult {
  events: AppServerNotificationEvent[];
  nextSequence: number;
  firstAvailableSequence: number;
  resetRequired: boolean;
}

interface AppServerNotificationBufferOwnerOptions {
  maximumEventCount: number;
  maximumRetainedBytes: number;
}

const INITIAL_NOTIFICATION_SEQUENCE = 0;
const RESET_CURSOR_SEQUENCE_OFFSET = 1;

function measureNotificationEventBytes(event: AppServerNotificationEvent): number {
  return Buffer.byteLength(JSON.stringify(event), "utf8");
}

/**
 * Owns bounded in-memory retention for app-server notification events.
 * The owner enforces both event-count and byte budgets so long-lived adapter sessions
 * cannot retain unbounded notification payloads in memory.
 */
export class AppServerNotificationBufferOwner {
  private readonly maximumEventCount: number;
  private readonly maximumRetainedBytes: number;
  private readonly events: AppServerNotificationEvent[] = [];
  private readonly retainedBytesBySequence = new Map<number, number>();
  private nextSequence = INITIAL_NOTIFICATION_SEQUENCE;
  private totalRetainedBytes = 0;

  public constructor(options: AppServerNotificationBufferOwnerOptions) {
    if (!Number.isInteger(options.maximumEventCount) || options.maximumEventCount <= 0) {
      throw new Error(
        "AppServerNotificationBufferOwner requires positive integer maximumEventCount",
      );
    }
    if (!Number.isInteger(options.maximumRetainedBytes) || options.maximumRetainedBytes <= 0) {
      throw new Error(
        "AppServerNotificationBufferOwner requires positive integer maximumRetainedBytes",
      );
    }
    this.maximumEventCount = options.maximumEventCount;
    this.maximumRetainedBytes = options.maximumRetainedBytes;
  }

  public reset(): void {
    this.events.length = 0;
    this.retainedBytesBySequence.clear();
    this.nextSequence = INITIAL_NOTIFICATION_SEQUENCE;
    this.totalRetainedBytes = 0;
  }

  public append(method: string, params: JsonValue | null, receivedAtMilliseconds: number): void {
    const event: AppServerNotificationEvent = {
      sequence: this.nextSequence,
      method,
      params,
      receivedAtMilliseconds,
    };
    this.nextSequence += 1;

    this.events.push(event);
    const retainedBytes = measureNotificationEventBytes(event);
    this.retainedBytesBySequence.set(event.sequence, retainedBytes);
    this.totalRetainedBytes += retainedBytes;
    this.evictUntilWithinBounds();
  }

  public read(input: AppServerReadNotificationEventsInput): AppServerReadNotificationEventsResult {
    const nextSequence = this.nextSequence;
    const firstEvent = this.events[0];
    const firstAvailableSequence = firstEvent ? firstEvent.sequence : nextSequence;

    let resetRequired = false;
    if (input.sinceSequence !== null) {
      resetRequired =
        input.sinceSequence < firstAvailableSequence - RESET_CURSOR_SEQUENCE_OFFSET ||
        input.sinceSequence >= nextSequence;
    }

    const sinceSequence = input.sinceSequence;
    let selectedEvents: AppServerNotificationEvent[];
    if (resetRequired || sinceSequence === null) {
      selectedEvents = this.events.slice(-input.limit);
    } else {
      selectedEvents = this.events.filter((event) => event.sequence > sinceSequence);
    }

    return {
      events: selectedEvents,
      nextSequence,
      firstAvailableSequence,
      resetRequired,
    };
  }

  private evictUntilWithinBounds(): void {
    while (
      this.events.length > this.maximumEventCount ||
      this.totalRetainedBytes > this.maximumRetainedBytes
    ) {
      const oldestEvent = this.events.shift();
      if (oldestEvent === undefined) {
        return;
      }
      const retainedBytes = this.retainedBytesBySequence.get(oldestEvent.sequence);
      if (retainedBytes !== undefined) {
        this.totalRetainedBytes -= retainedBytes;
        this.retainedBytesBySequence.delete(oldestEvent.sequence);
      }
    }
  }
}
