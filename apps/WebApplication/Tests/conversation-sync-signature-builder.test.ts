import { describe, expect, it } from "vitest";
import { ConversationSyncSignatureBuilder } from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";

describe("ConversationSyncSignatureBuilder", () => {
  it("builds a stable live-state signature for the same state", () => {
    const builder = new ConversationSyncSignatureBuilder(new ModeSelectionStateResolver());
    const liveState = {
      threadId: "thread-1",
      ownerClientId: "client-1",
      conversationState: {
        id: "thread-1",
        updatedAt: 100,
        turns: [
          {
            id: "turn-1",
            status: "completed",
            items: [
              {
                id: "item-1",
                type: "agentMessage"
              }
            ]
          }
        ],
        latestModel: "gpt-5.3-codex",
        latestReasoningEffort: "medium"
      }
    };

    const firstSignature = builder.buildLiveStateSyncSignature(
      liveState,
      "gpt-5.3-codex",
      "medium"
    );
    const secondSignature = builder.buildLiveStateSyncSignature(
      liveState,
      "gpt-5.3-codex",
      "medium"
    );

    expect(firstSignature).toBe(secondSignature);
  });

  it("changes signature when conversation progress changes", () => {
    const builder = new ConversationSyncSignatureBuilder(new ModeSelectionStateResolver());
    const readThreadBase = {
      thread: {
        id: "thread-1",
        updatedAt: 100,
        turns: [
          {
            id: "turn-1",
            status: "completed",
            items: []
          }
        ],
        latestModel: "gpt-5.3-codex",
        latestReasoningEffort: "medium"
      }
    };
    const readThreadChanged = {
      thread: {
        ...readThreadBase.thread,
        turns: [
          ...readThreadBase.thread.turns,
          {
            id: "turn-2",
            status: "in-progress",
            items: [
              {
                id: "item-2",
                type: "reasoning"
              }
            ]
          }
        ]
      }
    };

    const baseSignature = builder.buildReadThreadSyncSignature(
      readThreadBase,
      "gpt-5.3-codex",
      "medium"
    );
    const changedSignature = builder.buildReadThreadSyncSignature(
      readThreadChanged,
      "gpt-5.3-codex",
      "medium"
    );

    expect(baseSignature).not.toBe(changedSignature);
  });

  it("returns negative infinity for missing updated timestamp", () => {
    const builder = new ConversationSyncSignatureBuilder(new ModeSelectionStateResolver());

    expect(builder.readConversationStateUpdatedAt(null)).toBe(Number.NEGATIVE_INFINITY);
    expect(builder.readConversationStateUpdatedAt({ turns: [] })).toBe(Number.NEGATIVE_INFINITY);
  });
});
