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
import { registerAppTestEnvironment } from "./AppTestEnvironment";

const environment = registerAppTestEnvironment();

describe("App", () => {
  it("opens debug and clears the error banner from the banner action", async () => {
    environment.setThreadsFixture({
      ok: true,
      data: [
        {
          id: "thread-1",
          preview: "Thread one",
          createdAt: 1700000000,
          updatedAt: 1700000001,
          source: "opencode",
          agentId: "codex"
        }
      ],
      nextCursor: null,
      pages: 1,
      truncated: false
    });
    let readThreadCallCount = 0;
    environment.setReadThreadResolver((threadId) => {
      readThreadCallCount += 1;
      if (readThreadCallCount === 1) {
        return null;
      }
      return {
        ok: true,
        thread: environment.buildConversationStateFixture(threadId, "gpt-5.3-codex"),
        agentId: "codex"
      };
    });
    environment.setPathname("/threads/thread-1");
    environment.renderApp();

    const initialErrorBannerMessage = (await screen.findByTestId("error-banner-message")).textContent ?? "";
    fireEvent.click(await screen.findByTestId("error-banner-open-debug"));

    await waitFor(() => {
      expect(screen.queryByText(initialErrorBannerMessage)).toBeNull();
    });
    expect(await screen.findByTestId("debug-issues-panel")).toBeTruthy();
  });

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
    environment.setDebugErrorsFixture({
      ok: true,
      data: [
        {
          errorId: "error_1",
          sessionId: "session-test",
          origin: "client",
          source: "farfield-web",
          operation: "send-message",
          message: "Invalid JSON response from /api/threads/thread-1/messages",
          severity: "error",
          name: "Error",
          stack: null,
          requestId: "req_123",
          threadId: "thread-1",
          url: "/threads/thread-1",
          occurredAt: "2026-02-21T00:00:00.000Z",
          recordedAt: "2026-02-21T00:00:01.000Z",
          details: {
            actionId: "action_abc",
            actionName: "send-message"
          }
        }
      ],
      sessionId: "session-test",
      sessionLogPath: "/tmp/session-test.ndjson"
    });

    environment.renderApp();
    fireEvent.click(await screen.findByTestId("tab-debug"));

    expect(await screen.findByTestId("debug-issues-panel")).toBeTruthy();
    expect((await screen.findAllByText("Invalid JSON response from /api/threads/thread-1/messages")).length).toBeGreaterThan(0);
    expect(await screen.findByText("session log")).toBeTruthy();
  });

  it("clears debug issues from the debug panel", async () => {
    environment.setDebugErrorsFixture({
      ok: true,
      data: [
        {
          errorId: "error_2",
          sessionId: "session-test",
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
          details: {}
        }
      ],
      sessionId: "session-test",
      sessionLogPath: "/tmp/session-test.ndjson"
    });

    environment.renderApp();
    fireEvent.click(await screen.findByTestId("tab-debug"));
    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(screen.getByText("No matching issues.")).toBeTruthy();
    });
  });

  it("authenticates api session before loading protected data", async () => {
    environment.setEventsSessionFixture({
      authRequired: true,
      bootstrapped: false,
      expiresAt: null,
      acceptedApiToken: "token-123"
    });

    environment.renderApp();

    expect(await screen.findByText("Authenticate Session")).toBeTruthy();
    expect(screen.getByPlaceholderText("API token")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("API token"), {
      target: { value: "token-123" }
    });
    fireEvent.click(screen.getByText("Authenticate"));

    await waitFor(() => {
      expect(screen.queryByText("Authenticate Session")).toBeNull();
    });

    expect(await screen.findByText("No thread selected")).toBeTruthy();
  });
});
