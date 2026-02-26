import {
  EventRefreshScheduler,
  hasEventRefreshWork,
  type EventRefreshFlags
} from "./EventRefreshScheduler";
import { EventStreamRefreshDecisionEngine } from "./EventStreamRefreshDecisionEngine";
import type { FarfieldThreadStreamDelta } from "@farfield/protocol";

export interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface EventStreamConnectionSnapshot {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
}

export interface EventStreamConnectionCoordinatorStartInput {
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionEngine;
  readSnapshot: () => EventStreamConnectionSnapshot;
  executeScheduledRefresh: (refreshFlags: EventRefreshFlags) => Promise<void>;
  applyThreadStreamDelta: (threadStreamDelta: FarfieldThreadStreamDelta) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  eventsUrl?: string;
}

interface EventStreamConnectionCoordinatorContext {
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionEngine;
  readSnapshot: () => EventStreamConnectionSnapshot;
  executeScheduledRefresh: (refreshFlags: EventRefreshFlags) => Promise<void>;
  applyThreadStreamDelta: (threadStreamDelta: FarfieldThreadStreamDelta) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  eventsUrl: string;
}

interface EventStreamConnectionCoordinatorDependencies {
  createEventSource?: (url: string) => EventSourceLike;
  scheduleTimeout?: (callback: () => void, delayMs: number) => number;
  clearScheduledTimeout?: (timerId: number) => void;
  initialReconnectDelayMs?: number;
  maximumReconnectDelayMs?: number;
}

const DEFAULT_INITIAL_RECONNECT_DELAY_MS = 1_000;
const DEFAULT_MAXIMUM_RECONNECT_DELAY_MS = 10_000;
const DEFAULT_EVENTS_URL = "/events";

function readValidatedReconnectDelayMilliseconds(
  delayMilliseconds: number | undefined,
  defaultDelayMilliseconds: number,
  propertyName: string
): number {
  const nextDelayMilliseconds = delayMilliseconds ?? defaultDelayMilliseconds;
  if (!Number.isInteger(nextDelayMilliseconds) || nextDelayMilliseconds < 0) {
    throw new Error(
      `EventStreamConnectionCoordinator requires a non-negative integer ${propertyName}`
    );
  }
  return nextDelayMilliseconds;
}

/**
 * Owns EventSource lifecycle and reconnect backoff for runtime updates.
 * Refresh work is delegated to injected schedulers/loaders so this class stays transport-focused.
 */
export class EventStreamConnectionCoordinator {
  private readonly createEventSource: (url: string) => EventSourceLike;
  private readonly scheduleTimeout: (callback: () => void, delayMs: number) => number;
  private readonly clearScheduledTimeout: (timerId: number) => void;
  private readonly initialReconnectDelayMs: number;
  private readonly maximumReconnectDelayMs: number;
  private reconnectDelayMs: number;
  private reconnectTimerId: number | null;
  private source: EventSourceLike | null;
  private context: EventStreamConnectionCoordinatorContext | null;
  private disposed: boolean;

  public constructor(dependencies?: EventStreamConnectionCoordinatorDependencies) {
    const initialReconnectDelayMilliseconds = readValidatedReconnectDelayMilliseconds(
      dependencies?.initialReconnectDelayMs,
      DEFAULT_INITIAL_RECONNECT_DELAY_MS,
      "initialReconnectDelayMs"
    );
    const maximumReconnectDelayMilliseconds = readValidatedReconnectDelayMilliseconds(
      dependencies?.maximumReconnectDelayMs,
      DEFAULT_MAXIMUM_RECONNECT_DELAY_MS,
      "maximumReconnectDelayMs"
    );
    if (maximumReconnectDelayMilliseconds < initialReconnectDelayMilliseconds) {
      throw new Error(
        "EventStreamConnectionCoordinator requires maximumReconnectDelayMs to be greater than or equal to initialReconnectDelayMs"
      );
    }

    this.createEventSource = dependencies?.createEventSource ?? ((url) => new EventSource(url));
    this.scheduleTimeout =
      dependencies?.scheduleTimeout ?? ((callback, delayMs) => window.setTimeout(callback, delayMs));
    this.clearScheduledTimeout = dependencies?.clearScheduledTimeout ?? ((timerId) => window.clearTimeout(timerId));
    this.initialReconnectDelayMs = initialReconnectDelayMilliseconds;
    this.maximumReconnectDelayMs = maximumReconnectDelayMilliseconds;
    this.reconnectDelayMs = this.initialReconnectDelayMs;
    this.reconnectTimerId = null;
    this.source = null;
    this.context = null;
    this.disposed = true;
  }

