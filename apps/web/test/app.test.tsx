import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, isPlaceholderCommitValue } from "../src/App";

class MockEventSource {
  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  public constructor(_url: string) {}

  public close(): void {}
}

vi.stubGlobal("EventSource", MockEventSource);
vi.stubGlobal(
  "ResizeObserver",
  class {
    public observe(): void {}
    public disconnect(): void {}
    public unobserve(): void {}
  }
);
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  media: "(prefers-color-scheme: dark)",
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false
}));
vi.stubGlobal("localStorage", {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
});
Object.defineProperty(window.HTMLElement.prototype, "scrollTo", {
  value: () => undefined,
  writable: true
});
Object.defineProperty(window, "scrollTo", {
  value: () => undefined,
  writable: true
});

let threadsDelayPromise: Promise<void> | null = null;
let releaseThreadsDelay: (() => void) | null = null;

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const parsedUrl = new URL(url, "http://127.0.0.1");

    if (parsedUrl.pathname === "/api/health") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          state: {
            appReady: true,
            ipcConnected: true,
            ipcInitialized: true,
            lastError: null,
            historyCount: 0,
            threadOwnerCount: 0
          }
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/api/events/session") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          authRequired: true,
          bootstrapped: true,
          expiresAt: "2026-02-19T00:00:00.000Z"
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/api/threads") {
      if (threadsDelayPromise) {
        await threadsDelayPromise;
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: [],
          nextCursor: null,
          pages: 0,
          truncated: false
        })
      } as Response;
    }

    if (parsedUrl.pathname.startsWith("/api/threads/") && parsedUrl.pathname.endsWith("/live-state")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          threadId: "thread_test",
          ownerClientId: null,
          conversationState: null
        })
      } as Response;
    }

    if (parsedUrl.pathname.startsWith("/api/threads/") && parsedUrl.pathname.endsWith("/stream-events")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          threadId: "thread_test",
          ownerClientId: null,
          events: []
        })
      } as Response;
    }

    if (parsedUrl.pathname.startsWith("/api/threads/")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          thread: {
            id: "thread_test",
            turns: [],
            requests: []
          }
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/api/collaboration-modes") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: [
            {
              name: "Plan",
              mode: "plan",
              model: null,
              reasoning_effort: "medium",
              developer_instructions: "x"
            }
          ]
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/api/models") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: [
            {
              id: "gpt-5.3-codex",
              model: "gpt-5.3-codex",
              upgrade: null,
              displayName: "GPT-5.3 Codex",
              description: "Test model",
              supportedReasoningEfforts: [
                {
                  reasoningEffort: "medium",
                  description: "Balanced"
                }
              ],
              defaultReasoningEffort: "medium",
              inputModalities: ["text"],
              supportsPersonality: true,
              isDefault: true
            }
          ],
          nextCursor: null
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/api/debug/trace/status") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          active: null,
          recent: []
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/api/debug/history") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          history: []
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/api/debug/client-errors") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: [],
          sessionId: "session_test",
          sessionLogPath: ".runtime/logs/errors/session-test.ndjson"
        })
      } as Response;
    }

    if (parsedUrl.pathname.startsWith("/api/debug/client-errors/")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          error: {
            errorId: "error_test",
            sessionId: "session_test",
            origin: "client",
            source: "web-app",
            operation: "test",
            message: "test",
            name: null,
            stack: null,
            requestId: null,
            threadId: null,
            url: null,
            occurredAt: "2026-02-18T00:00:00.000Z",
            recordedAt: "2026-02-18T00:00:00.000Z",
            details: {}
          },
          sessionId: "session_test",
          sessionLogPath: ".runtime/logs/errors/session-test.ndjson"
        })
      } as Response;
    }

    if (parsedUrl.pathname === "/healthz") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          service: "farfield-web-shell",
          buildId: "test-build",
          gitCommit: "abc1234",
          serviceWorkerVersion: "sw1234567890",
          timestamp: new Date().toISOString()
        })
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({
        ok: false,
        error: `Unhandled test route: ${parsedUrl.pathname}`
      })
    } as Response;
  })
);

describe("App", () => {
  beforeEach(() => {
    threadsDelayPromise = null;
    releaseThreadsDelay = null;
  });

  it("renders core sections", async () => {
    render(<App />);
    expect(await screen.findByText("Farfield")).toBeTruthy();
    expect(await screen.findByText("No threads")).toBeTruthy();
    expect(await screen.findByText("No thread selected")).toBeTruthy();
  });

  it("shows loading threads state before empty state", async () => {
    threadsDelayPromise = new Promise<void>((resolve) => {
      releaseThreadsDelay = resolve;
    });

    render(<App />);
    expect((await screen.findAllByText("Loading threads...")).length).toBeGreaterThan(0);

    releaseThreadsDelay?.();
    threadsDelayPromise = null;
    releaseThreadsDelay = null;

    expect((await screen.findAllByText("No threads")).length).toBeGreaterThan(0);
  });
});

describe("build metadata helpers", () => {
  it("treats dev commit markers as placeholders", () => {
    expect(isPlaceholderCommitValue("dev")).toBe(true);
    expect(isPlaceholderCommitValue(" DEV ")).toBe(true);
    expect(isPlaceholderCommitValue("unknown")).toBe(true);
    expect(isPlaceholderCommitValue("null")).toBe(true);
    expect(isPlaceholderCommitValue("none")).toBe(true);
  });

  it("keeps real commit hashes as non-placeholders", () => {
    expect(isPlaceholderCommitValue("a1b2c3d")).toBe(false);
    expect(isPlaceholderCommitValue("f0e1d2c3b4")).toBe(false);
  });
});
