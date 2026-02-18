import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

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

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/health")) {
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

    if (url.includes("/api/threads") && !url.includes("/live-state")) {
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

    if (url.includes("/api/collaboration-modes")) {
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

    if (url.includes("/api/models")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          data: [
            {
              id: "gpt-5.3-codex",
              displayName: "GPT-5.3 Codex",
              providerId: "openai",
              providerName: "OpenAI"
            }
          ]
        })
      } as Response;
    }

    if (url.includes("/api/debug/trace/status")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          active: null,
          recent: []
        })
      } as Response;
    }

    if (url.includes("/api/debug/history")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          history: []
        })
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({
        ok: true,
        threadId: "t",
        ownerClientId: null,
        conversationState: null,
        events: []
      })
    } as Response;
  })
);

describe("App", () => {
  it("renders core sections", async () => {
    render(<App />);
    expect(await screen.findByText("Farfield")).toBeTruthy();
    expect(await screen.findByText("No threads")).toBeTruthy();
    expect(await screen.findByText("No thread selected")).toBeTruthy();
  });
});
