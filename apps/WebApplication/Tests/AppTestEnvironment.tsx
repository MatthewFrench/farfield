import {
  cleanup,
  render
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  vi
} from "vitest";
import { z } from "zod";
import { App } from "../Source/App";
import {
  buildConversationStateFixture,
  CODEX_CAPABILITIES,
  OPENCODE_CAPABILITIES,
  type AgentsFixture,
  type AppTestEnvironment,
  type CollaborationModesFixture,
  type ConfigDefaultsFixture,
  type DebugErrorsFixture,
  type EventsSessionFixture,
  type LiveStateResolver,
  type ModelsFixture,
  type ReadThreadResolver,
  type ThreadListFixture
} from "./AppTestFixtureContracts";
import { type StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";

/**
 * Shared app-shell test runtime owner.
 * Provides deterministic fixture routing and stream-event emission for shell tests.
 */
type StructuredDataObject = { [key: string]: StructuredDataValue };

const HISTORY_EVENT_TIMESTAMP_BASE_MILLISECONDS = Date.parse("2026-02-26T00:00:00.000Z");

function buildHistoryEventTimestampIso(sequence: number): string {
  return new Date(HISTORY_EVENT_TIMESTAMP_BASE_MILLISECONDS + sequence * 1_000).toISOString();
}

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

  public static emit(payload: StructuredDataObject): void {
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

const EventsSessionBootstrapRequestSchema = z
  .object({
    apiToken: z.string().trim().min(1)
  })
  .strict();

const localStorageState = new Map<string, string>();
let eventStreamSequence = 0;

let agentsFixture: AgentsFixture;
let threadsFixture: ThreadListFixture;
let collaborationModesFixture: CollaborationModesFixture;
let modelsFixture: ModelsFixture;
let debugErrorsFixture: DebugErrorsFixture;
let configDefaultsFixture: ConfigDefaultsFixture;
let readThreadResolver: ReadThreadResolver;
let liveStateResolver: LiveStateResolver;
let readThreadDelayMilliseconds = 0;
let eventsSessionFixture: EventsSessionFixture;

let globalsInstalled = false;

function createJsonResponse<TResponseBody>(responseBody: TResponseBody): Response {
  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function resetFixtures(): void {
  window.history.replaceState(null, "", "/");
  MockEventSource.reset();
  localStorageState.clear();
  eventStreamSequence = 0;

  agentsFixture = {
    ok: true,
    agents: [
      {
        id: "codex",
        label: "Codex",
        enabled: true,
        connected: true,
        capabilities: CODEX_CAPABILITIES,
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
  readThreadDelayMilliseconds = 0;
  eventsSessionFixture = {
    authRequired: false,
    bootstrapped: true,
    expiresAt: "2099-01-01T00:00:00.000Z",
    acceptedApiToken: "test-api-token"
  };
}

function installGlobals(): void {
  if (globalsInstalled) {
    return;
  }

  vi.stubGlobal("EventSource", MockEventSource);

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

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const parsedUrl = new URL(url, "http://localhost");
      const pathname = parsedUrl.pathname;
      const segments = pathname.split("/").filter((segment) => segment.length > 0);
      const threadId = segments[2] !== undefined ? decodeURIComponent(segments[2]) : "";

      if (pathname === "/api/events/session") {
        const maybeJsonBody = init?.body;
        if (typeof maybeJsonBody === "string") {
          const parsedBody = EventsSessionBootstrapRequestSchema.parse(JSON.parse(maybeJsonBody));
          if (parsedBody.apiToken === eventsSessionFixture.acceptedApiToken) {
            eventsSessionFixture.bootstrapped = true;
            eventsSessionFixture.expiresAt = "2099-01-01T00:00:00.000Z";
          }
        }
        return createJsonResponse({
          ok: true,
          authRequired: eventsSessionFixture.authRequired,
          bootstrapped: eventsSessionFixture.bootstrapped,
          expiresAt: eventsSessionFixture.bootstrapped ? eventsSessionFixture.expiresAt : null
        });
      }

      if (pathname === "/api/health") {
        return createJsonResponse({
          ok: true,
          state: {
            appReady: true,
            ipcConnected: true,
            ipcInitialized: true,
            lastError: null,
            historyCount: 0,
            threadOwnerCount: 0
          }
        });
      }

      if (pathname.startsWith("/api/threads/") && pathname.endsWith("/live-state")) {
        return createJsonResponse(liveStateResolver(threadId));
      }

      if (pathname.startsWith("/api/threads/") && pathname.endsWith("/stream-events")) {
        return createJsonResponse({
          ok: true,
          threadId,
          ownerClientId: null,
          events: [],
          nextSequence: 0,
          firstAvailableSequence: 0,
          resetRequired: false
        });
      }

      if (pathname.startsWith("/api/threads/") && parsedUrl.searchParams.has("includeTurns")) {
        const includeTurns = parsedUrl.searchParams.get("includeTurns") === "true";
        const readThread = await Promise.resolve(readThreadResolver(threadId, includeTurns));
        if (readThread) {
          if (readThreadDelayMilliseconds > 0) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, readThreadDelayMilliseconds);
            });
          }
          return createJsonResponse(readThread);
        }
      }

      if (pathname === "/api/threads") {
        return createJsonResponse(threadsFixture);
      }

      if (pathname === "/api/collaboration-modes") {
        return createJsonResponse(collaborationModesFixture);
      }

      if (pathname === "/api/models") {
        return createJsonResponse(modelsFixture);
      }

      if (pathname === "/api/config/defaults") {
        return createJsonResponse(configDefaultsFixture);
      }

      if (pathname === "/api/debug/trace/status") {
        return createJsonResponse({
          ok: true,
          active: null,
          recent: []
        });
      }

      if (pathname === "/api/debug/history") {
        return createJsonResponse({
          ok: true,
          history: []
        });
      }

      if (pathname === "/api/debug/client-errors") {
        if (init?.method === "POST") {
          return createJsonResponse({
            ok: true,
            errorId: "error_test_created",
            sessionId: debugErrorsFixture.sessionId,
            recordedAt: "2026-02-26T00:00:00.000Z"
          });
        }
        if (init?.method === "DELETE") {
          const clearedCount = debugErrorsFixture.data.length;
          debugErrorsFixture = {
            ...debugErrorsFixture,
            data: []
          };
          return createJsonResponse({
            ok: true,
            clearedCount,
            sessionId: debugErrorsFixture.sessionId,
            sessionLogPath: debugErrorsFixture.sessionLogPath
          });
        }
        return createJsonResponse(debugErrorsFixture);
      }

      if (pathname === "/api/agents") {
        return createJsonResponse(agentsFixture);
      }

      return createJsonResponse({
        ok: true,
        threadId: "t",
        ownerClientId: null,
        conversationState: null,
        liveStateError: null,
        events: []
      });
    })
  );

  globalsInstalled = true;
}

