import {
  fireEvent,
  screen,
  waitFor
} from "@testing-library/react";
import {
  describe,
  expect,
  it
} from "vitest";
import {
  OPENCODE_CAPABILITIES,
  registerAppTestEnvironment
} from "./AppTestEnvironment";

const environment = registerAppTestEnvironment();

describe("App", () => {
  it("renders core sections", async () => {
    environment.renderApp();
    expect((await screen.findAllByText("Farfield")).length).toBeGreaterThan(0);
    expect(await screen.findByText("No thread selected")).toBeTruthy();
  });

  it("shows selected-thread loading state before thread hydrate completes", async () => {
    const threadId = "thread-loading";
    environment.setPathname(`/threads/${threadId}`);

    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: threadId,
          preview: "loading thread preview",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex"
        }
      ],
      nextCursor: null,
      pages: 1,
      truncated: false
    });

    const conversationState = environment.buildConversationStateFixture(threadId, "gpt-5.3-codex");
    conversationState.turns = [];
    environment.setReadThreadResolver((targetThreadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: {
        ...conversationState,
        id: targetThreadId
      },
      agentId: "codex"
    }));
    environment.setReadThreadDelayMilliseconds(220);

    environment.renderApp();

    expect(await screen.findByTestId("chat-empty-loading-thread")).toBeTruthy();
    expect(screen.queryByTestId("chat-empty-no-messages")).toBeNull();

    await waitFor(() => {
      expect(screen.queryByTestId("chat-empty-loading-thread")).toBeNull();
    });

    expect(await screen.findByTestId("chat-empty-no-messages")).toBeTruthy();
  });

  it("hides mode controls when capability is disabled", async () => {
    environment.setAgentsFixture({
      ok: true,
      agents: [
        {
          id: "opencode",
          label: "OpenCode",
          enabled: true,
          connected: true,
          capabilities: OPENCODE_CAPABILITIES,
          projectDirectories: []
        }
      ],
      defaultAgentId: "opencode"
    });

    environment.renderApp();
    await screen.findAllByText("Farfield");
    expect(screen.queryByText("Plan")).toBeNull();
  });

  it("shows mode controls when capability is enabled", async () => {
    environment.renderApp();
    expect(await screen.findByText("Plan")).toBeTruthy();
  });

  it("opens mobile sidebar with a left-edge swipe gesture", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      value: 390,
      configurable: true,
      writable: true
    });

    try {
      environment.renderApp();
      await screen.findByText("No thread selected");
      expect(screen.queryByTestId("sidebar-mobile")).toBeNull();

      const appShell = await screen.findByTestId("app-shell");
      fireEvent.touchStart(appShell, {
        touches: [{ clientX: 8, clientY: 110 }]
      });
      fireEvent.touchMove(appShell, {
        touches: [{ clientX: 92, clientY: 116 }]
      });

      await waitFor(() => {
        expect(screen.getByTestId("sidebar-mobile")).toBeTruthy();
      });
    } finally {
      Object.defineProperty(window, "innerWidth", {
        value: originalInnerWidth,
        configurable: true,
        writable: true
      });
    }
  });
});
