import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { registerAppTestEnvironment } from "./AppTestEnvironment";
import {
  type DebugErrorFixture,
  type DebugErrorsFixture,
  type EventsSessionFixture,
  type ThreadListFixture,
} from "./AppTestFixtureContracts";

const environment = registerAppTestEnvironment();
const THREAD_ID = "thread-1";
const SESSION_ID = "session-test";
const SESSION_LOG_PATH = "/tmp/session-test.ndjson";
const DEBUG_ERROR_MESSAGE = "Invalid JSON response from /api/threads/thread-1/messages";

function createThreadListFixture(): ThreadListFixture {
  return {
    ok: true,
    data: [
      {
        id: THREAD_ID,
        preview: "Thread one",
        createdAt: 1700000000,
        updatedAt: 1700000001,
        source: "opencode",
        agentId: "codex",
      },
    ],
    nextCursor: null,
    pages: 1,
    truncated: false,
  };
}

function createDebugErrorsFixture(error: DebugErrorFixture): DebugErrorsFixture {
  return {
    ok: true,
    data: [error],
    sessionId: SESSION_ID,
    sessionLogPath: SESSION_LOG_PATH,
  };
}

function createEventsSessionFixture(acceptedApiToken: string): EventsSessionFixture {
  return {
    authRequired: true,
    bootstrapped: false,
    expiresAt: null,
    acceptedApiToken,
  };
}

describe("App", () => {
  it("opens debug and clears the error banner from the banner action", async () => {
    environment.setThreadsFixture(createThreadListFixture());
    let readThreadCallCount = 0;
    environment.setReadThreadResolver((threadId) => {
      readThreadCallCount += 1;
      if (readThreadCallCount === 1) {
        return null;
      }
      return {
        ok: true,
        thread: environment.buildConversationStateFixture(threadId, "gpt-5.3-codex"),
        agentId: "codex",
      };
    });
    environment.setPathname(`/threads/${THREAD_ID}`);
    environment.renderApp();

    const initialErrorBannerElement = await screen.findByTestId("error-banner-message");
    const initialErrorBannerMessage = initialErrorBannerElement.textContent;
    expect(initialErrorBannerMessage.length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByTestId("error-banner-open-debug"));

    await waitFor(() => {
      expect(screen.queryByTestId("error-banner-message")).toBeNull();
    });
    expect(await screen.findByTestId("debug-issues-panel")).toBeTruthy();
  }, 15000);

  it("closes debug view when opening the threads sidebar", async () => {
    environment.setPathname("/debug");
    environment.renderApp();

    expect(await screen.findByTestId("debug-issues-panel")).toBeTruthy();

    fireEvent.click(screen.getByTestId("sidebar-toggle-open"));

    await waitFor(() => {
      expect(screen.queryByTestId("debug-issues-panel")).toBeNull();
    });
    expect(await screen.findByTestId("chat-surface")).toBeTruthy();
  });

  it("shows client errors in the debug issues panel", async () => {
    environment.setDebugErrorsFixture(
      createDebugErrorsFixture({
        errorId: "error_1",
        sessionId: SESSION_ID,
        origin: "client",
        source: "farfield-web",
        operation: "send-message",
        message: DEBUG_ERROR_MESSAGE,
        severity: "error",
        name: "Error",
        stack: null,
        requestId: "req_123",
        threadId: THREAD_ID,
        url: `/threads/${THREAD_ID}`,
        occurredAt: "2026-02-21T00:00:00.000Z",
        recordedAt: "2026-02-21T00:00:01.000Z",
        details: {
          actionId: "action_abc",
          actionName: "send-message",
        },
      }),
    );

    environment.renderApp();
    fireEvent.click(await screen.findByTestId("tab-debug"));

    expect(await screen.findByTestId("debug-issues-panel")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("No matching issues.")).toBeNull();
    });
    expect(await screen.findByText("session log")).toBeTruthy();
  });

  it("clears debug issues from the debug panel", async () => {
    environment.setDebugErrorsFixture(
      createDebugErrorsFixture({
        errorId: "error_2",
        sessionId: SESSION_ID,
        origin: "server",
        source: "farfield-server",
        operation: "http:request",
        message: "Request failed",
        severity: "warning",
        name: "Error",
        stack: null,
        requestId: "req_456",
        threadId: null,
        url: "/api/threads",
        occurredAt: "2026-02-21T00:00:00.000Z",
        recordedAt: "2026-02-21T00:00:01.000Z",
        details: {},
      }),
    );

    environment.renderApp();
    fireEvent.click(await screen.findByTestId("tab-debug"));

    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(screen.getByText("No matching issues.")).toBeTruthy();
    });
  });

  it("authenticates api session before loading protected data", async () => {
    environment.setEventsSessionFixture(createEventsSessionFixture("token-123"));

    environment.renderApp();

    expect(await screen.findByText("Authenticate Session")).toBeTruthy();
    expect(screen.getByPlaceholderText("API token")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("API token"), {
      target: { value: "token-123" },
    });
    fireEvent.click(screen.getByText("Authenticate"));

    await waitFor(() => {
      expect(screen.queryByText("Authenticate Session")).toBeNull();
    });

    expect(await screen.findByText("No thread selected")).toBeTruthy();
  });

  it("keeps api session challenge visible when provided token is invalid", async () => {
    environment.setEventsSessionFixture(createEventsSessionFixture("token-123"));

    environment.renderApp();

    expect(await screen.findByText("Authenticate Session")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("API token"), {
      target: { value: "token-wrong" },
    });
    fireEvent.click(screen.getByText("Authenticate"));

    await waitFor(() => {
      expect(screen.getByText("Authenticate Session")).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("API token")).toBeTruthy();
  });
});
