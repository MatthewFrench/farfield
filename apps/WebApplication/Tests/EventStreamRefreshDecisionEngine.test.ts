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
        type: "state",
        state: { connected: true }
      })
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false
    });
  });

  it("refreshes selected thread for thread-only history events", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "debug",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        type: "history",
        entry: {
          source: "app",
          meta: {
            method: "thread-stream-state-changed",
            threadId: "thread-1"
          }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: false,
      refreshHistory: true,
      refreshSelectedThread: true
    });
  });

  it("refreshes core for non-thread-only app history events", () => {
    const engine = createEngine();

    const decision = engine.readDecision({
      activeTab: "chat",
      selectedThreadId: "thread-1",
      eventData: JSON.stringify({
        type: "history",
        entry: {
          source: "app",
          meta: {
            method: "thread-created"
          }
        }
      })
    });

    expect(decision).toEqual({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false
    });
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
      refreshSelectedThread: false
    });
  });
});
