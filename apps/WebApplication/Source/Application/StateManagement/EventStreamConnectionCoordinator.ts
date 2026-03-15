import type { FarfieldThreadStreamDelta } from "@farfield/protocol";
import {
  type EventRefreshFlags,
  EventRefreshScheduler,
  hasEventRefreshWork,
} from "./EventRefreshScheduler";
import {
  type EventStreamRefreshDecision,
  type EventStreamRefreshDecisionReader,
} from "./EventStreamRefreshDecisionEngine";

export interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface EventStreamConnectionSnapshot {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
  selectedThreadHydrated: boolean;
}

export interface EventStreamConnectionCoordinatorStartInput {
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionReader;
  readSnapshot: () => EventStreamConnectionSnapshot;
  executeScheduledRefresh: (refreshFlags: EventRefreshFlags) => Promise<void>;
  applyThreadStreamDelta: (threadStreamDelta: FarfieldThreadStreamDelta) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  eventsUrl?: string;
}

interface EventStreamConnectionCoordinatorContext {
  eventRefreshScheduler: EventRefreshScheduler;
  eventStreamRefreshDecisionEngine: EventStreamRefreshDecisionReader;
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
const DEBUG_ACTIVE_TAB: EventStreamConnectionSnapshot["activeTab"] = "debug";
const RECONNECT_DELAY_PROPERTY_NAME_INITIAL = "initialReconnectDelayMs";
const RECONNECT_DELAY_PROPERTY_NAME_MAXIMUM = "maximumReconnectDelayMs";
const RECONNECT_DELAY_VALIDATION_ERROR_PREFIX =
  "EventStreamConnectionCoordinator requires a non-negative integer";
const RECONNECT_DELAY_RELATIONSHIP_ERROR_MESSAGE =
  "EventStreamConnectionCoordinator requires maximumReconnectDelayMs to be greater than or equal to initialReconnectDelayMs";
const RECONNECT_DELAY_BACKOFF_MULTIPLIER = 2;

function createNonNegativeReconnectDelayError(propertyName: string): Error {
  return new Error(`${RECONNECT_DELAY_VALIDATION_ERROR_PREFIX} ${propertyName}`);
}

function readInitialRefreshFlags(input: {
  snapshot: EventStreamConnectionSnapshot;
  hasConnectedBefore: boolean;
}): EventRefreshFlags {
  const { snapshot, hasConnectedBefore } = input;
  return {
    // Initial startup already runs the core refresh path through application refresh effects.
    // Reserve EventSource-open core refresh for reconnect recovery so first open does not
    // immediately invalidate and reread the active sidebar query a second time.
    refreshCore: hasConnectedBefore,
    refreshHistory: snapshot.activeTab === DEBUG_ACTIVE_TAB,
    refreshSelectedThread: hasConnectedBefore
      ? Boolean(snapshot.selectedThreadId)
      : Boolean(snapshot.selectedThreadId) && !snapshot.selectedThreadHydrated,
    refreshNotificationProjections: true,
  };
}

function readRefreshFlagsFromDecision(decision: EventStreamRefreshDecision): EventRefreshFlags {
  return {
    refreshCore: decision.refreshCore,
    refreshHistory: decision.refreshHistory,
    refreshSelectedThread: decision.refreshSelectedThread,
    refreshNotificationProjections: decision.refreshNotificationProjections,
  };
}

function readRefreshFlagsFromDecisionFailure(
  snapshot: EventStreamConnectionSnapshot,
): EventRefreshFlags {
  return {
    refreshCore: true,
    refreshHistory: snapshot.activeTab === DEBUG_ACTIVE_TAB,
    refreshSelectedThread: false,
    refreshNotificationProjections: false,
  };
}

function readValidatedReconnectDelayMilliseconds(
  delayMilliseconds: number | undefined,
  defaultDelayMilliseconds: number,
  propertyName: string,
): number {
  const nextDelayMilliseconds = delayMilliseconds ?? defaultDelayMilliseconds;
  if (!Number.isInteger(nextDelayMilliseconds) || nextDelayMilliseconds < 0) {
    throw createNonNegativeReconnectDelayError(propertyName);
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
  private pendingEventMessageExecution: Promise<void>;
  private connectionGeneration: number;
  private source: EventSourceLike | null;
  private context: EventStreamConnectionCoordinatorContext | null;
  private disposed: boolean;
  private hasConnectedBefore: boolean;

  public constructor(dependencies?: EventStreamConnectionCoordinatorDependencies) {
    const initialReconnectDelayMilliseconds = readValidatedReconnectDelayMilliseconds(
      dependencies?.initialReconnectDelayMs,
      DEFAULT_INITIAL_RECONNECT_DELAY_MS,
      RECONNECT_DELAY_PROPERTY_NAME_INITIAL,
    );
    const maximumReconnectDelayMilliseconds = readValidatedReconnectDelayMilliseconds(
      dependencies?.maximumReconnectDelayMs,
      DEFAULT_MAXIMUM_RECONNECT_DELAY_MS,
      RECONNECT_DELAY_PROPERTY_NAME_MAXIMUM,
    );
    if (maximumReconnectDelayMilliseconds < initialReconnectDelayMilliseconds) {
      throw new Error(RECONNECT_DELAY_RELATIONSHIP_ERROR_MESSAGE);
    }

    this.createEventSource = dependencies?.createEventSource ?? ((url) => new EventSource(url));
    this.scheduleTimeout =
      dependencies?.scheduleTimeout ??
      ((callback, delayMs) => window.setTimeout(callback, delayMs));
    this.clearScheduledTimeout =
      dependencies?.clearScheduledTimeout ?? ((timerId) => window.clearTimeout(timerId));
    this.initialReconnectDelayMs = initialReconnectDelayMilliseconds;
    this.maximumReconnectDelayMs = maximumReconnectDelayMilliseconds;
    this.reconnectDelayMs = this.initialReconnectDelayMs;
    this.reconnectTimerId = null;
    this.pendingEventMessageExecution = Promise.resolve();
    this.connectionGeneration = 0;
    this.source = null;
    this.context = null;
    this.disposed = true;
    this.hasConnectedBefore = false;
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
      eventsUrl: input.eventsUrl ?? DEFAULT_EVENTS_URL,
    };
    this.connectionGeneration += 1;
    this.reconnectDelayMs = this.initialReconnectDelayMs;
    this.pendingEventMessageExecution = Promise.resolve();
    this.disposed = false;
    this.hasConnectedBefore = false;
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
    this.connectionGeneration += 1;
    this.reconnectDelayMs = this.initialReconnectDelayMs;
    this.pendingEventMessageExecution = Promise.resolve();
    this.hasConnectedBefore = false;
  }

  private connectEvents(): void {
    if (this.disposed || !this.context) {
      return;
    }

    this.source = this.createEventSource(this.context.eventsUrl);
    this.source.onopen = () => {
      this.handleEventSourceOpen();
    };
    this.source.onmessage = (event) => {
      this.handleEventSourceMessage(event);
    };
    this.source.onerror = () => {
      this.handleEventSourceError();
    };
  }

  private handleEventSourceOpen(): void {
    if (!this.context) {
      return;
    }

    this.context.onConnectionStatusChange(true);
    this.reconnectDelayMs = this.initialReconnectDelayMs;
    const snapshot = this.context.readSnapshot();
    this.scheduleRefresh(
      readInitialRefreshFlags({
        snapshot,
        hasConnectedBefore: this.hasConnectedBefore,
      }),
    );
    this.hasConnectedBefore = true;
  }

  private handleEventSourceMessage(event: MessageEvent<string>): void {
    const messageGeneration = this.connectionGeneration;
    this.pendingEventMessageExecution = this.pendingEventMessageExecution
      .then(async () => {
        await this.executeEventSourceMessage(event, messageGeneration);
      })
      .catch(() => {
        // Message-specific failures are handled in executeEventSourceMessage.
      });
  }

  private async executeEventSourceMessage(
    event: MessageEvent<string>,
    messageGeneration: number,
  ): Promise<void> {
    if (!this.context || messageGeneration !== this.connectionGeneration) {
      return;
    }

    const snapshot = this.context.readSnapshot();
    try {
      const refreshDecision = await this.context.eventStreamRefreshDecisionEngine.readDecision({
        activeTab: snapshot.activeTab,
        selectedThreadId: snapshot.selectedThreadId,
        eventData: event.data,
      });
      if (!this.context || messageGeneration !== this.connectionGeneration) {
        return;
      }
      this.scheduleRefresh(readRefreshFlagsFromDecision(refreshDecision));
      if (refreshDecision.threadStreamDelta) {
        this.context.applyThreadStreamDelta(refreshDecision.threadStreamDelta);
      }
    } catch {
      this.scheduleRefresh(readRefreshFlagsFromDecisionFailure(snapshot));
    }
  }

  private handleEventSourceError(): void {
    if (!this.context) {
      return;
    }

    this.context.onConnectionStatusChange(false);
    this.closeSource();
    this.scheduleReconnect();
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
    this.reconnectDelayMs = Math.min(
      this.reconnectDelayMs * RECONNECT_DELAY_BACKOFF_MULTIPLIER,
      this.maximumReconnectDelayMs,
    );
  }

  private closeSource(): void {
    if (!this.source) {
      return;
    }
    this.source.close();
    this.source = null;
  }
}
