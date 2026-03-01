import { describe, expect, it } from "vitest";
import { EventStreamRefreshDecisionEngine } from "../Source/Application/StateManagement/EventStreamRefreshDecisionEngine";

const THREAD_ONLY_METHODS = [
  "thread-stream-state-changed",
  "thread-queued-followups-changed",
] as const;

function createEngine(): EventStreamRefreshDecisionEngine {
  return new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);
}

describe("EventStreamRefreshDecisionEngine", () => {
  it("refreshes core state for state events", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 1,
        event: {
          type: "runtime-state-changed",
          state: { connected: true },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("refreshes selected thread for thread-only history events", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "debug",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 2,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-1",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread-queued-followups-changed",
            },
            meta: {
              method: "thread-queued-followups-changed",
              threadId: "thread-1",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: false,
      refreshHistory: true,
      refreshSelectedThread: true,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("refreshes core for non-thread-only app history events", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 3,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-2",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread-created",
            },
            meta: {
              method: "thread-created",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("refreshes core for non-thread-only history events without thread metadata", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 7,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-7",
            at: "2026-02-26T00:00:00.000Z",
            source: "ipc",
            direction: "out",
            payload: {
              type: "action",
              action: "thread-created",
            },
            meta: {
              method: "thread-created",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("marks runtime-notification projection work when thread status updates are present", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 9,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-9",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread/status/changed",
            },
            meta: {
              method: "thread/status/changed",
              threadId: "thread-1",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: true,
      refreshNotificationProjections: true,
      threadStreamDelta: null,
    });
  });

  it("marks runtime-notification projection work when thread-started updates are present", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 9,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-9-started",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread/started",
            },
            meta: {
              method: "thread/started",
              threadId: "thread-1",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: true,
      refreshNotificationProjections: true,
      threadStreamDelta: null,
    });
  });

  it("marks runtime-notification projection work when thread-compacted updates are present", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 9,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-9-compacted",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread/compacted",
            },
            meta: {
              method: "thread/compacted",
              threadId: "thread-1",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: true,
      refreshNotificationProjections: true,
      threadStreamDelta: null,
    });
  });

  it("marks runtime-notification projection work when thread token-usage updates are present", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 10,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-10",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread/tokenUsage/updated",
            },
            meta: {
              method: "thread/tokenUsage/updated",
              threadId: "thread-1",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: true,
      refreshNotificationProjections: true,
      threadStreamDelta: null,
    });
  });

  it("marks runtime-notification projection work when model-reroute events are present", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 11,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-11",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "model/rerouted",
            },
            meta: {
              method: "model/rerouted",
              threadId: "thread-1",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: true,
      refreshNotificationProjections: true,
      threadStreamDelta: null,
    });
  });

  it.each([
    "configWarning",
    "deprecationNotice",
    "windows/worldWritableWarning",
    "error",
    "turn/started",
    "turn/completed",
  ])("marks runtime-notification projection work when runtime method %s is present", (methodName) => {
    const engine = createEngine();
    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 12,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-12",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: methodName,
            },
            meta: {
              method: methodName,
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: true,
      threadStreamDelta: null,
    });
  });

  it("skips selected-thread refresh for stream-state-changed history methods", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "debug",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 8,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-8",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread-stream-state-changed",
            },
            meta: {
              method: "thread-stream-state-changed",
              threadId: "thread-1",
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: false,
      refreshHistory: true,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("normalizes non-string history metadata and keeps selected-thread refresh deterministic", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 3,
        event: {
          type: "activity-history-appended",
          entry: {
            id: "entry-2",
            at: "2026-02-26T00:00:00.000Z",
            source: "app",
            direction: "out",
            payload: {
              type: "action",
              action: "thread-created",
            },
            meta: {
              method: 77,
              threadId: 42,
            },
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("exposes pushed thread stream deltas for selected thread and skips selected-thread refresh", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 4,
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
              nextSequence: 11,
              firstAvailableSequence: 2,
              resetRequired: false,
            },
            streamEventsSinceSequenceUsed: 10,
          },
        },
      }),
    });

    expect(decision.refreshCore).toBe(false);
    expect(decision.refreshHistory).toBe(false);
    expect(decision.refreshSelectedThread).toBe(false);
    expect(decision.threadStreamDelta?.threadId).toBe("thread-1");
  });

  it("refreshes core state for thread-stream deltas from non-selected threads", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 5,
        event: {
          type: "thread-stream-delta",
          delta: {
            threadId: "thread-2",
            liveStateSnapshot: {
              ok: true,
              threadId: "thread-2",
              ownerClientId: "client-a",
              conversationState: null,
              liveStateError: null,
            },
            streamEventsSnapshot: {
              ok: true,
              threadId: "thread-2",
              ownerClientId: "client-a",
              events: [],
              nextSequence: 11,
              firstAvailableSequence: 2,
              resetRequired: false,
            },
            streamEventsSinceSequenceUsed: 10,
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("refreshes core for non-selected thread deltas without requiring full delta snapshot payloads", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 6,
        event: {
          type: "thread-stream-delta",
          delta: {
            threadId: "thread-2",
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("refreshes core when event payload is invalid", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: null,
      eventData: "{not-json",
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });

  it("refreshes core and history for invalid thread-stream envelopes on the debug tab", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "debug",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        sequence: 12,
        event: {
          type: "thread-stream-delta",
          delta: {
            invalidThreadIdentifier: "thread-1",
          },
        },
      }),
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: true,
      refreshSelectedThread: false,
      refreshNotificationProjections: false,
      threadStreamDelta: null,
    });
  });
});
