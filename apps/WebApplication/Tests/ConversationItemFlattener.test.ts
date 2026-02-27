import { describe, expect, it } from "vitest";
import {
  ConversationItemFlattener,
  type ConversationTurn,
} from "../Source/Features/Chat/DomainModel/ConversationItemFlattener";

function createTurn(input: { status: string; items: ConversationTurn["items"] }): ConversationTurn {
  return {
    status: input.status,
    items: input.items,
  };
}

describe("ConversationItemFlattener", () => {
  it("classifies turn-in-progress statuses", () => {
    const flattener = new ConversationItemFlattener();

    expect(flattener.isTurnInProgressStatus("in-progress")).toBe(true);
    expect(flattener.isTurnInProgressStatus("inProgress")).toBe(true);
    expect(flattener.isTurnInProgressStatus("completed")).toBe(false);
    expect(flattener.isTurnInProgressStatus(undefined)).toBe(false);
  });

  it("flattens rendered items with stable spacing and last-item markers", () => {
    const flattener = new ConversationItemFlattener();
    const turns: ConversationTurn[] = [
      createTurn({
        status: "completed",
        items: [
          {
            id: "user-empty",
            type: "userMessage",
            content: [
              {
                type: "text",
                text: "",
              },
            ],
          },
          {
            id: "agent-visible",
            type: "agentMessage",
            text: "hello",
          },
        ],
      }),
      createTurn({
        status: "inProgress",
        items: [
          {
            id: "reasoning-visible",
            type: "reasoning",
            summary: ["thinking"],
          },
          {
            id: "error-visible",
            type: "error",
            message: "boom",
          },
        ],
      }),
    ];

    const flattened = flattener.flattenConversationItems(turns, true);

    expect(flattened.map((item) => item.key)).toEqual([
      "agent-visible",
      "reasoning-visible",
      "error-visible",
    ]);
    expect(flattened.map((item) => item.spacingTop)).toEqual([0, 16, 10]);
    expect(flattened.map((item) => item.turnIsInProgress)).toEqual([false, true, true]);
    expect(flattened.map((item) => item.isLast)).toEqual([false, false, true]);
    expect(flattened[0]?.nextItemType).toBeUndefined();
    expect(flattened[1]?.nextItemType).toBe("error");
  });

  it("filters non-renderable reasoning and user input response items", () => {
    const flattener = new ConversationItemFlattener();
    const turns: ConversationTurn[] = [
      createTurn({
        status: "completed",
        items: [
          {
            id: "reasoning-empty",
            type: "reasoning",
            summary: [],
          },
          {
            id: "response-empty",
            type: "userInputResponse",
            requestId: 1,
            turnId: "turn-1",
            questions: [],
            answers: {},
          },
          {
            id: "context-compaction",
            type: "contextCompaction",
          },
        ],
      }),
    ];

    const flattened = flattener.flattenConversationItems(turns, false);

    expect(flattened.map((item) => item.key)).toEqual(["context-compaction"]);
  });

  it("does not flag completed turns as in-progress when generation flag is true", () => {
    const flattener = new ConversationItemFlattener();
    const turns: ConversationTurn[] = [
      createTurn({
        status: "completed",
        items: [
          {
            id: "agent-visible",
            type: "agentMessage",
            text: "hello",
          },
        ],
      }),
    ];

    const flattened = flattener.flattenConversationItems(turns, true);

    expect(flattened[0]?.turnIsInProgress).toBe(false);
  });

  it("flattens large conversations within bounded time and preserves terminal markers", () => {
    const flattener = new ConversationItemFlattener();
    const turnCount = 250;
    const itemsPerTurn = 20;
    const turns: ConversationTurn[] = Array.from({ length: turnCount }, (_turn, turnIndex) => ({
      status: turnIndex === turnCount - 1 ? "inProgress" : "completed",
      items: Array.from({ length: itemsPerTurn }, (_item, itemIndex) => ({
        id: `turn-${String(turnIndex)}-item-${String(itemIndex)}`,
        type: "agentMessage",
        text: "message",
      })),
    }));

    const startedAtMilliseconds = performance.now();
    const flattenedItems = flattener.flattenConversationItems(turns, true);
    const elapsedMilliseconds = performance.now() - startedAtMilliseconds;

    expect(flattenedItems.length).toBe(turnCount * itemsPerTurn);
    expect(flattenedItems[flattenedItems.length - 1]?.isLast).toBe(true);
    expect(elapsedMilliseconds).toBeLessThan(1_000);
  });
});
