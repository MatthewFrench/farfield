import { describe, expect, it } from "vitest";
import { type ConversationTurn } from "../Source/Features/Chat/DomainModel/ConversationItemFlattener";
import { readInterruptedTurnNotice } from "../Source/Features/Chat/DomainModel/InterruptedTurnNoticeDerivation";

function buildUserOnlyInterruptedTurn(turnIdentifier: string): ConversationTurn {
  return {
    id: turnIdentifier,
    status: "interrupted",
    items: [
      {
        id: `user-${turnIdentifier}`,
        type: "userMessage",
        content: [
          {
            type: "text",
            text: "hello",
            text_elements: [],
          },
        ],
      },
    ],
  };
}

describe("InterruptedTurnNoticeDerivation", () => {
  it("returns a notice when the latest turn was interrupted before agent output", () => {
    expect(readInterruptedTurnNotice([buildUserOnlyInterruptedTurn("turn-1")])).toEqual({
      title: "Turn Interrupted",
      message:
        "This turn ended before the agent produced a response. Send another message to retry.",
    });
  });

  it("does not return a notice when the latest interrupted turn already includes agent output", () => {
    const interruptedTurnWithOutput: ConversationTurn = {
      id: "turn-2",
      status: "interrupted",
      items: [
        {
          id: "user-turn-2",
          type: "userMessage",
          content: [
            {
              type: "text",
              text: "hello",
              text_elements: [],
            },
          ],
        },
        {
          id: "agent-turn-2",
          type: "agentMessage",
          text: "partial output",
        },
      ],
    };

    expect(readInterruptedTurnNotice([interruptedTurnWithOutput])).toBeNull();
  });

  it("does not return a notice when the latest turn completed successfully", () => {
    const completedTurn: ConversationTurn = {
      id: "turn-3",
      status: "completed",
      items: [
        {
          id: "user-turn-3",
          type: "userMessage",
          content: [
            {
              type: "text",
              text: "hello",
              text_elements: [],
            },
          ],
        },
      ],
    };

    expect(readInterruptedTurnNotice([completedTurn])).toBeNull();
  });
});
