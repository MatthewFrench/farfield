import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type FarfieldEventStreamEnvelope,
  type FarfieldEventStreamEvent
} from "@farfield/protocol";

const EVENT_STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-farfield-token, x-farfield-request-id, x-farfield-action-id, x-farfield-action-name"
} as const;
const EVENT_STREAM_RETRY_DIRECTIVE = "retry: 1000\n\n";
const EVENT_STREAM_KEEPALIVE_FRAME = ": keepalive\n\n";

export interface EventStreamClientRegistryStatistics {
  activeClientCount: number;
  keepaliveEnabled: boolean;
  addedClientCount: number;
  removedClientCount: number;
  broadcastEventCount: number;
  broadcastDeliveryAttemptCount: number;
  eventWriteFailureCount: number;
  keepaliveWriteFailureCount: number;
}

export class EventStreamClientRegistry {
  private readonly keepaliveIntervalMs: number;
  private readonly clientSet: Set<ServerResponse>;
  private keepaliveTimer: NodeJS.Timeout | null;
  private lastBroadcastSequence: number;
  private addedClientCount: number;
  private removedClientCount: number;
  private broadcastEventCount: number;
  private broadcastDeliveryAttemptCount: number;
  private eventWriteFailureCount: number;
  private keepaliveWriteFailureCount: number;

  public constructor(keepaliveIntervalMs: number) {
    if (!Number.isInteger(keepaliveIntervalMs) || keepaliveIntervalMs <= 0) {
      throw new Error("EventStreamClientRegistry requires positive integer keepaliveIntervalMs");
    }

    this.keepaliveIntervalMs = keepaliveIntervalMs;
    this.clientSet = new Set<ServerResponse>();
    this.keepaliveTimer = null;
    this.lastBroadcastSequence = 0;
    this.addedClientCount = 0;
    this.removedClientCount = 0;
    this.broadcastEventCount = 0;
    this.broadcastDeliveryAttemptCount = 0;
    this.eventWriteFailureCount = 0;
    this.keepaliveWriteFailureCount = 0;
  }

  public startKeepalive(): void {
    if (this.keepaliveTimer) {
      return;
    }

    this.keepaliveTimer = setInterval(() => {
      this.writeKeepalive();
    }, this.keepaliveIntervalMs);
  }

  public stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }

    for (const client of Array.from(this.clientSet.values())) {
      try {
        client.end();
      } catch {
        // No-op: client can already be disconnected.
      }
      this.removeClient(client);
    }
  }

  public addClient(req: IncomingMessage, res: ServerResponse, initialEvent: FarfieldEventStreamEvent): void {
    res.writeHead(200, EVENT_STREAM_HEADERS);
    res.write(EVENT_STREAM_RETRY_DIRECTIVE);

    this.clientSet.add(res);
    this.addedClientCount += 1;
    this.writeEvent(res, {
      sequence: this.lastBroadcastSequence,
      event: initialEvent
    });

    req.on("close", () => {
      this.removeClient(res);
    });
    res.on("close", () => {
      this.removeClient(res);
    });
  }

  public broadcast(event: FarfieldEventStreamEvent): void {
    this.broadcastEventCount += 1;
    this.lastBroadcastSequence += 1;
    const envelope: FarfieldEventStreamEnvelope = {
      sequence: this.lastBroadcastSequence,
      event
    };
    for (const client of this.clientSet) {
      this.broadcastDeliveryAttemptCount += 1;
      this.writeEvent(client, envelope);
    }
  }

  public readStatistics(): EventStreamClientRegistryStatistics {
    return {
      activeClientCount: this.clientSet.size,
      keepaliveEnabled: this.keepaliveTimer !== null,
      addedClientCount: this.addedClientCount,
      removedClientCount: this.removedClientCount,
      broadcastEventCount: this.broadcastEventCount,
      broadcastDeliveryAttemptCount: this.broadcastDeliveryAttemptCount,
      eventWriteFailureCount: this.eventWriteFailureCount,
      keepaliveWriteFailureCount: this.keepaliveWriteFailureCount
    };
  }

  private writeEvent(
    client: ServerResponse,
    envelope: FarfieldEventStreamEnvelope
  ): void {
    try {
      client.write(`id: ${String(envelope.sequence)}\n`);
      client.write(`data: ${JSON.stringify(envelope)}\n\n`);
    } catch {
      this.eventWriteFailureCount += 1;
      this.removeClient(client);
    }
  }

  private writeKeepalive(): void {
    for (const client of this.clientSet) {
      try {
        client.write(EVENT_STREAM_KEEPALIVE_FRAME);
      } catch {
        this.keepaliveWriteFailureCount += 1;
        this.removeClient(client);
      }
    }
  }

  private removeClient(client: ServerResponse): void {
    if (!this.clientSet.delete(client)) {
      return;
    }
    this.removedClientCount += 1;
  }
}
