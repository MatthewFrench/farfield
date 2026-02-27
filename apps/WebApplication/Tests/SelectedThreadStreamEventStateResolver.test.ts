import type { IpcFrame } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import type { ChatStreamEventsResponse } from "@/Features/Chat/DataAccess/ChatServerClient";
import { resolveNextStreamEventsState } from "@/Features/Chat/DomainModel/SelectedThreadStreamEventStateResolver";

function buildEvent(method: string): IpcFrame {
  return {
    type: "broadcast",
    method,
    params: {},
  };
}

function buildStreamSnapshot(input: {
  events: IpcFrame[];
  nextSequence: number;
  resetRequired: boolean;
}): ChatStreamEventsResponse {
  return {
    ok: true,
    threadId: "thread-1",
    ownerClientId: "owner-1",
    events: input.events,
    nextSequence: input.nextSequence,
    firstAvailableSequence: 0,
    resetRequired: input.resetRequired,
  };
}

describe("SelectedThreadStreamEventStateResolver", () => {
  it("keeps previous events when reset payload tail matches current state", () => {
    const previousEvents = [buildEvent("event-1")];
    const nextEvents = [buildEvent("event-1")];

    const resolvedEvents = resolveNextStreamEventsState({
      previousStreamEvents: previousEvents,
      streamEventsSnapshot: buildStreamSnapshot({
        events: nextEvents,
        nextSequence: 2,
        resetRequired: true,
      }),
      streamEventsSinceSequenceUsed: null,
    });

    expect(resolvedEvents).toBe(previousEvents);
  });

  it("appends cursor-scoped events and enforces retention bounds", () => {
    const previousEvents = Array.from({ length: 399 }, (_, index) =>
      buildEvent(`previous-${String(index)}`),
    );
    const nextEvents = [buildEvent("next-1"), buildEvent("next-2")];

    const resolvedEvents = resolveNextStreamEventsState({
      previousStreamEvents: previousEvents,
      streamEventsSnapshot: buildStreamSnapshot({
        events: nextEvents,
        nextSequence: 401,
        resetRequired: false,
      }),
      streamEventsSinceSequenceUsed: 399,
    });

    expect(resolvedEvents).toHaveLength(400);
    expect(resolvedEvents[0]).toEqual(buildEvent("previous-1"));
    expect(resolvedEvents[398]).toEqual(buildEvent("next-1"));
    expect(resolvedEvents[399]).toEqual(buildEvent("next-2"));
  });

  it("replaces events for non-cursor snapshots when payload differs", () => {
    const resolvedEvents = resolveNextStreamEventsState({
      previousStreamEvents: [buildEvent("event-1")],
      streamEventsSnapshot: buildStreamSnapshot({
        events: [buildEvent("event-2")],
        nextSequence: 2,
        resetRequired: false,
      }),
      streamEventsSinceSequenceUsed: null,
    });

    expect(resolvedEvents).toEqual([buildEvent("event-2")]);
  });
});
