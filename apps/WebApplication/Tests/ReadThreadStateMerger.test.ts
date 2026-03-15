import { describe, expect, it } from "vitest";
import {
  type ReadThreadStateLike,
  ReadThreadStateMerger,
} from "../Source/Features/Chat/StateManagement/ReadThreadStateMerger";

interface TestTurn {
  id: string;
}

interface TestReadThreadState extends ReadThreadStateLike {
  thread: {
    id: string;
    turns: TestTurn[];
  };
  requestId: string;
}

function createReadThreadState(input: {
  threadId: string;
  turnIds: string[];
  requestId: string;
}): TestReadThreadState {
  return {
    requestId: input.requestId,
    thread: {
      id: input.threadId,
      turns: input.turnIds.map((turnId) => ({
        id: turnId,
      })),
    },
  };
}

describe("ReadThreadStateMerger", () => {
  it("returns incoming state when no previous state exists", () => {
    const merger = new ReadThreadStateMerger();
    const incoming = createReadThreadState({
      threadId: "thread-1",
      turnIds: [],
      requestId: "incoming-request",
    });

    const merged = merger.merge({
      previous: null,
      incoming,
      includeTurns: false,
    });

    expect(merged).toBe(incoming);
  });

  it("returns incoming state when turn payloads are explicitly included", () => {
    const merger = new ReadThreadStateMerger();
    const incoming = createReadThreadState({
      threadId: "thread-1",
      turnIds: ["incoming-1"],
      requestId: "incoming-request",
    });

    const merged = merger.merge({
      previous: createReadThreadState({
        threadId: "thread-1",
        turnIds: ["previous-1"],
        requestId: "previous-request",
      }),
      incoming,
      includeTurns: true,
    });

    expect(merged).toBe(incoming);
  });

  it("preserves previous turns when incremental read omits turn payloads", () => {
    const merger = new ReadThreadStateMerger();
    const previous = createReadThreadState({
      threadId: "thread-1",
      turnIds: ["previous-1", "previous-2"],
      requestId: "previous-request",
    });
    const incoming = createReadThreadState({
      threadId: "thread-1",
      turnIds: [],
      requestId: "incoming-request",
    });

    const merged = merger.merge({
      previous,
      incoming,
      includeTurns: false,
    });

    expect(merged).not.toBe(incoming);
    expect(merged.thread.turns).toEqual(previous.thread.turns);
    expect(merged.requestId).toBe("incoming-request");
  });

  it("returns incoming state when thread identifiers differ", () => {
    const merger = new ReadThreadStateMerger();
    const incoming = createReadThreadState({
      threadId: "thread-2",
      turnIds: [],
      requestId: "incoming-request",
    });

    const merged = merger.merge({
      previous: createReadThreadState({
        threadId: "thread-1",
        turnIds: ["previous-1"],
        requestId: "previous-request",
      }),
      incoming,
      includeTurns: false,
    });

    expect(merged).toBe(incoming);
  });

  it("returns incoming state when both snapshots omit turn payloads", () => {
    const merger = new ReadThreadStateMerger();
    const incoming = createReadThreadState({
      threadId: "thread-1",
      turnIds: [],
      requestId: "incoming-request",
    });

    const merged = merger.merge({
      previous: createReadThreadState({
        threadId: "thread-1",
        turnIds: [],
        requestId: "previous-request",
      }),
      incoming,
      includeTurns: false,
    });

    expect(merged).toBe(incoming);
  });
});
