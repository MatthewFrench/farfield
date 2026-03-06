import { cleanup, render, waitFor } from "@testing-library/react";
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
  workerOwner: DelayedConversationItemFlatteningWorkerOwner;
  onSnapshot: (flatConversationItems: FlattenedConversationItem[]) => void;
}

class DelayedConversationItemFlatteningWorkerOwner {
  private readonly delayedItems: FlattenedConversationItem[];
  private readonly delayMilliseconds: number;

  public constructor(delayedItems: FlattenedConversationItem[], delayMilliseconds: number) {
    this.delayedItems = delayedItems;
    this.delayMilliseconds = delayMilliseconds;
  }

  public async readFlattenedConversationItems(): Promise<FlattenedConversationItem[]> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, this.delayMilliseconds);
    });
    return this.delayedItems;
  }

  public dispose(): void {}
}

function FlatConversationItemsHarness(
  properties: FlatConversationItemsHarnessProperties,
): React.JSX.Element {
  const { flatConversationItems } = useFlatConversationItemsDerivedState({
    turns: properties.turns,
    isGenerating: properties.isGenerating,
    conversationItemFlattener: new ConversationItemFlattener(),
    conversationItemFlatteningWorkerOwner: properties.workerOwner,
  });

  useEffect(() => {
    properties.onSnapshot(flatConversationItems);
  }, [flatConversationItems, properties]);

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

  it("returns current in-thread flattened items while worker results are still pending", async () => {
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
    const delayedWorkerItems = flattener.flattenConversationItems(turns, false);
    const workerOwner = new DelayedConversationItemFlatteningWorkerOwner(delayedWorkerItems, 25);
    const snapshots: FlattenedConversationItem[][] = [];

    render(
      <FlatConversationItemsHarness
        turns={turns}
        isGenerating={false}
        workerOwner={workerOwner}
        onSnapshot={(flatConversationItems) => {
          snapshots.push(flatConversationItems);
        }}
      />,
    );

    expect(snapshots[0]?.map((item) => item.key)).toEqual(["agent-visible"]);

    await waitFor(() => {
      const latestSnapshot = snapshots.at(-1);
      expect(latestSnapshot?.map((item) => item.key)).toEqual(["agent-visible"]);
    });
  });
});
