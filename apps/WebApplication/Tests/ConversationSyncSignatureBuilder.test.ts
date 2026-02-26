import { describe, expect, it } from "vitest";
import {
  ConversationSyncSignatureBuilder,
  type ConversationStateLike
} from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";

const DEFAULT_MODEL = "gpt-5.3-codex";
const DEFAULT_REASONING_EFFORT = "medium";

function createConversationState(input?: {
  updatedAt?: number;
  turns?: ConversationStateLike["turns"];
}): ConversationStateLike {
  const state: ConversationStateLike = {
    id: "conversation-1",
    turns: input?.turns ?? []
  };
  if (input?.updatedAt !== undefined) {
    state.updatedAt = input.updatedAt;
  }
  return state;
}

describe("ConversationSyncSignatureBuilder", () => {
  it("returns negative infinity when conversation updatedAt is absent", () => {
    const builder = new ConversationSyncSignatureBuilder(new ModeSelectionStateResolver());

    expect(builder.readConversationStateUpdatedAt(null)).toBe(Number.NEGATIVE_INFINITY);
    expect(builder.readConversationStateUpdatedAt(createConversationState())).toBe(Number.NEGATIVE_INFINITY);
    expect(builder.readConversationStateUpdatedAt(createConversationState({ updatedAt: 25 }))).toBe(25);
  });

  it("includes last-turn progress details in read-thread signatures", () => {
    const builder = new ConversationSyncSignatureBuilder(new ModeSelectionStateResolver());
    const signature = builder.buildReadThreadSyncSignature(
      {
        thread: createConversationState({
          updatedAt: 50,
          turns: [
            {
              status: "completed",
              items: [
                {
                  id: "item-1",
                  type: "agentMessage",
                  text: "hello"
                }
              ]
            }
          ]
        })
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT
    );

    expect(signature).toContain("conversation-1|50|1|");
    expect(signature.endsWith("1||completed|1|item-1|agentMessage")).toBe(true);
  });

  it("marks no-turn conversation state explicitly in live-state signatures", () => {
    const builder = new ConversationSyncSignatureBuilder(new ModeSelectionStateResolver());
    const signature = builder.buildLiveStateSyncSignature(
      {
        threadId: "thread-1",
        ownerClientId: null,
        conversationState: createConversationState({
          updatedAt: 8
        })
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT
    );

    expect(signature).toContain("thread-1||8|0|");
    expect(signature.endsWith("no-turns")).toBe(true);
  });
});
