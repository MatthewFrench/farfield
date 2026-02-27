import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { registerAppTestEnvironment } from "./AppTestEnvironment";

const environment = registerAppTestEnvironment();

function queryThreadListItemByIdentifier(threadId: string): HTMLElement | null {
  const threadListItems = screen.queryAllByTestId("thread-list-item");
  return (
    threadListItems.find((element) => element.getAttribute("data-thread-id") === threadId) ?? null
  );
}

async function waitForThreadListItemByIdentifier(threadId: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(queryThreadListItemByIdentifier(threadId)).toBeTruthy();
  });

  const threadListItem = queryThreadListItemByIdentifier(threadId);
  if (!threadListItem) {
    throw new Error(`Expected thread list item for ${threadId}`);
  }

  return threadListItem;
}

describe("App", () => {
  it("updates the picker when remote model changes with same updatedAt and turns", async () => {
    const threadId = "thread-1";
    let modelId = "gpt-old-codex";

    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: threadId,
          preview: "thread preview",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });

    environment.setModelsFixture({
      ok: true,
      data: [
        {
          id: "gpt-old-codex",
          model: "gpt-old-codex",
          upgrade: null,
          displayName: "gpt-old-codex",
          description: "Old model",
          supportedReasoningEfforts: [
            {
              reasoningEffort: "medium",
              description: "Balanced",
            },
          ],
          defaultReasoningEffort: "medium",
          inputModalities: ["text"],
          supportsPersonality: true,
          isDefault: false,
          hidden: false,
        },
        {
          id: "gpt-new-codex",
          model: "gpt-new-codex",
          upgrade: null,
          displayName: "gpt-new-codex",
          description: "New model",
          supportedReasoningEfforts: [
            {
              reasoningEffort: "medium",
              description: "Balanced",
            },
          ],
          defaultReasoningEffort: "medium",
          inputModalities: ["text"],
          supportsPersonality: true,
          isDefault: true,
          hidden: false,
        },
      ],
      nextCursor: null,
    });

    environment.setReadThreadResolver((targetThreadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: environment.buildConversationStateFixture(targetThreadId, modelId),
      agentId: "codex",
    }));

    environment.setLiveStateResolver((targetThreadId: string) => ({
      ok: true,
      threadId: targetThreadId,
      ownerClientId: "client-1",
      conversationState: environment.buildConversationStateFixture(targetThreadId, modelId),
      liveStateError: null,
    }));

    environment.renderApp();
    expect(await screen.findByText("gpt-old-codex")).toBeTruthy();

    modelId = "gpt-new-codex";
    environment.emitHistoryEventForThread(threadId);

    await waitFor(() => {
      expect(screen.queryByText("gpt-old-codex")).toBeNull();
    });

    expect(await screen.findByText("gpt-new-codex")).toBeTruthy();
  });

  it("keeps loaded turns when thread refresh skips turns payload", async () => {
    const threadId = "thread-preserve-turns";
    let includeTurnsFalseReadCount = 0;
    environment.setPathname(`/threads/${threadId}`);

    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: threadId,
          preview: "thread preserve turns",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });

    environment.setReadThreadResolver((targetThreadId: string, includeTurns: boolean) => {
      const fullState = environment.buildConversationStateFixture(targetThreadId, "gpt-5.3-codex");
      if (!includeTurns) {
        includeTurnsFalseReadCount += 1;
        return {
          ok: true,
          thread: {
            ...fullState,
            updatedAt: fullState.updatedAt + 1,
            turns: [],
          },
          agentId: "codex",
        };
      }
      return {
        ok: true,
        thread: fullState,
        agentId: "codex",
      };
    });

    environment.renderApp();

    await waitForThreadListItemByIdentifier(threadId);
    expect(screen.queryByTestId("chat-empty-no-messages")).toBeNull();

    environment.emitHistoryEventForThread(threadId);

    await waitFor(() => {
      expect(includeTurnsFalseReadCount).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId("chat-empty-no-messages")).toBeNull();
  });

  it("does not auto-select another thread after selection is cleared", async () => {
    const selectedThreadId = "thread-selected";
    const otherThreadId = "thread-other";
    environment.setPathname(`/threads/${selectedThreadId}`);

    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: selectedThreadId,
          preview: "selected thread",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
        {
          id: otherThreadId,
          preview: "other thread",
          createdAt: 1700000001,
          updatedAt: 1700000001,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });

    environment.setReadThreadResolver((threadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: environment.buildConversationStateFixture(threadId, "gpt-5.3-codex"),
      agentId: "codex",
    }));

    environment.renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/threads/${selectedThreadId}`);
    });

    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
    expect(await screen.findByText("No thread selected")).toBeTruthy();

    environment.emitHistoryEventForThread(otherThreadId);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
    expect(screen.getByText("No thread selected")).toBeTruthy();
  });

  it("shows unread marker for a newly updated thread and clears it when opened", async () => {
    const selectedId = "thread-1";
    const updatedId = "thread-2";
    environment.setPathname(`/threads/${selectedId}`);

    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: selectedId,
          preview: "selected thread",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
        {
          id: updatedId,
          preview: "updated thread",
          createdAt: 1700000001,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });

    environment.setReadThreadResolver((threadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: environment.buildConversationStateFixture(threadId, "gpt-5.3-codex"),
      agentId: "codex",
    }));

    environment.renderApp();

    await waitForThreadListItemByIdentifier(selectedId);
    expect(screen.queryByTestId(`thread-unread-indicator-${updatedId}`)).toBeNull();

    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: selectedId,
          preview: "selected thread",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
        {
          id: updatedId,
          preview: "updated thread",
          createdAt: 1700000001,
          updatedAt: 1700000050,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });

    environment.emitHistoryEventForThread(updatedId);

    await waitFor(() => {
      expect(screen.getByTestId(`thread-unread-indicator-${updatedId}`)).toBeTruthy();
    });

    const updatedThreadButton = await waitForThreadListItemByIdentifier(updatedId);
    fireEvent.click(updatedThreadButton);

    await waitFor(() => {
      expect(screen.queryByTestId(`thread-unread-indicator-${updatedId}`)).toBeNull();
    });
  });
});
