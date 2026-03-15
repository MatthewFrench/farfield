import { describe, expect, it } from "vitest";
import { readConversationStateSelection } from "../Source/Application/StateManagement/ApplicationConversationStateDerivation";
import { type ApplicationConversationState } from "../Source/Application/StateManagement/UseApplicationDerivedStateContracts";
import { ConversationSyncSignatureBuilder } from "../Source/Features/Chat/DomainModel/ConversationSyncSignatureBuilder";
import { ModeSelectionStateResolver } from "../Source/Features/Chat/DomainModel/ModeSelectionStateResolver";

function buildConversationState(input: {
  threadIdentifier: string;
  updatedAt: number;
  turnIdentifier: string;
}): ApplicationConversationState {
  return {
    id: input.threadIdentifier,
    turns: [
      {
        id: input.turnIdentifier,
        status: "completed",
        items: [
          {
            id: `item-${input.turnIdentifier}`,
            type: "agentMessage",
            text: input.turnIdentifier,
          },
        ],
      },
    ],
    requests: [],
    updatedAt: input.updatedAt,
    latestModel: "gpt-5.3-codex",
    latestReasoningEffort: "medium",
    latestCollaborationMode: {
      mode: "default",
      settings: {
        model: "gpt-5.3-codex",
        reasoning_effort: "medium",
        developer_instructions: null,
      },
    },
  };
}

describe("ApplicationConversationStateDerivation.readConversationStateSelection", () => {
  it("returns read-thread conversation state when live state is unavailable", () => {
    const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
      new ModeSelectionStateResolver(),
    );
    const readConversationState = buildConversationState({
      threadIdentifier: "thread-1",
      updatedAt: 100,
      turnIdentifier: "turn-read-1",
    });

    const selectedConversationState = readConversationStateSelection({
      liveConversationState: null,
      readConversationState,
      conversationSyncSignatureBuilder,
    });

    expect(selectedConversationState).toBe(readConversationState);
  });

  it("prefers live conversation state when updatedAt values are equal", () => {
    const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
      new ModeSelectionStateResolver(),
    );
    const liveConversationState = buildConversationState({
      threadIdentifier: "thread-2",
      updatedAt: 250,
      turnIdentifier: "turn-live-2",
    });
    const readConversationState = buildConversationState({
      threadIdentifier: "thread-2",
      updatedAt: 250,
      turnIdentifier: "turn-read-2",
    });

    const selectedConversationState = readConversationStateSelection({
      liveConversationState,
      readConversationState,
      conversationSyncSignatureBuilder,
    });

    expect(selectedConversationState).toBe(liveConversationState);
  });

  it("prefers read-thread conversation state when it is newer", () => {
    const conversationSyncSignatureBuilder = new ConversationSyncSignatureBuilder(
      new ModeSelectionStateResolver(),
    );
    const liveConversationState = buildConversationState({
      threadIdentifier: "thread-3",
      updatedAt: 500,
      turnIdentifier: "turn-live-3",
    });
    const readConversationState = buildConversationState({
      threadIdentifier: "thread-3",
      updatedAt: 501,
      turnIdentifier: "turn-read-3",
    });

    const selectedConversationState = readConversationStateSelection({
      liveConversationState,
      readConversationState,
      conversationSyncSignatureBuilder,
    });

    expect(selectedConversationState).toBe(readConversationState);
  });
});
