import { describe, expect, it } from "vitest";
import { EventStreamRefreshDecisionEngine } from "../Source/Application/StateManagement/EventStreamRefreshDecisionEngine";

const THREAD_ONLY_METHODS = ["thread-stream-state-changed", "thread-queued-followups-changed"] as const;

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
          state: { connected: true }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      threadStreamDelta: null
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
              action: "thread-queued-followups-changed"
            },
            meta: {
              method: "thread-queued-followups-changed",
              threadId: "thread-1"
            }
          }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: false,
      refreshHistory: true,
      refreshSelectedThread: true,
      threadStreamDelta: null
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
              action: "thread-created"
            },
            meta: {
              method: "thread-created"
            }
          }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      threadStreamDelta: null
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
              action: "thread-created"
            },
            meta: {
              method: "thread-created"
            }
          }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      threadStreamDelta: null
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
              action: "thread-stream-state-changed"
            },
            meta: {
              method: "thread-stream-state-changed",
              threadId: "thread-1"
            }
          }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: false,
      refreshHistory: true,
      refreshSelectedThread: false,
      threadStreamDelta: null
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
              action: "thread-created"
            },
            meta: {
              method: 77,
              threadId: 42
            }
          }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      threadStreamDelta: null
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
              liveStateError: null
            },
            streamEventsSnapshot: {
              ok: true,
              threadId: "thread-1",
              ownerClientId: "client-a",
              events: [],
              nextSequence: 11,
              firstAvailableSequence: 2,
              resetRequired: false
            },
            streamEventsSinceSequenceUsed: 10
          }
        }
      })
    });

    expect(decision.refreshCore).toBe(false);
    expect(decision.refreshHistory).toBe(false);
    expect(decision.refreshSelectedThread).toBe(false);
    expect(decision.threadStreamDelta?.threadId).toBe("thread-1");
  });

  it("refreshes core when event payload is invalid", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: null,
      eventData: "{not-json"
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false,
      threadStreamDelta: null
    });
  });
});
