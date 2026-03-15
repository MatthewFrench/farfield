import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type FarfieldEventStreamEnvelope,
  type FarfieldEventStreamEvent,
} from "@farfield/protocol";

const EVENT_STREAM_RESPONSE_STATUS_CODE_OK = 200;
const EVENT_STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "x-farfield-token, x-farfield-request-id, x-farfield-action-id, x-farfield-action-name",
} as const;
const EVENT_STREAM_RETRY_DIRECTIVE = "retry: 1000\n\n";
const EVENT_STREAM_KEEPALIVE_FRAME = ": keepalive\n\n";
const EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME = "close";

interface EventStreamClientLifecycleBinding {
  request: IncomingMessage;
  closeHandler: () => void;
  drainHandler: () => void;
}

interface EventStreamQueuedFrame {
  kind: "event" | "keepalive";
  payload: string;
}

interface EventStreamClientWriteState {
  isWaitingForDrain: boolean;
  queuedFrames: EventStreamQueuedFrame[];
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
// close/drain handlers deterministically while queued frames preserve ordering during
// backpressure recovery instead of disconnecting healthy slow consumers.
export class EventStreamClientRegistry {
  private readonly keepaliveIntervalMs: number;
  private readonly clientSet: Set<ServerResponse>;
  private readonly clientLifecycleBindingByResponse: Map<
    ServerResponse,
    EventStreamClientLifecycleBinding
  >;
  private readonly clientWriteStateByResponse: Map<ServerResponse, EventStreamClientWriteState>;
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
    this.clientLifecycleBindingByResponse = new Map<
      ServerResponse,
      EventStreamClientLifecycleBinding
    >();
    this.clientWriteStateByResponse = new Map<ServerResponse, EventStreamClientWriteState>();
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

  public addClient(
    req: IncomingMessage,
    res: ServerResponse,
    initialEvent: FarfieldEventStreamEvent,
  ): void {
    res.writeHead(EVENT_STREAM_RESPONSE_STATUS_CODE_OK, EVENT_STREAM_HEADERS);
    this.bindClientLifecycle(req, res);
    this.enqueueFrame(res, {
      kind: "keepalive",
      payload: EVENT_STREAM_RETRY_DIRECTIVE,
    });
    this.writeEvent(res, {
      sequence: this.lastBroadcastSequence,
      event: initialEvent,
    });
  }

  public broadcast(event: FarfieldEventStreamEvent): void {
    this.broadcastEventCount += 1;
    this.lastBroadcastSequence += 1;
    const envelope: FarfieldEventStreamEnvelope = {
      sequence: this.lastBroadcastSequence,
      event,
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
      keepaliveWriteFailureCount: this.keepaliveWriteFailureCount,
    };
  }

  private writeEvent(client: ServerResponse, envelope: FarfieldEventStreamEnvelope): void {
    const eventFrame = `id: ${String(envelope.sequence)}\ndata: ${JSON.stringify(envelope)}\n\n`;
    this.enqueueFrame(client, {
      kind: "event",
      payload: eventFrame,
    });
  }

  private writeKeepalive(): void {
    for (const client of this.clientSet) {
      this.enqueueFrame(client, {
        kind: "keepalive",
        payload: EVENT_STREAM_KEEPALIVE_FRAME,
      });
    }
  }

  private bindClientLifecycle(req: IncomingMessage, res: ServerResponse): void {
    this.unbindClientLifecycle(res);

    const closeHandler = (): void => {
      this.removeClient(res);
    };
    const drainHandler = (): void => {
      const clientWriteState = this.clientWriteStateByResponse.get(res);
      if (!clientWriteState) {
        return;
      }

      clientWriteState.isWaitingForDrain = false;
      this.flushQueuedFrames(res);
    };
    req.on(EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME, closeHandler);
    res.on(EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME, closeHandler);
    res.on("drain", drainHandler);

    this.clientSet.add(res);
    this.clientWriteStateByResponse.set(res, {
      isWaitingForDrain: false,
      queuedFrames: [],
    });
    this.clientLifecycleBindingByResponse.set(res, {
      request: req,
      closeHandler,
      drainHandler,
    });
    this.addedClientCount += 1;
  }

  private unbindClientLifecycle(client: ServerResponse): void {
    const lifecycleBinding = this.clientLifecycleBindingByResponse.get(client);
    if (!lifecycleBinding) {
      return;
    }

    lifecycleBinding.request.off(
      EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME,
      lifecycleBinding.closeHandler,
    );
    client.off(EVENT_STREAM_CONNECTION_CLOSE_EVENT_NAME, lifecycleBinding.closeHandler);
    client.off("drain", lifecycleBinding.drainHandler);
    this.clientLifecycleBindingByResponse.delete(client);
  }

  private removeClient(client: ServerResponse): void {
    const removedActiveClient = this.clientSet.delete(client);
    this.clientWriteStateByResponse.delete(client);
    this.unbindClientLifecycle(client);
    if (!removedActiveClient) {
      return;
    }
    this.removedClientCount += 1;
  }

  private enqueueFrame(client: ServerResponse, frame: EventStreamQueuedFrame): void {
    const clientWriteState = this.clientWriteStateByResponse.get(client);
    if (!clientWriteState) {
      return;
    }

    clientWriteState.queuedFrames.push(frame);
    this.flushQueuedFrames(client);
  }

  private flushQueuedFrames(client: ServerResponse): void {
    const clientWriteState = this.clientWriteStateByResponse.get(client);
    if (!clientWriteState) {
      return;
    }

    if (clientWriteState.isWaitingForDrain) {
      return;
    }

    while (clientWriteState.queuedFrames.length > 0) {
      const nextFrame = clientWriteState.queuedFrames[0];
      if (nextFrame === undefined) {
        return;
      }
      try {
        const writeAccepted = client.write(nextFrame.payload);
        clientWriteState.queuedFrames.shift();
        if (!writeAccepted) {
          clientWriteState.isWaitingForDrain = true;
          return;
        }
      } catch {
        if (nextFrame.kind === "event") {
          this.eventWriteFailureCount += 1;
        } else {
          this.keepaliveWriteFailureCount += 1;
        }
        this.removeClient(client);
        client.destroy();
        return;
      }
    }
  }
}