export function registerAppTestEnvironment(): AppTestEnvironment {
  installGlobals();

  beforeEach(() => {
    resetFixtures();
  });

  afterEach(() => {
    cleanup();
  });

  return {
    renderApp: () => {
      render(<App />);
    },
    setPathname: (pathname: string) => {
      window.history.replaceState(null, "", pathname);
    },
    setAgentsFixture: (fixture: AgentsFixture) => {
      agentsFixture = fixture;
    },
    setThreadsFixture: (fixture: ThreadListFixture) => {
      threadsFixture = fixture;
    },
    setCollaborationModesFixture: (fixture: CollaborationModesFixture) => {
      collaborationModesFixture = fixture;
    },
    setModelsFixture: (fixture: ModelsFixture) => {
      modelsFixture = fixture;
    },
    setDebugErrorsFixture: (fixture: DebugErrorsFixture) => {
      debugErrorsFixture = fixture;
    },
    setConfigDefaultsFixture: (fixture: ConfigDefaultsFixture) => {
      configDefaultsFixture = fixture;
    },
    setReadThreadResolver: (resolver: ReadThreadResolver) => {
      readThreadResolver = resolver;
    },
    setLiveStateResolver: (resolver: LiveStateResolver) => {
      liveStateResolver = resolver;
    },
    setReadThreadDelayMilliseconds: (milliseconds: number) => {
      readThreadDelayMilliseconds = milliseconds;
    },
    setEventsSessionFixture: (fixture: EventsSessionFixture) => {
      eventsSessionFixture = fixture;
    },
    emitHistoryEventForThread: (threadId: string) => {
      eventStreamSequence += 1;
      MockEventSource.emit({
        sequence: eventStreamSequence,
        event: {
          type: "activity-history-appended",
          entry: {
            id: `history-${String(eventStreamSequence)}`,
            at: buildHistoryEventTimestampIso(eventStreamSequence),
            source: "app",
            direction: "out",
            payload: {
              ok: true
            },
            meta: {
              threadId,
              method: "messages.send"
            }
          }
        }
      });
    },
    buildConversationStateFixture
  };
}

export { OPENCODE_CAPABILITIES, CODEX_CAPABILITIES };
