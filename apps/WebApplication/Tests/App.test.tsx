import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { App } from "../Source/App";

class MockEventSource {
  private static instances: MockEventSource[] = [];
  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  public constructor(_url: string) {
    MockEventSource.instances.push(this);
  }

  public close(): void {
    MockEventSource.instances = MockEventSource.instances.filter((instance) => instance !== this);
  }

  public static emit(payload: Record<string, object | string | number | boolean | null | undefined>): void {
    const event = new MessageEvent<string>("message", {
      data: JSON.stringify(payload)
    });
    for (const instance of MockEventSource.instances) {
      instance.onmessage?.(event);
    }
  }

  public static reset(): void {
    MockEventSource.instances = [];
  }
}

vi.stubGlobal("EventSource", MockEventSource);

// jsdom doesn't implement scrollTo or ResizeObserver.
Element.prototype.scrollTo = vi.fn();
window.scrollTo = vi.fn();
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
  matches: query === "(prefers-color-scheme: dark)",
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
})));

const localStorageState = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => localStorageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageState.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageState.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageState.clear();
  })
});

const codexCapabilities = {
  canListModels: true,
  canListCollaborationModes: true,
  canSetCollaborationMode: true,
  canSubmitUserInput: true,
  canReadLiveState: true,
  canReadStreamEvents: true
};

const opencodeCapabilities = {
  canListModels: false,
  canListCollaborationModes: false,
  canSetCollaborationMode: false,
  canSubmitUserInput: false,
  canReadLiveState: false,
  canReadStreamEvents: false
};

const EventsSessionBootstrapRequestSchema = z
  .object({
    apiToken: z.string().trim().min(1)
  })
  .strict();

type CapabilityFixture = {
  canListModels: boolean;
  canListCollaborationModes: boolean;
  canSetCollaborationMode: boolean;
  canSubmitUserInput: boolean;
  canReadLiveState: boolean;
  canReadStreamEvents: boolean;
};

let agentsFixture: {
  ok: true;
  agents: Array<{
    id: "codex" | "opencode";
    label: string;
    enabled: boolean;
    connected: boolean;
    capabilities: CapabilityFixture;
    projectDirectories: string[];
  }>;
  defaultAgentId: "codex" | "opencode";
};

let threadsFixture: {
  ok: true;
  data: Array<{
    id: string;
    preview: string;
    createdAt: number;
    updatedAt: number;
    cwd?: string;
    source: "opencode";
    agentId: "codex" | "opencode";
  }>;
  nextCursor: null;
  pages: number;
  truncated: boolean;
};

let collaborationModesFixture: {
  ok: true;
  data: Array<{
    name: string;
    mode: string;
    model: string | null;
    reasoning_effort: string;
    developer_instructions: string | null;
  }>;
};

let modelsFixture: {
  ok: true;
  data: Array<{
    id: string;
    model: string;
    upgrade: null;
    displayName: string;
    description: string;
    supportedReasoningEfforts: Array<{
      reasoningEffort: string;
      description: string;
    }>;
    defaultReasoningEffort: string;
    inputModalities: string[];
    supportsPersonality: boolean;
    isDefault: boolean;
    hidden: boolean;
  }>;
  nextCursor: null;
};

let debugErrorsFixture: {
  ok: true;
  data: Array<{
    errorId: string;
    sessionId: string;
    origin: "client" | "server";
    source: string;
    operation: string;
    message: string;
    name: string | null;
    stack: string | null;
    requestId: string | null;
    threadId: string | null;
    url: string | null;
    occurredAt: string;
    recordedAt: string;
    details: Record<string, string | number | boolean | null>;
  }>;
  sessionId: string;
  sessionLogPath: string;
};

let configDefaultsFixture: {
  ok: true;
  agentId: "codex" | "opencode" | null;
  model: string | null;
  reasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | null;
};

let readThreadResolver: (threadId: string, includeTurns: boolean) => {
  ok: true;
  thread: Record<string, object | string | number | boolean | null | undefined>;
  agentId: "codex" | "opencode";
} | null;

let liveStateResolver: (threadId: string) => {
  ok: true;
  threadId: string;
  ownerClientId: string | null;
  conversationState: Record<string, object | string | number | boolean | null | undefined> | null;
  liveStateError: null;
};

let readThreadDelayMs = 0;
let eventsSessionFixture: {
  authRequired: boolean;
  bootstrapped: boolean;
  expiresAt: string | null;
  acceptedApiToken: string;
};

