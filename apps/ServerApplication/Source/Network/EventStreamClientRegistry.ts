import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type FarfieldEventStreamEnvelope,
  type FarfieldEventStreamEvent
} from "@farfield/protocol";

const EVENT_STREAM_RESPONSE_STATUS_CODE_OK = 200;
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
const EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME = "close";

interface EventStreamClientLifecycleBinding {
  request: IncomingMessage;
  closeHandler: () => void;
}

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

// Owns server-sent-events client lifecycle registration and teardown for active responses.
// Listener bindings are tracked per response so every removal path detaches request/response
// close handlers deterministically, including write-failure cleanup paths.
export class EventStreamClientRegistry {
  private readonly keepaliveIntervalMs: number;
  private readonly clientSet: Set<ServerResponse>;
  private readonly clientLifecycleBindingByResponse: Map<ServerResponse, EventStreamClientLifecycleBinding>;
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
    this.clientLifecycleBindingByResponse = new Map<ServerResponse, EventStreamClientLifecycleBinding>();
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

    // Iterate a snapshot so close handlers can mutate the owner set during teardown.
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
    res.writeHead(EVENT_STREAM_RESPONSE_STATUS_CODE_OK, EVENT_STREAM_HEADERS);
    res.write(EVENT_STREAM_RETRY_DIRECTIVE);

    this.bindClientLifecycle(req, res);
    this.writeEvent(res, {
      sequence: this.lastBroadcastSequence,
      event: initialEvent
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

  private bindClientLifecycle(req: IncomingMessage, res: ServerResponse): void {
    this.unbindClientLifecycle(res);

    const closeHandler = (): void => {
      this.removeClient(res);
    };
    req.on(EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME, closeHandler);
    res.on(EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME, closeHandler);

    this.clientSet.add(res);
    this.clientLifecycleBindingByResponse.set(res, {
      request: req,
      closeHandler
    });
    this.addedClientCount += 1;
  }

  private unbindClientLifecycle(client: ServerResponse): void {
    const lifecycleBinding = this.clientLifecycleBindingByResponse.get(client);
    if (!lifecycleBinding) {
      return;
    }

    lifecycleBinding.request.off(EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME, lifecycleBinding.closeHandler);
    client.off(EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME, lifecycleBinding.closeHandler);
    this.clientLifecycleBindingByResponse.delete(client);
  }

  private removeClient(client: ServerResponse): void {
    const removedActiveClient = this.clientSet.delete(client);
    this.unbindClientLifecycle(client);
    if (!removedActiveClient) {
      return;
    }
    this.removedClientCount += 1;
  }
}
