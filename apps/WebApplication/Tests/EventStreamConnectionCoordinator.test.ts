import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type EventRefreshFlags,
  EventRefreshScheduler,
} from "../Source/Application/StateManagement/EventRefreshScheduler";
import {
  type EventSourceLike,
  EventStreamConnectionCoordinator,
  type EventStreamConnectionSnapshot,
} from "../Source/Application/StateManagement/EventStreamConnectionCoordinator";
import { EventStreamRefreshDecisionEngine } from "../Source/Application/StateManagement/EventStreamRefreshDecisionEngine";

const THREAD_ONLY_METHODS = [
  "thread-stream-state-changed",
  "thread-queued-followups-changed",
] as const;
const EVENT_NAME_OPEN = "open";
const EVENT_NAME_ERROR = "error";
const EVENT_NAME_MESSAGE = "message";
const INITIAL_RECONNECT_DELAY_VALIDATION_ERROR_MESSAGE =
  "EventStreamConnectionCoordinator requires a non-negative integer initialReconnectDelayMs";
const RECONNECT_DELAY_RELATIONSHIP_ERROR_MESSAGE =
  "EventStreamConnectionCoordinator requires maximumReconnectDelayMs to be greater than or equal to initialReconnectDelayMs";

function createActivityHistoryAppendedMessageData(): string {
  return JSON.stringify({
    sequence: 4,
    event: {
      type: "activity-history-appended",
      entry: {
        id: "entry-1",
        at: "2026-02-26T00:00:00.000Z",
        source: "app",
        direction: "out",
        payload: {
          type: "action",
          action: "thread-stream-state-changed",
        },
        meta: {
          method: "thread-queued-followups-changed",
          threadId: "thread-1",
        },
      },
    },
  });
}

function createThreadStreamDeltaMessageData(): string {
  return JSON.stringify({
    sequence: 5,
    event: {
      type: "thread-stream-delta",
      delta: {
        threadId: "thread-1",
        liveStateSnapshot: {
          ok: true,
          threadId: "thread-1",
          ownerClientId: "client-a",
          conversationState: null,
          liveStateError: null,
        },
        streamEventsSnapshot: {
          ok: true,
          threadId: "thread-1",
          ownerClientId: "client-a",
          events: [],
          nextSequence: 2,
          firstAvailableSequence: 0,
          resetRequired: false,
        },
        streamEventsSinceSequenceUsed: 1,
      },
    },
  });
}

class TestEventSource implements EventSourceLike {
  public onopen: ((event: Event) => void) | null;
  public onmessage: ((event: MessageEvent<string>) => void) | null;
  public onerror: ((event: Event) => void) | null;
  public readonly url: string;
  public closed: boolean;

  public constructor(url: string) {
    this.url = url;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.closed = false;
  }

  public close(): void {
    this.closed = true;
  }
}

function createCoordinator(input: {
  createdSources: TestEventSource[];
  initialReconnectDelayMs?: number;
  maximumReconnectDelayMs?: number;
}): EventStreamConnectionCoordinator {
  const dependencies: {
    createEventSource: (url: string) => TestEventSource;
    scheduleTimeout: (callback: () => void, delayMs: number) => number;
    clearScheduledTimeout: (timerId: number) => void;
    initialReconnectDelayMs?: number;
    maximumReconnectDelayMs?: number;
  } = {
    createEventSource: (url) => {
      const source = new TestEventSource(url);
      input.createdSources.push(source);
      return source;
    },
    scheduleTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearScheduledTimeout: (timerId) => window.clearTimeout(timerId),
  };
  if (input.initialReconnectDelayMs !== undefined) {
    dependencies.initialReconnectDelayMs = input.initialReconnectDelayMs;
  }
  if (input.maximumReconnectDelayMs !== undefined) {
    dependencies.maximumReconnectDelayMs = input.maximumReconnectDelayMs;
  }
  return new EventStreamConnectionCoordinator(dependencies);
}