function buildConversationStateFixture(threadId: string, modelId: string): {
  id: string;
  turns: Array<{
    id: string;
    status: string;
    items: [];
  }>;
  requests: [];
  updatedAt: number;
  latestModel: string;
  latestReasoningEffort: string;
  latestCollaborationMode: {
    mode: string;
    settings: {
      model: string;
      reasoning_effort: string;
      developer_instructions: null;
    };
  };
} {
  return {
    id: threadId,
    turns: [
      {
        id: "turn-1",
        status: "completed",
        items: []
      }
    ],
    requests: [],
    updatedAt: 1700000000,
    latestModel: modelId,
    latestReasoningEffort: "medium",
    latestCollaborationMode: {
      mode: "default",
      settings: {
        model: modelId,
        reasoning_effort: "medium",
        developer_instructions: null
      }
    }
  };
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  MockEventSource.reset();
  localStorageState.clear();
  agentsFixture = {
    ok: true,
    agents: [
      {
        id: "codex",
        label: "Codex",
        enabled: true,
        connected: true,
        capabilities: codexCapabilities,
        projectDirectories: []
      }
    ],
    defaultAgentId: "codex"
  };

  threadsFixture = {
    ok: true,
    data: [],
    nextCursor: null,
    pages: 0,
    truncated: false
  };

  collaborationModesFixture = {
    ok: true,
    data: [
      {
        name: "Default",
        mode: "default",
        model: null,
        reasoning_effort: "medium",
        developer_instructions: null
      },
      {
        name: "Plan",
        mode: "plan",
        model: null,
        reasoning_effort: "medium",
        developer_instructions: "x"
      }
    ]
  };

  modelsFixture = {
    ok: true,
    data: [
      {
        id: "gpt-5.3-codex",
        model: "gpt-5.3-codex",
        upgrade: null,
        displayName: "gpt-5.3-codex",
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
        isDefault: true,
        hidden: false
      }
    ],
    nextCursor: null
  };

  debugErrorsFixture = {
    ok: true,
    data: [],
    sessionId: "session-test",
    sessionLogPath: "/tmp/session-test.ndjson"
  };

  configDefaultsFixture = {
    ok: true,
    agentId: "codex",
    model: "gpt-5.3-codex",
    reasoningEffort: "medium"
  };

  readThreadResolver = (_threadId: string, _includeTurns: boolean) => null;
  liveStateResolver = (threadId: string) => ({
    ok: true,
    threadId,
    ownerClientId: null,
    conversationState: null,
    liveStateError: null
  });
  readThreadDelayMs = 0;
  eventsSessionFixture = {
    authRequired: false,
    bootstrapped: true,
    expiresAt: "2099-01-01T00:00:00.000Z",
    acceptedApiToken: "test-api-token"
  };
});

afterEach(() => {
  cleanup();
});

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const parsedUrl = new URL(url, "http://localhost");
    const pathname = parsedUrl.pathname;
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    const threadId = segments[2] ? decodeURIComponent(segments[2]) : "";

    if (pathname === "/api/events/session") {
      const maybeJsonBody = init?.body;
      if (typeof maybeJsonBody === "string") {
        const parsedBody = EventsSessionBootstrapRequestSchema.parse(JSON.parse(maybeJsonBody));
        if (parsedBody.apiToken === eventsSessionFixture.acceptedApiToken) {
          eventsSessionFixture.bootstrapped = true;
          eventsSessionFixture.expiresAt = "2099-01-01T00:00:00.000Z";
        }
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          authRequired: eventsSessionFixture.authRequired,
          bootstrapped: eventsSessionFixture.bootstrapped,
          expiresAt: eventsSessionFixture.bootstrapped ? eventsSessionFixture.expiresAt : null
        })
      } as Response;
    }

    if (pathname === "/api/health") {
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

    if (pathname.startsWith("/api/threads/") && pathname.endsWith("/live-state")) {
      return {
        ok: true,
        json: async () => liveStateResolver(threadId)
      } as Response;
    }

    if (pathname.startsWith("/api/threads/") && pathname.endsWith("/stream-events")) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          threadId,
          ownerClientId: null,
          events: [],
          nextSequence: 0,
          firstAvailableSequence: 0,
          resetRequired: false
        })
      } as Response;
    }

    if (pathname.startsWith("/api/threads/") && parsedUrl.searchParams.has("includeTurns")) {
      const includeTurns = parsedUrl.searchParams.get("includeTurns") === "true";
      const readThread = readThreadResolver(threadId, includeTurns);
      if (readThread) {
        if (readThreadDelayMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, readThreadDelayMs);
          });
        }
        return {
          ok: true,
          json: async () => readThread
        } as Response;
      }
    }

    if (pathname === "/api/threads") {
      return {
        ok: true,
        json: async () => threadsFixture
      } as Response;
    }

    if (pathname === "/api/collaboration-modes") {
      return {
        ok: true,
        json: async () => collaborationModesFixture
      } as Response;
    }

    if (pathname === "/api/models") {
      return {
        ok: true,
        json: async () => modelsFixture
      } as Response;
    }

    if (pathname === "/api/config/defaults") {
      return {
        ok: true,
        json: async () => configDefaultsFixture
      } as Response;
    }

    if (pathname === "/api/debug/trace/status") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          active: null,
          recent: []
        })
      } as Response;
    }

    if (pathname === "/api/debug/history") {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          history: []
        })
      } as Response;
    }

    if (pathname === "/api/debug/client-errors") {
      return {
        ok: true,
        json: async () => debugErrorsFixture
      } as Response;
    }

    if (pathname === "/api/agents") {
      return {
        ok: true,
        json: async () => agentsFixture
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({
        ok: true,
        threadId: "t",
        ownerClientId: null,
        conversationState: null,
        liveStateError: null,
        events: []
      })
    } as Response;
  })
);

