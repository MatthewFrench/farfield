import { cleanup, render, screen, type RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { TurnItemSchema } from "@farfield/protocol";
import { ConversationItem } from "@/Components/ConversationItem";

type TurnItem = z.infer<typeof TurnItemSchema>;

function renderConversationItem(input: {
  item: TurnItem;
  isLast?: boolean;
  turnIsInProgress?: boolean;
  previousItemType?: TurnItem["type"];
  nextItemType?: TurnItem["type"];
}): RenderResult {
  cleanup();
  return render(
    <ConversationItem
      item={input.item}
      isLast={input.isLast ?? false}
      turnIsInProgress={input.turnIsInProgress ?? false}
      previousItemType={input.previousItemType}
      nextItemType={input.nextItemType}
    />
  );
}

describe("ConversationItem", () => {
  it("does not render a reasoning block when summary and text are both absent", () => {
    const renderResult = renderConversationItem({
      item: {
        id: "reasoning-empty",
        type: "reasoning"
      }
    });

    expect(renderResult.container.innerHTML).toBe("");
  });

  it("renders the default reasoning summary line when text is present but summary is absent", () => {
    renderConversationItem({
      item: {
        id: "reasoning-default-summary",
        type: "reasoning",
        text: "Inspecting project state"
      }
    });

    expect(screen.getByText("Thinking…")).toBeDefined();
  });

  it("renders a deterministic empty receiver label for collaboration tool calls", () => {
    renderConversationItem({
      item: {
        id: "collab-tool-no-receivers",
        type: "collabToolCall",
        tool: "wait",
        status: "completed",
        senderThreadId: "thread-sender",
        receiverThreadIds: [],
        agentsStates: {}
      }
    });

    expect(screen.getByText("receivers: none")).toBeDefined();
  });
});
