import type { TurnItemSchema } from "@farfield/protocol";
import { cleanup, fireEvent, type RenderResult, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { ConversationItem } from "@/Components/ConversationItem";

type TurnItem = z.infer<typeof TurnItemSchema>;

function renderConversationItem(input: {
  item: TurnItem;
  isLast?: boolean;
  turnIsInProgress?: boolean;
  previousItemType?: TurnItem["type"];
  nextItemType?: TurnItem["type"];
  onForkFromMessage?: (messageId: string) => void;
}): RenderResult {
  cleanup();
  return render(
    <ConversationItem
      item={input.item}
      isLast={input.isLast ?? false}
      turnIsInProgress={input.turnIsInProgress ?? false}
      previousItemType={input.previousItemType}
      nextItemType={input.nextItemType}
      onForkFromMessage={input.onForkFromMessage}
    />,
  );
}

describe("ConversationItem", () => {
  it("does not render a reasoning block when summary and text are both absent", () => {
    const renderResult = renderConversationItem({
      item: {
        id: "reasoning-empty",
        type: "reasoning",
      },
    });

    expect(renderResult.container.innerHTML).toBe("");
  });

  it("renders the default reasoning summary line when text is present but summary is absent", () => {
    renderConversationItem({
      item: {
        id: "reasoning-default-summary",
        type: "reasoning",
        text: "Inspecting project state",
      },
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
        agentsStates: {},
      },
    });

    expect(screen.getByText("receivers: none")).toBeDefined();
  });

  it("applies compact spacing when a web-search item is surrounded by tool blocks", () => {
    renderConversationItem({
      item: {
        id: "web-search-between-tools",
        type: "webSearch",
        query: "render contracts",
        action: {
          type: "search",
          query: "render contracts",
        },
      },
      previousItemType: "commandExecution",
      nextItemType: "fileChange",
    });

    const panel = screen.getByText("Web search").parentElement;
    if (panel === null) {
      throw new Error("Expected web search panel container to exist");
    }

    expect(panel.className).toContain("my-1");
  });

  it("renders dynamic tool call items and treats them as tool blocks for spacing", () => {
    renderConversationItem({
      item: {
        id: "dynamic-tool-call-1",
        type: "dynamicToolCall",
        tool: "read_thread_terminal",
        arguments: {},
        status: "completed",
        contentItems: [
          {
            type: "inputText",
            text: "cwd: /workspace",
          },
        ],
        success: true,
        durationMs: 12,
      },
      previousItemType: "commandExecution",
      nextItemType: "fileChange",
    });

    expect(screen.getByText("Dynamic tool")).toBeDefined();
    expect(screen.getByText("read_thread_terminal (completed)")).toBeDefined();
    expect(screen.getByText("cwd: /workspace")).toBeDefined();

    const panel = screen.getByText("Dynamic tool").parentElement;
    if (panel === null) {
      throw new Error("Expected dynamic tool panel container to exist");
    }

    expect(panel.className).toContain("my-1");
  });

  it("applies leading spacing when the next item is a tool block", () => {
    renderConversationItem({
      item: {
        id: "web-search-before-tool",
        type: "webSearch",
        query: "spacing contracts",
        action: {
          type: "search",
          query: "spacing contracts",
        },
      },
      nextItemType: "commandExecution",
    });

    const panel = screen.getByText("Web search").parentElement;
    if (panel === null) {
      throw new Error("Expected web search panel container to exist");
    }

    expect(panel.className).toContain("mt-4 mb-1");
  });

  it("renders user input response answers with deterministic separators", () => {
    renderConversationItem({
      item: {
        id: "user-input-response",
        type: "userInputResponse",
        requestId: 1,
        turnId: "turn-1",
        questions: [],
        answers: {
          q1: ["first", "second"],
          q2: ["third"],
        },
      },
    });

    const responseTextContainer = screen.getByText("Response").nextElementSibling;
    if (responseTextContainer === null) {
      throw new Error("Expected response text container to exist");
    }

    expect(responseTextContainer.textContent).toBe("first, second\nthird");
  });

  it("renders image-view items with local-image route sources", () => {
    renderConversationItem({
      item: {
        id: "image-view-item",
        type: "imageView",
        path: "/tmp/viewed image.png",
      },
    });

    const image = screen.getByRole("img", { name: "Viewed image: /tmp/viewed image.png" });
    expect(image.getAttribute("src")).toBe("/api/files/local-image?path=%2Ftmp%2Fviewed+image.png");
  });

  it("emits message fork actions for supported message items", () => {
    const onForkFromMessage = vi.fn();

    renderConversationItem({
      item: {
        id: "agent-message-1",
        type: "agentMessage",
        text: "Response",
      },
      onForkFromMessage,
    });

    fireEvent.click(screen.getByRole("button", { name: "Fork from here" }));
    expect(onForkFromMessage).toHaveBeenCalledWith("agent-message-1");
  });
});
