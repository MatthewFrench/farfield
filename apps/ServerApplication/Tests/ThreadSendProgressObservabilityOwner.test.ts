import { describe, expect, it } from "vitest";
import type { AgentThreadLiveState } from "../Source/Agents/Types.js";
import { ThreadSendProgressObservabilityOwner } from "../Source/Network/ThreadSendProgressObservabilityOwner.js";

function createLiveStateSnapshot(
  conversationState: AgentThreadLiveState["conversationState"],
): AgentThreadLiveState {
  return {
    ownerClientId: "client-a",
    conversationState,
    liveStateError: null,
  };
}

function createAssistantVisibleConversationState(
  threadId: string,
): NonNullable<AgentThreadLiveState["conversationState"]> {
  return {
    id: threadId,
    turns: [
      {
        turnId: "turn-1",
        status: "inProgress",
        finalAssistantStartedAtMs: 1_700_000_100,
        items: [
          {
            id: "item-1",
            type: "agentMessage",
            text: "hello",
          },
        ],
      },
    ],
    requests: [],
  };
}

describe("ThreadSendProgressObservabilityOwner", () => {
  it("records first inbound, published, and assistant-visible milestones once", () => {
    const owner = new ThreadSendProgressObservabilityOwner();
    owner.recordSendAccepted("thread-1", 1_000);
    owner.recordFirstInboundThreadStreamStateChanged("thread-1", 1_120);
    owner.recordFirstInboundThreadStreamStateChanged("thread-1", 1_140);
    owner.recordFirstPublishedThreadDelta("thread-1", 1_150);
    owner.recordFirstPublishedThreadDelta("thread-1", 1_170);
    owner.recordFirstAssistantVisibleProgress(
      "thread-1",
      1_220,
      createLiveStateSnapshot(createAssistantVisibleConversationState("thread-1")),
    );
    owner.recordFirstAssistantVisibleProgress(
      "thread-1",
      1_260,
      createLiveStateSnapshot(createAssistantVisibleConversationState("thread-1")),
    );

    expect(owner.readStatistics()).toEqual({
      activeThreadCount: 0,
      inboundSampleCount: 1,
      publishedDeltaSampleCount: 1,
      assistantVisibleSampleCount: 1,
      lastAcceptedToFirstInboundThreadStreamStateChangedMs: 120,
      p50AcceptedToFirstInboundThreadStreamStateChangedMs: 120,
      p95AcceptedToFirstInboundThreadStreamStateChangedMs: 120,
      lastAcceptedToFirstPublishedThreadDeltaMs: 150,
      p50AcceptedToFirstPublishedThreadDeltaMs: 150,
      p95AcceptedToFirstPublishedThreadDeltaMs: 150,
      lastAcceptedToFirstAssistantVisibleProgressMs: 220,
      p50AcceptedToFirstAssistantVisibleProgressMs: 220,
      p95AcceptedToFirstAssistantVisibleProgressMs: 220,
    });
  });

  it("overwrites active progression when a newer send starts on the same thread", () => {
    const owner = new ThreadSendProgressObservabilityOwner();
    owner.recordSendAccepted("thread-1", 1_000);
    owner.recordFirstInboundThreadStreamStateChanged("thread-1", 1_120);

    owner.recordSendAccepted("thread-1", 2_000);
    owner.recordFirstPublishedThreadDelta("thread-1", 2_090);
    owner.recordFirstAssistantVisibleProgress(
      "thread-1",
      2_180,
      createLiveStateSnapshot(createAssistantVisibleConversationState("thread-1")),
    );

    expect(owner.readStatistics()).toEqual({
      activeThreadCount: 0,
      inboundSampleCount: 1,
      publishedDeltaSampleCount: 1,
      assistantVisibleSampleCount: 1,
      lastAcceptedToFirstInboundThreadStreamStateChangedMs: 120,
      p50AcceptedToFirstInboundThreadStreamStateChangedMs: 120,
      p95AcceptedToFirstInboundThreadStreamStateChangedMs: 120,
      lastAcceptedToFirstPublishedThreadDeltaMs: 90,
      p50AcceptedToFirstPublishedThreadDeltaMs: 90,
      p95AcceptedToFirstPublishedThreadDeltaMs: 90,
      lastAcceptedToFirstAssistantVisibleProgressMs: 180,
      p50AcceptedToFirstAssistantVisibleProgressMs: 180,
      p95AcceptedToFirstAssistantVisibleProgressMs: 180,
    });
  });

  it("ignores assistant-visible milestone when published live state is not yet visible", () => {
    const owner = new ThreadSendProgressObservabilityOwner();
    owner.recordSendAccepted("thread-1", 1_000);
    owner.recordFirstPublishedThreadDelta("thread-1", 1_050);
    owner.recordFirstAssistantVisibleProgress(
      "thread-1",
      1_090,
      createLiveStateSnapshot({
        id: "thread-1",
        turns: [
          {
            turnId: "turn-1",
            status: "inProgress",
            items: [],
          },
        ],
        requests: [],
      }),
    );

    expect(owner.readStatistics()).toEqual({
      activeThreadCount: 1,
      inboundSampleCount: 0,
      publishedDeltaSampleCount: 1,
      assistantVisibleSampleCount: 0,
      lastAcceptedToFirstInboundThreadStreamStateChangedMs: 0,
      p50AcceptedToFirstInboundThreadStreamStateChangedMs: 0,
      p95AcceptedToFirstInboundThreadStreamStateChangedMs: 0,
      lastAcceptedToFirstPublishedThreadDeltaMs: 50,
      p50AcceptedToFirstPublishedThreadDeltaMs: 50,
      p95AcceptedToFirstPublishedThreadDeltaMs: 50,
      lastAcceptedToFirstAssistantVisibleProgressMs: 0,
      p50AcceptedToFirstAssistantVisibleProgressMs: 0,
      p95AcceptedToFirstAssistantVisibleProgressMs: 0,
    });
  });
});
