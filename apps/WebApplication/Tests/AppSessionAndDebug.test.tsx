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