describe("EventStreamConnectionCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules initial refresh on open using snapshot state", async () => {
    vi.useFakeTimers();
    const createdSources: TestEventSource[] = [];
    const coordinator = createCoordinator({ createdSources });
    const scheduler = new EventRefreshScheduler(20);
    const decisionEngine = new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);
    const executedRefreshes: EventRefreshFlags[] = [];
    const connectionStatusChanges: boolean[] = [];
    const snapshot: EventStreamConnectionSnapshot = {
      activeTab: "debug",
      selectedThreadId: "thread-1",
    };

    coordinator.start({
      eventRefreshScheduler: scheduler,
      eventStreamRefreshDecisionEngine: decisionEngine,
      readSnapshot: () => snapshot,
      executeScheduledRefresh: async (refreshFlags) => {
        executedRefreshes.push(refreshFlags);
      },
      applyThreadStreamDelta: () => {},
      onConnectionStatusChange: (connected) => {
        connectionStatusChanges.push(connected);
      },
    });

    expect(createdSources).toHaveLength(1);
    createdSources[0]?.onopen?.(new Event(EVENT_NAME_OPEN));
    await vi.advanceTimersByTimeAsync(20);

    expect(executedRefreshes).toEqual([
      {
        refreshCore: true,
        refreshHistory: true,
        refreshSelectedThread: true,
      },
    ]);
    expect(connectionStatusChanges).toEqual([true]);

    coordinator.stop();
    expect(connectionStatusChanges).toEqual([true, false]);
    expect(createdSources[0]?.closed).toBe(true);
  });

  it("maps message payloads through decision engine before scheduling refresh", async () => {
    vi.useFakeTimers();
    const createdSources: TestEventSource[] = [];
    const coordinator = createCoordinator({ createdSources });
    const scheduler = new EventRefreshScheduler(20);
    const decisionEngine = new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);
    const executedRefreshes: EventRefreshFlags[] = [];
    let snapshot: EventStreamConnectionSnapshot = {
      activeTab: "chat",
      selectedThreadId: "thread-1",
    };

    coordinator.start({
      eventRefreshScheduler: scheduler,
      eventStreamRefreshDecisionEngine: decisionEngine,
      readSnapshot: () => snapshot,
      executeScheduledRefresh: async (refreshFlags) => {
        executedRefreshes.push(refreshFlags);
      },
      applyThreadStreamDelta: () => {},
      onConnectionStatusChange: () => {},
    });

    const source = createdSources[0];
    if (!source) {
      throw new Error("Expected event source instance");
    }

    source.onopen?.(new Event(EVENT_NAME_OPEN));
    await vi.advanceTimersByTimeAsync(20);
    executedRefreshes.length = 0;

    snapshot = {
      activeTab: "debug",
      selectedThreadId: "thread-1",
    };
    source.onmessage?.(
      new MessageEvent<string>(EVENT_NAME_MESSAGE, {
        data: createActivityHistoryAppendedMessageData(),
      }),
    );
    await vi.advanceTimersByTimeAsync(20);

    expect(executedRefreshes).toEqual([
      {
        refreshCore: false,
        refreshHistory: true,
        refreshSelectedThread: true,
      },
    ]);

    coordinator.stop();
  });

  it("applies thread stream deltas for selected thread without scheduling selected-thread refresh", async () => {
    vi.useFakeTimers();
    const createdSources: TestEventSource[] = [];
    const coordinator = createCoordinator({ createdSources });
    const scheduler = new EventRefreshScheduler(20);
    const decisionEngine = new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);
    const executedRefreshes: EventRefreshFlags[] = [];
    const appliedDeltaThreadIds: string[] = [];

    coordinator.start({
      eventRefreshScheduler: scheduler,
      eventStreamRefreshDecisionEngine: decisionEngine,
      readSnapshot: () => ({
        activeTab: "chat",
        selectedThreadId: "thread-1",
      }),
      executeScheduledRefresh: async (refreshFlags) => {
        executedRefreshes.push(refreshFlags);
      },
      applyThreadStreamDelta: (threadStreamDelta) => {
        appliedDeltaThreadIds.push(threadStreamDelta.threadId);
      },
      onConnectionStatusChange: () => {},
    });

    const source = createdSources[0];
    if (!source) {
      throw new Error("Expected event source instance");
    }

    source.onopen?.(new Event(EVENT_NAME_OPEN));
    await vi.advanceTimersByTimeAsync(20);
    executedRefreshes.length = 0;

    source.onmessage?.(
      new MessageEvent<string>(EVENT_NAME_MESSAGE, {
        data: createThreadStreamDeltaMessageData(),
      }),
    );
    await vi.advanceTimersByTimeAsync(20);

    expect(appliedDeltaThreadIds).toEqual(["thread-1"]);
    expect(executedRefreshes).toEqual([]);

    coordinator.stop();
  });

  it("reconnects with exponential backoff and cancels pending reconnect on stop", async () => {
    vi.useFakeTimers();
    const createdSources: TestEventSource[] = [];
    const coordinator = createCoordinator({
      createdSources,
      initialReconnectDelayMs: 25,
      maximumReconnectDelayMs: 100,
    });
    const scheduler = new EventRefreshScheduler(0);
    const decisionEngine = new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);

    coordinator.start({
      eventRefreshScheduler: scheduler,
      eventStreamRefreshDecisionEngine: decisionEngine,
      readSnapshot: () => ({
        activeTab: "chat",
        selectedThreadId: null,
      }),
      executeScheduledRefresh: async () => {},
      applyThreadStreamDelta: () => {},
      onConnectionStatusChange: () => {},
    });

    const firstSource = createdSources[0];
    if (!firstSource) {
      throw new Error("Expected initial event source instance");
    }
    firstSource.onerror?.(new Event(EVENT_NAME_ERROR));

    await vi.advanceTimersByTimeAsync(24);
    expect(createdSources).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(createdSources).toHaveLength(2);

    const secondSource = createdSources[1];
    if (!secondSource) {
      throw new Error("Expected second event source instance");
    }
    secondSource.onerror?.(new Event(EVENT_NAME_ERROR));

    await vi.advanceTimersByTimeAsync(49);
    expect(createdSources).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(createdSources).toHaveLength(3);

    const thirdSource = createdSources[2];
    if (!thirdSource) {
      throw new Error("Expected third event source instance");
    }
    thirdSource.onerror?.(new Event(EVENT_NAME_ERROR));
    coordinator.stop();

    await vi.advanceTimersByTimeAsync(200);
    expect(createdSources).toHaveLength(3);
    expect(createdSources[2]?.closed).toBe(true);
  });

  it("rejects negative reconnect delay configuration", () => {
    expect(() => {
      createCoordinator({
        createdSources: [],
        initialReconnectDelayMs: -1,
      });
    }).toThrowError(INITIAL_RECONNECT_DELAY_VALIDATION_ERROR_MESSAGE);
  });

  it("rejects maximum reconnect delay lower than initial delay", () => {
    expect(() => {
      createCoordinator({
        createdSources: [],
        initialReconnectDelayMs: 100,
        maximumReconnectDelayMs: 99,
      });
    }).toThrowError(RECONNECT_DELAY_RELATIONSHIP_ERROR_MESSAGE);
  });
});
