import { describe, expect, it } from "vitest";
import { AppServerNotificationBufferOwner } from "../Source/AppServerNotificationBufferOwner.js";

describe("AppServerNotificationBufferOwner", () => {
  it("evicts oldest events when event-count limit is exceeded", () => {
    const owner = new AppServerNotificationBufferOwner({
      maximumEventCount: 2,
      maximumRetainedBytes: 10_000,
    });

    owner.append(
      "event-1",
      { threadId: "thread-1" },
      { threadId: "thread-1", turnId: null },
      10,
      10,
    );
    owner.append(
      "event-2",
      { threadId: "thread-2" },
      { threadId: "thread-2", turnId: null },
      20,
      10,
    );
    owner.append(
      "event-3",
      { threadId: "thread-3" },
      { threadId: "thread-3", turnId: null },
      30,
      10,
    );

    const result = owner.read({
      limit: 10,
      sinceSequence: null,
    });

    expect(result.firstAvailableSequence).toBe(1);
    expect(result.nextSequence).toBe(3);
    expect(result.events.map((event) => event.method)).toEqual(["event-2", "event-3"]);
  });

  it("evicts oldest events when retained byte budget is exceeded", () => {
    const owner = new AppServerNotificationBufferOwner({
      maximumEventCount: 10,
      maximumRetainedBytes: 220,
    });

    owner.append("event-1", { text: "x".repeat(80) }, { threadId: null, turnId: null }, 10, 120);
    owner.append("event-2", { text: "y".repeat(80) }, { threadId: null, turnId: null }, 20, 120);
    owner.append("event-3", { text: "z".repeat(80) }, { threadId: null, turnId: null }, 30, 120);

    const result = owner.read({
      limit: 10,
      sinceSequence: null,
    });

    expect(result.events.map((event) => event.method)).toEqual(["event-3"]);
    expect(result.firstAvailableSequence).toBe(2);
  });

  it("signals resetRequired when caller cursor falls behind evicted events", () => {
    const owner = new AppServerNotificationBufferOwner({
      maximumEventCount: 2,
      maximumRetainedBytes: 10_000,
    });

    owner.append(
      "event-1",
      { threadId: "thread-1" },
      { threadId: "thread-1", turnId: null },
      10,
      10,
    );
    owner.append(
      "event-2",
      { threadId: "thread-2" },
      { threadId: "thread-2", turnId: null },
      20,
      10,
    );
    owner.append(
      "event-3",
      { threadId: "thread-3" },
      { threadId: "thread-3", turnId: null },
      30,
      10,
    );
    owner.append(
      "event-4",
      { threadId: "thread-4" },
      { threadId: "thread-4", turnId: null },
      40,
      10,
    );

    const result = owner.read({
      limit: 10,
      sinceSequence: 0,
    });

    expect(result.resetRequired).toBe(true);
    expect(result.firstAvailableSequence).toBe(2);
    expect(result.events.map((event) => event.method)).toEqual(["event-3", "event-4"]);
  });

  it("rejects non-positive retained byte estimates", () => {
    const owner = new AppServerNotificationBufferOwner({
      maximumEventCount: 2,
      maximumRetainedBytes: 10_000,
    });

    expect(() =>
      owner.append(
        "event-1",
        { threadId: "thread-1" },
        { threadId: "thread-1", turnId: null },
        10,
        0,
      ),
    ).toThrowError(/retainedByteEstimate/);
  });
});