  public start(input: EventStreamConnectionCoordinatorStartInput): void {
    this.stop();

    this.context = {
      eventRefreshScheduler: input.eventRefreshScheduler,
      eventStreamRefreshDecisionEngine: input.eventStreamRefreshDecisionEngine,
      readSnapshot: input.readSnapshot,
      executeScheduledRefresh: input.executeScheduledRefresh,
      applyThreadStreamDelta: input.applyThreadStreamDelta,
      onConnectionStatusChange: input.onConnectionStatusChange,
      eventsUrl: input.eventsUrl ?? DEFAULT_EVENTS_URL
    };
    this.reconnectDelayMs = this.initialReconnectDelayMs;
    this.disposed = false;
    this.connectEvents();
  }

  public stop(): void {
    this.disposed = true;
    if (this.reconnectTimerId !== null) {
      this.clearScheduledTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }
    this.closeSource();
    if (this.context) {
      this.context.eventRefreshScheduler.dispose();
      this.context.onConnectionStatusChange(false);
    }
    this.context = null;
    this.reconnectDelayMs = this.initialReconnectDelayMs;
  }

  private connectEvents(): void {
    if (this.disposed || !this.context) {
      return;
    }

    this.source = this.createEventSource(this.context.eventsUrl);
    this.source.onopen = () => {
      if (!this.context) {
        return;
      }
      this.context.onConnectionStatusChange(true);
      this.reconnectDelayMs = this.initialReconnectDelayMs;
      const snapshot = this.context.readSnapshot();
      this.scheduleRefresh({
        refreshCore: true,
        refreshHistory: snapshot.activeTab === "debug",
        refreshSelectedThread: Boolean(snapshot.selectedThreadId)
      });
    };
    this.source.onmessage = (event) => {
      if (!this.context) {
        return;
      }
      const snapshot = this.context.readSnapshot();
      const refreshDecision = this.context.eventStreamRefreshDecisionEngine.readDecision({
        activeTab: snapshot.activeTab,
        selectedThreadId: snapshot.selectedThreadId,
        eventData: event.data
      });
      this.scheduleRefresh({
        refreshCore: refreshDecision.refreshCore,
        refreshHistory: refreshDecision.refreshHistory,
        refreshSelectedThread: refreshDecision.refreshSelectedThread
      });
      if (refreshDecision.threadStreamDelta) {
        this.context.applyThreadStreamDelta(refreshDecision.threadStreamDelta);
      }
    };
    this.source.onerror = () => {
      if (!this.context) {
        return;
      }
      this.context.onConnectionStatusChange(false);
      this.closeSource();
      this.scheduleReconnect();
    };
  }

  private scheduleRefresh(refreshFlags: EventRefreshFlags): void {
    if (!this.context) {
      return;
    }
    if (!hasEventRefreshWork(refreshFlags)) {
      return;
    }
    this.context.eventRefreshScheduler.enqueueRefresh(refreshFlags, async (pendingRefreshFlags) => {
      if (!this.context) {
        return;
      }
      await this.context.executeScheduledRefresh(pendingRefreshFlags);
    });
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimerId !== null) {
      return;
    }
    this.reconnectTimerId = this.scheduleTimeout(() => {
      this.reconnectTimerId = null;
      this.connectEvents();
    }, this.reconnectDelayMs);
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.maximumReconnectDelayMs);
  }

  private closeSource(): void {
    if (!this.source) {
      return;
    }
    this.source.close();
    this.source = null;
  }
}