describe("App", () => {
  it("renders core sections", async () => {
    render(<App />);
    expect((await screen.findAllByText("Farfield")).length).toBeGreaterThan(0);
    expect(await screen.findByText("No thread selected")).toBeTruthy();
  });

  it("shows client errors in the debug issues panel", async () => {
    debugErrorsFixture = {
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
    };

    render(<App />);
    fireEvent.click(await screen.findByTestId("tab-debug"));

    expect(await screen.findByTestId("debug-issues-panel")).toBeTruthy();
    expect((await screen.findAllByText("Invalid JSON response from /api/threads/thread-1/messages")).length).toBeGreaterThan(0);
    expect(await screen.findByText("session log")).toBeTruthy();
  });

  it("shows selected-thread loading state before thread hydrate completes", async () => {
    const threadId = "thread-loading";
    window.history.replaceState(null, "", `/threads/${threadId}`);

    threadsFixture = {
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
    };

    const conversationState = buildConversationStateFixture(threadId, "gpt-5.3-codex");
    conversationState.turns = [];
    readThreadResolver = (targetThreadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: {
        ...conversationState,
        id: targetThreadId
      },
      agentId: "codex"
    });
    readThreadDelayMs = 220;

    render(<App />);

    expect(await screen.findByTestId("chat-empty-loading-thread")).toBeTruthy();
    expect(screen.queryByTestId("chat-empty-no-messages")).toBeNull();

    await waitFor(() => {
      expect(screen.queryByTestId("chat-empty-loading-thread")).toBeNull();
    });

    expect(await screen.findByTestId("chat-empty-no-messages")).toBeTruthy();
  });

  it("hides mode controls when capability is disabled", async () => {
    agentsFixture = {
      ok: true,
      agents: [
        {
          id: "opencode",
          label: "OpenCode",
          enabled: true,
          connected: true,
          capabilities: opencodeCapabilities,
          projectDirectories: []
        }
      ],
      defaultAgentId: "opencode"
    };

    render(<App />);
    await screen.findAllByText("Farfield");
    expect(screen.queryByText("Plan")).toBeNull();
  });

  it("shows mode controls when capability is enabled", async () => {
    render(<App />);
    expect(await screen.findByText("Plan")).toBeTruthy();
  });

  it("authenticates api session before loading protected data", async () => {
    eventsSessionFixture = {
      authRequired: true,
      bootstrapped: false,
      expiresAt: null,
      acceptedApiToken: "token-123"
    };

    render(<App />);

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

  it("updates the picker when remote model changes with same updatedAt and turns", async () => {
    const threadId = "thread-1";
    let modelId = "gpt-old-codex";

    threadsFixture = {
      ok: true,
      data: [
        {
          id: threadId,
          preview: "thread preview",
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
    };

    modelsFixture = {
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
              description: "Balanced"
            }
          ],
          defaultReasoningEffort: "medium",
          inputModalities: ["text"],
          supportsPersonality: true,
          isDefault: false,
          hidden: false
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
              description: "Balanced"
            }
          ],
          defaultReasoningEffort: "medium",
          inputModalities: ["text"],
          supportsPersonality: true,
          isDefault: true,
          hidden: false
        }
      ],
      nextCursor: null
    };

    readThreadResolver = (targetThreadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: buildConversationStateFixture(targetThreadId, modelId),
      agentId: "codex"
    });

    liveStateResolver = (targetThreadId: string) => ({
      ok: true,
      threadId: targetThreadId,
      ownerClientId: "client-1",
      conversationState: buildConversationStateFixture(targetThreadId, modelId),
      liveStateError: null
    });

    render(<App />);
    expect(await screen.findByText("gpt-old-codex")).toBeTruthy();

    modelId = "gpt-new-codex";

    MockEventSource.emit({
      type: "history",
      entry: {
        source: "app",
        meta: {
          threadId
        }
      }
    });

    await waitFor(() => {
      expect(screen.queryByText("gpt-old-codex")).toBeNull();
    });

    expect(await screen.findByText("gpt-new-codex")).toBeTruthy();
  });

  it("keeps loaded turns when thread refresh skips turns payload", async () => {
    const threadId = "thread-preserve-turns";
    let includeTurnsFalseReadCount = 0;
    window.history.replaceState(null, "", `/threads/${threadId}`);

    threadsFixture = {
      ok: true,
      data: [
        {
          id: threadId,
          preview: "thread preserve turns",
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
    };

    readThreadResolver = (targetThreadId: string, includeTurns: boolean) => {
      const fullState = buildConversationStateFixture(targetThreadId, "gpt-5.3-codex");
      if (!includeTurns) {
        includeTurnsFalseReadCount += 1;
        return {
          ok: true,
          thread: {
            ...fullState,
            updatedAt: fullState.updatedAt + 1,
            turns: []
          },
          agentId: "codex"
        };
      }
      return {
        ok: true,
        thread: fullState,
        agentId: "codex"
      };
    };

    render(<App />);

    await waitFor(() => {
      expect(
        document.querySelector(`[data-testid="thread-list-item"][data-thread-id="${threadId}"]`)
      ).toBeTruthy();
    });
    expect(screen.queryByTestId("chat-empty-no-messages")).toBeNull();

    MockEventSource.emit({
      type: "history",
      entry: {
        source: "app",
        meta: {
          threadId
        }
      }
    });

    await waitFor(() => {
      expect(includeTurnsFalseReadCount).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId("chat-empty-no-messages")).toBeNull();
  });

  it("opens mobile sidebar with a left-edge swipe gesture", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      value: 390,
      configurable: true,
      writable: true
    });

    try {
      render(<App />);
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

  it("does not auto-select another thread after selection is cleared", async () => {
    const selectedThreadId = "thread-selected";
    const otherThreadId = "thread-other";
    window.history.replaceState(null, "", `/threads/${selectedThreadId}`);

    threadsFixture = {
      ok: true,
      data: [
        {
          id: selectedThreadId,
          preview: "selected thread",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex"
        },
        {
          id: otherThreadId,
          preview: "other thread",
          createdAt: 1700000001,
          updatedAt: 1700000001,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex"
        }
      ],
      nextCursor: null,
      pages: 1,
      truncated: false
    };

    readThreadResolver = (threadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: buildConversationStateFixture(threadId, "gpt-5.3-codex"),
      agentId: "codex"
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/threads/${selectedThreadId}`);
    });

    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
    expect(await screen.findByText("No thread selected")).toBeTruthy();

    MockEventSource.emit({
      type: "history",
      entry: {
        source: "app",
        meta: {
          threadId: otherThreadId
        }
      }
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
    expect(screen.getByText("No thread selected")).toBeTruthy();
  });

  it("shows unread marker for a newly updated thread and clears it when opened", async () => {
    const selectedId = "thread-1";
    const updatedId = "thread-2";
    window.history.replaceState(null, "", `/threads/${selectedId}`);

    threadsFixture = {
      ok: true,
      data: [
        {
          id: selectedId,
          preview: "selected thread",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex"
        },
        {
          id: updatedId,
          preview: "updated thread",
          createdAt: 1700000001,
          updatedAt: 1700000000,
          cwd: "/tmp/project",
          source: "opencode",
          agentId: "codex"
        }
      ],
      nextCursor: null,
      pages: 1,
      truncated: false
    };

    readThreadResolver = (threadId: string, _includeTurns: boolean) => ({
      ok: true,
      thread: buildConversationStateFixture(threadId, "gpt-5.3-codex"),
      agentId: "codex"
    });

    render(<App />);
    await waitFor(() => {
      expect(
        document.querySelector(`[data-testid="thread-list-item"][data-thread-id="${selectedId}"]`)
      ).toBeTruthy();
    });
    expect(screen.queryByTestId(`thread-unread-indicator-${updatedId}`)).toBeNull();

    threadsFixture = {
      ...threadsFixture,
      data: threadsFixture.data.map((thread) =>
        thread.id === updatedId
          ? {
            ...thread,
            updatedAt: 1700000050
          }
          : thread
      )
    };

    MockEventSource.emit({
      type: "history",
      entry: {
        source: "app",
        meta: {
          threadId: updatedId
        }
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId(`thread-unread-indicator-${updatedId}`)).toBeTruthy();
    });

    const updatedThreadButton = document.querySelector(
      `[data-testid="thread-list-item"][data-thread-id="${updatedId}"]`
    );
    if (!updatedThreadButton) {
      throw new Error("Expected updated thread button to exist");
    }
    fireEvent.click(updatedThreadButton);

    await waitFor(() => {
      expect(screen.queryByTestId(`thread-unread-indicator-${updatedId}`)).toBeNull();
    });
  });
});
