import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useFlatConversationItemsDerivedState } from "@/Application/StateManagement/UseFlatConversationItemsDerivedState";
import {
  ConversationItemFlattener,
  type ConversationTurn,
  type FlattenedConversationItem,
} from "@/Features/Chat/DomainModel/ConversationItemFlattener";

interface FlatConversationItemsHarnessProperties {
  turns: ConversationTurn[];
  isGenerating: boolean;
  visibleChatItemLimit: number;
  onSnapshot: (snapshot: {
    conversationItemCount: number;
    visibleConversationItems: FlattenedConversationItem[];
  }) => void;
}

function FlatConversationItemsHarness(
  properties: FlatConversationItemsHarnessProperties,
): React.JSX.Element {
  const { conversationItemCount, visibleConversationItems } = useFlatConversationItemsDerivedState({
    turns: properties.turns,
    isGenerating: properties.isGenerating,
    visibleChatItemLimit: properties.visibleChatItemLimit,
    conversationItemFlattener: new ConversationItemFlattener(),
  });

  useEffect(() => {
    properties.onSnapshot({
      conversationItemCount,
      visibleConversationItems,
    });
  }, [conversationItemCount, properties, visibleConversationItems]);

  return <></>;
}

function createTurn(input: { status: string; items: ConversationTurn["items"] }): ConversationTurn {
  return {
    status: input.status,
    items: input.items,
  };
}

describe("useFlatConversationItemsDerivedState", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns total count and only the visible suffix items", () => {
    const turns: ConversationTurn[] = [
      createTurn({
        status: "completed",
        items: [
          {
            id: "agent-visible-1",
            type: "agentMessage",
            text: "one",
          },
          {
            id: "agent-visible-2",
            type: "agentMessage",
            text: "two",
          },
          {
            id: "agent-visible-3",
            type: "agentMessage",
            text: "three",
          },
        ],
      }),
    ];
    const snapshots: Array<{
      conversationItemCount: number;
      visibleConversationItems: FlattenedConversationItem[];
    }> = [];

    render(
      <FlatConversationItemsHarness
        turns={turns}
        isGenerating={false}
        visibleChatItemLimit={2}
        onSnapshot={(snapshot) => {
          snapshots.push(snapshot);
        }}
      />,
    );

    expect(snapshots[0]?.conversationItemCount).toBe(3);
    expect(snapshots[0]?.visibleConversationItems.map((item) => item.key)).toEqual([
      "agent-visible-2",
      "agent-visible-3",
    ]);
    expect(snapshots[0]?.visibleConversationItems[0]?.isLast).toBe(false);
    expect(snapshots[0]?.visibleConversationItems[1]?.isLast).toBe(true);
  });
});
