import { describe, expect, it } from "vitest";
import {
  type ConversationStateLike,
  ConversationSyncSignatureBuilder,
} from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";

const DEFAULT_MODEL = "gpt-5.3-codex";
const DEFAULT_REASONING_EFFORT = "medium";

function createConversationSyncSignatureBuilder(): ConversationSyncSignatureBuilder {
  return new ConversationSyncSignatureBuilder(new ModeSelectionStateResolver());
}

function createConversationState(input?: {
  updatedAt?: number;
  turns?: ConversationStateLike["turns"];
}): ConversationStateLike {
  const state: ConversationStateLike = {
    id: "conversation-1",
    turns: input?.turns ?? [],
  };
  if (input?.updatedAt !== undefined) {
    state.updatedAt = input.updatedAt;
  }
  return state;
}

describe("ConversationSyncSignatureBuilder", () => {
  it("returns negative infinity when conversation updatedAt is absent", () => {
    const builder = createConversationSyncSignatureBuilder();

    expect(builder.readConversationStateUpdatedAt(null)).toBe(Number.NEGATIVE_INFINITY);
    expect(builder.readConversationStateUpdatedAt(createConversationState())).toBe(
      Number.NEGATIVE_INFINITY,
    );
    expect(builder.readConversationStateUpdatedAt(createConversationState({ updatedAt: 25 }))).toBe(
      25,
    );
  });

  it("includes missing turn identifiers in read-thread progress signatures", () => {
    const builder = createConversationSyncSignatureBuilder();
    const thread = createConversationState({
      updatedAt: 50,
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-1",
              type: "agentMessage",
              text: "hello",
            },
          ],
        },
      ],
    });
    const signature = builder.buildReadThreadSyncSignature(
      {
        thread,
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT,
    );
    const repeatedSignature = builder.buildReadThreadSyncSignature(
      {
        thread,
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT,
    );

    expect(signature).toBe(repeatedSignature);
    expect(signature).toContain("conversation-1|50|1|");
    expect(signature.endsWith("1||completed|1|item-1|agentMessage")).toBe(true);
  });

  it("uses explicit empty item segments when the latest turn has no items", () => {
    const builder = createConversationSyncSignatureBuilder();
    const signature = builder.buildReadThreadSyncSignature(
      {
        thread: createConversationState({
          updatedAt: 60,
          turns: [
            {
              id: "turn-1",
              status: "completed",
              items: [],
            },
          ],
        }),
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT,
    );

    expect(signature).toContain("conversation-1|60|1|");
    expect(signature.endsWith("1|turn-1|completed|0||")).toBe(true);
  });

  it("marks no-turn conversation state explicitly in live-state signatures", () => {
    const builder = createConversationSyncSignatureBuilder();
    const signature = builder.buildLiveStateSyncSignature(
      {
        threadId: "thread-1",
        ownerClientId: null,
        conversationState: createConversationState({
          updatedAt: 8,
        }),
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT,
    );

    expect(signature).toContain("thread-1||8|0|");
    expect(signature.endsWith("no-turns")).toBe(true);
  });

  it("uses explicit missing-state sentinels when live conversation state is absent", () => {
    const builder = createConversationSyncSignatureBuilder();
    const signature = builder.buildLiveStateSyncSignature(
      {
        threadId: "thread-1",
        ownerClientId: null,
        conversationState: null,
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT,
    );

    expect(signature).toBe(`thread-1||${String(Number.NEGATIVE_INFINITY)}|-1||||`);
  });

  it("produces deterministic read-thread signatures for equivalent snapshots", () => {
    const builder = createConversationSyncSignatureBuilder();
    const firstSignature = builder.buildReadThreadSyncSignature(
      {
        thread: createConversationState({
          updatedAt: 77,
          turns: [
            {
              id: "turn-2",
              status: "completed",
              items: [
                {
                  id: "item-7",
                  type: "agentMessage",
                  text: "deterministic",
                },
              ],
            },
          ],
        }),
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT,
    );
    const secondSignature = builder.buildReadThreadSyncSignature(
      {
        thread: createConversationState({
          updatedAt: 77,
          turns: [
            {
              id: "turn-2",
              status: "completed",
              items: [
                {
                  id: "item-7",
                  type: "agentMessage",
                  text: "deterministic",
                },
              ],
            },
          ],
        }),
      },
      DEFAULT_MODEL,
      DEFAULT_REASONING_EFFORT,
    );

    expect(firstSignature).toBe(secondSignature);
  });
});
