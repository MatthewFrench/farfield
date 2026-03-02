import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_LAST_VIEWED_THREAD_STORAGE_KEY } from "../Source/Features/Threads/DataAccess/LastViewedThreadPreferenceStore";
import { OPENCODE_CAPABILITIES, registerAppTestEnvironment } from "./AppTestEnvironment";
import { type ReadThreadFixture } from "./AppTestFixtureContracts";

const environment = registerAppTestEnvironment();

interface Deferred<ValueType> {
  promise: Promise<ValueType>;
  resolve: (value: ValueType) => void;
}

function createDeferred<ValueType>(): Deferred<ValueType> {
  let resolver: ((value: ValueType) => void) | undefined;
  const promise = new Promise<ValueType>((resolve) => {
    resolver = resolve;
  });

  if (resolver === undefined) {
    throw new Error("Expected deferred resolver to be assigned");
  }

  return {
    promise,
    resolve: resolver,
  };
}

describe("App", () => {
  it("renders core sections", async () => {
    environment.renderApp();
    expect((await screen.findAllByText("Farfield")).length).toBeGreaterThan(0);
    expect(await screen.findByText("No thread selected")).toBeTruthy();
  });

  it("shows selected-thread loading state before thread hydrate completes", async () => {
    const threadId = "thread-loading";
    const readThreadDeferred = createDeferred<ReadThreadFixture | null>();
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
          agentId: "codex",
        },
      ],
      nextCursor: null,
      pages: 1,
      truncated: false,
    });

    const conversationState = environment.buildConversationStateFixture(threadId, "gpt-5.3-codex");
    conversationState.turns = [];
    environment.setReadThreadResolver(
      (_targetThreadId: string, _includeTurns: boolean) => readThreadDeferred.promise,
    );

    environment.renderApp();

    expect(await screen.findByTestId("chat-empty-loading-thread")).toBeTruthy();

    readThreadDeferred.resolve({
      ok: true,
      thread: {
        ...conversationState,
        id: threadId,
      },
      agentId: "codex",
    });

    await waitFor(() => {
      expect(screen.queryByTestId("chat-empty-loading-thread")).toBeNull();
    });

    expect(await screen.findByTestId("chat-empty-no-messages")).toBeTruthy();
  });

  it("restores the last-viewed thread from browser storage when route thread selection is missing", async () => {
    const threadId = "thread-from-storage";
    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: threadId,
          preview: "restored thread preview",
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
    window.localStorage.setItem(DEFAULT_LAST_VIEWED_THREAD_STORAGE_KEY, threadId);

    environment.renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/threads/${threadId}`);
    });
  });

  it("does not restore the last-viewed thread for debug root route selection", async () => {
    const persistedThreadId = "thread-from-storage";
    const firstThreadId = "thread-first";
    environment.setPathname("/debug");
    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: firstThreadId,
          preview: "first thread preview",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex",
        },
        {
          id: persistedThreadId,
          preview: "persisted thread preview",
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
    window.localStorage.setItem(DEFAULT_LAST_VIEWED_THREAD_STORAGE_KEY, persistedThreadId);

    environment.renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/threads/${firstThreadId}/settings`);
      expect(window.location.search).toBe("?tab=debug");
    });
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
          projectDirectories: [],
        },
      ],
      defaultAgentId: "opencode",
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
      writable: true,
    });

    try {
      environment.renderApp();
      await screen.findByText("No thread selected");
      expect(screen.queryByTestId("sidebar-mobile")).toBeNull();

      const appShell = await screen.findByTestId("app-shell");
      fireEvent.touchStart(appShell, {
        touches: [{ clientX: 8, clientY: 110 }],
      });
      fireEvent.touchMove(appShell, {
        touches: [{ clientX: 92, clientY: 116 }],
      });

      await waitFor(() => {
        expect(screen.getByTestId("sidebar-mobile")).toBeTruthy();
      });
    } finally {
      Object.defineProperty(window, "innerWidth", {
        value: originalInnerWidth,
        configurable: true,
        writable: true,
      });
    }
  });
});
