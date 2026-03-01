import { cleanup, render, waitFor } from "@testing-library/react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type EventRefreshFlags,
  EventRefreshScheduler,
} from "../Source/Application/StateManagement/EventRefreshScheduler";
import {
  EventStreamConnectionCoordinator,
  type EventStreamConnectionCoordinatorStartInput,
} from "../Source/Application/StateManagement/EventStreamConnectionCoordinator";
import { EventStreamRefreshDecisionEngine } from "../Source/Application/StateManagement/EventStreamRefreshDecisionEngine";
import {
  type UseEventStreamEffectsInput,
  useEventStreamEffects,
} from "../Source/Application/StateManagement/UseEventStreamEffects";
import {
  type CapabilityAccountRateLimitsResponse,
  type CapabilityAccountResponse,
  type CapabilityAppsResponse,
  type CapabilityNotificationEventsResponse,
  CapabilityServerClient,
} from "../Source/Features/Capabilities/DataAccess/CapabilityServerClient";
import {
  type DebugErrorListResponse,
  type DebugHistoryResponse,
  DebugServerClient,
} from "../Source/Features/Debugging/DataAccess/DebugServerClient";
import { buildDebugErrorSignature } from "../Source/Features/Debugging/DomainModel/DebugErrorSignature";
import {
  DebugWorkspaceDataReader,
  type DebugWorkspaceDataSnapshot,
} from "../Source/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import {
  type ThreadRuntimeStatusByThreadIdentifier,
  type ThreadSidebarRuntimeSummary,
} from "../Source/Features/Threads/DomainModel/ThreadRuntimeStatusContracts";
import { RequestCanceledError } from "../Source/Shared/Errors/RequestCanceledError";

type DebugErrors = DebugErrorListResponse["data"];
type DebugHistory = DebugHistoryResponse["history"];

const DEBUG_HISTORY_LIMIT = 50;
const DEBUG_ERROR_LIST_LIMIT = 75;
const IMMEDIATE_EVENT_REFRESH_DELAY_MILLISECONDS = 0;

const CORE_AND_SELECTED_THREAD_REFRESH_FLAGS: EventRefreshFlags = {
  refreshCore: true,
  refreshHistory: false,
  refreshSelectedThread: true,
  refreshNotificationProjections: false,
};
const SELECTED_THREAD_ONLY_REFRESH_FLAGS: EventRefreshFlags = {
  refreshCore: false,
  refreshHistory: false,
  refreshSelectedThread: true,
  refreshNotificationProjections: false,
};
const DEBUG_HISTORY_ONLY_REFRESH_FLAGS: EventRefreshFlags = {
  refreshCore: false,
  refreshHistory: true,
  refreshSelectedThread: false,
  refreshNotificationProjections: false,
};
const CORE_ONLY_REFRESH_FLAGS: EventRefreshFlags = {
  refreshCore: true,
  refreshHistory: false,
  refreshSelectedThread: false,
  refreshNotificationProjections: false,
};
const CORE_AND_HISTORY_REFRESH_FLAGS: EventRefreshFlags = {
  refreshCore: true,
  refreshHistory: true,
  refreshSelectedThread: false,
  refreshNotificationProjections: false,
};
const NOTIFICATION_PROJECTION_ONLY_REFRESH_FLAGS: EventRefreshFlags = {
  refreshCore: false,
  refreshHistory: false,
  refreshSelectedThread: false,
  refreshNotificationProjections: true,
};

interface HarnessProperties {
  input: UseEventStreamEffectsInput;
}

class TestEventStreamConnectionCoordinator extends EventStreamConnectionCoordinator {
  public startInput: EventStreamConnectionCoordinatorStartInput | null = null;
  public stopCallCount = 0;

  public constructor() {
    super({
      createEventSource: () => ({
        onopen: null,
        onmessage: null,
        onerror: null,
        close: () => {},
      }),
    });
  }

  public override start(input: EventStreamConnectionCoordinatorStartInput): void {
    this.startInput = input;
  }

  public override stop(): void {
    this.stopCallCount += 1;
  }
}

class TestDebugWorkspaceDataReader extends DebugWorkspaceDataReader {
  public readSnapshotCallCount = 0;
  private readonly snapshot: DebugWorkspaceDataSnapshot;

  public constructor(snapshot: DebugWorkspaceDataSnapshot) {
    super(new DebugServerClient());
    this.snapshot = snapshot;
  }

  public override async readSnapshot(
    _historyLimit: number,
    _errorListLimit: number,
  ): Promise<DebugWorkspaceDataSnapshot> {
    this.readSnapshotCallCount += 1;
    return this.snapshot;
  }
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  useEventStreamEffects(properties.input);
  return <div data-testid="event-stream-effects-harness" />;
}

function createDispatchSpy<ValueType>(): Dispatch<SetStateAction<ValueType>> {
  return vi.fn();
}

function createDebugSnapshot(): DebugWorkspaceDataSnapshot {
  const history: DebugHistory = [
    {
      id: "history-1",
      at: "2026-02-26T00:00:00.000Z",
      source: "app",
      direction: "in",
      payload: { type: "history" },
      meta: {},
    },
  ];
  const debugErrors: DebugErrors = [
    {
      errorId: "error-1",
      sessionId: "session-1",
      origin: "client",
      source: "farfield-web",
      operation: "refresh-history",
      message: "debug-error",
      severity: "error",
      name: null,
      stack: null,
      requestId: null,
      threadId: null,
      url: null,
      occurredAt: "2026-02-26T00:00:01.000Z",
      recordedAt: "2026-02-26T00:00:02.000Z",
      details: {},
    },
  ];

  return {
    history,
    debugErrors,
    debugErrorSessionId: "session-1",
    debugErrorSessionLogPath: "/tmp/session-1.ndjson",
    debugErrorsSignature: [
      buildDebugErrorSignature({
        errorId: "error-1",
        recordedAt: "2026-02-26T00:00:02.000Z",
        message: "debug-error",
      }),
    ],
  };
}

function createNotificationEventsResponse(): CapabilityNotificationEventsResponse {
  return {
    ok: true,
    events: [
      {
        sequence: 41,
        method: "thread/status/changed",
        params: {
          threadId: "thread-1",
          status: {
            type: "active",
            activeFlags: ["waitingOnApproval"],
          },
        },
        receivedAtMilliseconds: 2_001,
      },
    ],
    nextSequence: 42,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
}

function createAccountAndAppNotificationEventsResponse(): CapabilityNotificationEventsResponse {
  return {
    ok: true,
    events: [
      {
        sequence: 51,
        method: "account/updated",
        params: {
          authMode: "chatgpt",
        },
        receivedAtMilliseconds: 2_005,
      },
      {
        sequence: 52,
        method: "account/rateLimits/updated",
        params: {
          rateLimits: {
            limitId: "codex",
            planType: "pro",
          },
        },
        receivedAtMilliseconds: 2_010,
      },
      {
        sequence: 53,
        method: "app/list/updated",
        params: {
          data: [],
        },
        receivedAtMilliseconds: 2_020,
      },
    ],
    nextSequence: 54,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
}

function createThreadProgressWarningErrorTokenUsageAndModelRerouteNotificationEventsResponse(): CapabilityNotificationEventsResponse {
  return {
    ok: true,
    events: [
      {
        sequence: 60,
        method: "thread/started",
        params: {
          thread: {
            id: "thread-1",
            preview: "Thread one",
            modelProvider: "openai",
          },
        },
        receivedAtMilliseconds: 2_029,
      },
      {
        sequence: 61,
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          tokenUsage: {
            total: {
              totalTokens: 42_000,
              inputTokens: 20_000,
              cachedInputTokens: 1_000,
              outputTokens: 22_000,
              reasoningOutputTokens: 8_000,
            },
            last: {
              totalTokens: 5_000,
              inputTokens: 2_000,
              cachedInputTokens: 300,
              outputTokens: 3_000,
              reasoningOutputTokens: 1_000,
            },
            modelContextWindow: 200_000,
          },
        },
        receivedAtMilliseconds: 2_030,
      },
      {
        sequence: 62,
        method: "model/rerouted",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          fromModel: "gpt-5",
          toModel: "gpt-5-safe",
          reason: "highRiskCyberActivity",
        },
        receivedAtMilliseconds: 2_031,
      },
      {
        sequence: 63,
        method: "thread/compacted",
        params: {
          threadId: "thread-1",
          turnId: "turn-2",
        },
        receivedAtMilliseconds: 2_032,
      },
      {
        sequence: 64,
        method: "configWarning",
        params: {
          summary: "Config file has an unknown key",
          details: null,
        },
        receivedAtMilliseconds: 2_033,
      },
      {
        sequence: 65,
        method: "error",
        params: {
          error: {
            message: "Turn failed to stream",
          },
          willRetry: true,
          threadId: "thread-1",
          turnId: "turn-2",
        },
        receivedAtMilliseconds: 2_034,
      },
    ],
    nextSequence: 66,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
}

function createAccountResponse(): CapabilityAccountResponse {
  return {
    ok: true,
    account: {
      type: "chatgpt",
      email: "dev@example.com",
      planType: "pro",
    },
    requiresOpenaiAuth: false,
  };
}

function createAccountRateLimitsResponse(): CapabilityAccountRateLimitsResponse {
  return {
    ok: true,
    rateLimits: {
      credits: null,
      limitId: "codex",
      limitName: "Codex",
      planType: "pro",
      primary: {
        resetsAt: 1_700_000_000,
        usedPercent: 42,
        windowDurationMins: 60,
      },
      secondary: null,
    },
    rateLimitsByLimitId: null,
  };
}

function createAppsResponse(): CapabilityAppsResponse {
  return {
    ok: true,
    data: [
      {
        id: "app-1",
        name: "GitHub",
        description: null,
        logoUrl: null,
        logoUrlDark: null,
        installUrl: null,
        isAccessible: true,
        isEnabled: true,
      },
      {
        id: "app-2",
        name: "Linear",
        description: null,
        logoUrl: null,
        logoUrlDark: null,
        installUrl: null,
        isAccessible: true,
        isEnabled: false,
      },
    ],
    nextCursor: null,
  };
}

function createBaseInput(
  eventStreamConnectionCoordinator: TestEventStreamConnectionCoordinator,
  debugWorkspaceDataReader: TestDebugWorkspaceDataReader,
): UseEventStreamEffectsInput {
  const loadCoreDataTracked = vi.fn(async (): Promise<void> => {});
  const loadSelectedThread = vi.fn(async (_threadId: string): Promise<void> => {});
  const capabilityServerClient = new CapabilityServerClient();

  return {
    debugHistoryLimit: DEBUG_HISTORY_LIMIT,
    debugErrorListLimit: DEBUG_ERROR_LIST_LIMIT,
    ensureApiSessionBootstrapped: vi.fn(async () => true),
    eventRefreshScheduler: new EventRefreshScheduler(IMMEDIATE_EVENT_REFRESH_DELAY_MILLISECONDS),
    eventStreamConnectionCoordinator,
    eventStreamRefreshDecisionEngine: new EventStreamRefreshDecisionEngine(["history"]),
    activeTabRef: { current: "chat" },
    selectedThreadIdRef: { current: "thread-1" },
    loadCoreDataTrackedRef: { current: loadCoreDataTracked },
    loadSelectedThreadRef: {
      current: loadSelectedThread,
    },
    debugWorkspaceDataReader,
    debugWorkspaceStateStore: new DebugWorkspaceStateStore(),
    debugErrorsSignatureRef: { current: [] },
    eventsConnectedRef: { current: false },
    capabilityServerClient,
    selectedAgentId: "codex",
    canReadNotificationEvents: false,
    canReadAccount: false,
    canReadAccountRateLimits: false,
    canListApps: false,
    setThreadRuntimeStatusByThreadIdentifier:
      createDispatchSpy<ThreadRuntimeStatusByThreadIdentifier>(),
    setThreadSidebarRuntimeSummary: createDispatchSpy<ThreadSidebarRuntimeSummary>(),
    setHistory: createDispatchSpy<DebugHistory>(),
    setDebugErrors: createDispatchSpy<DebugErrors>(),
    setDebugErrorSessionId: createDispatchSpy<string>(),
    setDebugErrorSessionLogPath: createDispatchSpy<string>(),
    applySelectedThreadStreamDelta: vi.fn(),
    handleRuntimeRequestError: vi.fn(),
  };
}

async function readStartInputOrThrow(
  eventStreamConnectionCoordinator: TestEventStreamConnectionCoordinator,
): Promise<EventStreamConnectionCoordinatorStartInput> {
  await waitFor(() => {
    expect(eventStreamConnectionCoordinator.startInput).not.toBeNull();
  });
  if (!eventStreamConnectionCoordinator.startInput) {
    throw new Error("Expected event-stream start input");
  }
  return eventStreamConnectionCoordinator.startInput;
}

interface SelectedThreadReadCountRefResult {
  selectedThreadIdRef: MutableRefObject<string | null>;
  selectedThreadIdReadCountRef: MutableRefObject<number>;
}

function createSelectedThreadReadCountRef(
  initialSelectedThreadId: string,
  nextSelectedThreadId: string,
): SelectedThreadReadCountRefResult {
  let selectedThreadIdValue: string | null = initialSelectedThreadId;
  const selectedThreadIdReadCountRef: MutableRefObject<number> = { current: 0 };
  const selectedThreadIdRef: MutableRefObject<string | null> = {
    get current(): string | null {
      selectedThreadIdReadCountRef.current += 1;
      if (selectedThreadIdReadCountRef.current === 1) {
        return selectedThreadIdValue;
      }
      return nextSelectedThreadId;
    },
    set current(nextSelectedThreadIdValue: string | null) {
      selectedThreadIdValue = nextSelectedThreadIdValue;
    },
  };

  return {
    selectedThreadIdRef,
    selectedThreadIdReadCountRef,
  };
}

const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "visibilityState",
);

function setDocumentVisibilityState(nextVisibilityState: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => nextVisibilityState,
  });
}

describe("useEventStreamEffects", () => {
  afterEach(() => {
    cleanup();
    if (originalVisibilityStateDescriptor) {
      Object.defineProperty(document, "visibilityState", originalVisibilityStateDescriptor);
    }
  });

  it("wires lifecycle start/stop through the event-stream connection coordinator", async () => {
    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );

    const { unmount } = render(<Harness input={input} />);

    await readStartInputOrThrow(eventStreamConnectionCoordinator);
    unmount();
    expect(eventStreamConnectionCoordinator.stopCallCount).toBe(1);
  });

  it("skips scheduled refresh work while the document is hidden", async () => {
    setDocumentVisibilityState("hidden");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(CORE_AND_SELECTED_THREAD_REFRESH_FLAGS);

    expect(input.loadCoreDataTrackedRef.current).not.toHaveBeenCalled();
    expect(input.loadSelectedThreadRef.current).not.toHaveBeenCalled();
  });

  it("uses deterministic selected-thread incremental refresh options", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(SELECTED_THREAD_ONLY_REFRESH_FLAGS);

    expect(input.loadSelectedThreadRef.current).toHaveBeenCalledTimes(1);
    expect(input.loadSelectedThreadRef.current).toHaveBeenCalledWith("thread-1", {
      includeReadThread: true,
      includeTurns: false,
    });
  });

  it("reads selected-thread identifier once per scheduled refresh execution", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    const selectedThreadReadCountRefResult = createSelectedThreadReadCountRef(
      "thread-1",
      "thread-2",
    );
    input.selectedThreadIdRef = selectedThreadReadCountRefResult.selectedThreadIdRef;
    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(SELECTED_THREAD_ONLY_REFRESH_FLAGS);

    expect(selectedThreadReadCountRefResult.selectedThreadIdReadCountRef.current).toBe(1);
    expect(input.loadSelectedThreadRef.current).toHaveBeenCalledWith("thread-1", {
      includeReadThread: true,
      includeTurns: false,
    });
  });

  it("routes debug history refresh through debug workspace state ownership", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const debugWorkspaceDataReader = new TestDebugWorkspaceDataReader(createDebugSnapshot());
    const input = createBaseInput(eventStreamConnectionCoordinator, debugWorkspaceDataReader);
    input.activeTabRef.current = "debug";
    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(DEBUG_HISTORY_ONLY_REFRESH_FLAGS);

    expect(debugWorkspaceDataReader.readSnapshotCallCount).toBe(1);
    expect(input.setHistory).toHaveBeenCalledTimes(1);
    expect(input.setDebugErrors).toHaveBeenCalledTimes(1);
    expect(input.setDebugErrorSessionId).toHaveBeenCalledWith("session-1");
    expect(input.setDebugErrorSessionLogPath).toHaveBeenCalledWith("/tmp/session-1.ndjson");
    expect(input.debugErrorsSignatureRef.current).toEqual([
      buildDebugErrorSignature({
        errorId: "error-1",
        recordedAt: "2026-02-26T00:00:02.000Z",
        message: "debug-error",
      }),
    ]);
  });

  it("prioritizes core refresh when core and debug-history refresh are both scheduled", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const debugWorkspaceDataReader = new TestDebugWorkspaceDataReader(createDebugSnapshot());
    const input = createBaseInput(eventStreamConnectionCoordinator, debugWorkspaceDataReader);
    input.activeTabRef.current = "debug";
    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(CORE_AND_HISTORY_REFRESH_FLAGS);

    expect(input.loadCoreDataTrackedRef.current).toHaveBeenCalledTimes(1);
    expect(debugWorkspaceDataReader.readSnapshotCallCount).toBe(0);
  });

  it("projects thread runtime status updates from notification-event reads", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    input.canReadNotificationEvents = true;
    const setThreadRuntimeStatusByThreadIdentifier = vi.fn(
      (_nextValue: SetStateAction<ThreadRuntimeStatusByThreadIdentifier>): void => {},
    );
    input.setThreadRuntimeStatusByThreadIdentifier = setThreadRuntimeStatusByThreadIdentifier;
    const readNotificationEvents = vi
      .spyOn(input.capabilityServerClient, "readNotificationEvents")
      .mockResolvedValue(createNotificationEventsResponse());

    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(NOTIFICATION_PROJECTION_ONLY_REFRESH_FLAGS);

    expect(readNotificationEvents).toHaveBeenCalledWith({
      agentId: "codex",
      limit: 80,
      sinceSequence: null,
    });

    const updateStateAction = setThreadRuntimeStatusByThreadIdentifier.mock.calls
      .map((call) => call[0])
      .find(
        (
          action,
        ): action is (
          previousValue: ThreadRuntimeStatusByThreadIdentifier,
        ) => ThreadRuntimeStatusByThreadIdentifier => typeof action === "function",
      );
    if (updateStateAction === undefined) {
      throw new Error("Expected a thread-runtime-status update state action");
    }

    expect(updateStateAction({})).toEqual({
      "thread-1": {
        sequence: 41,
        statusType: "active",
        activeFlags: ["waitingOnApproval"],
        receivedAtMilliseconds: 2_001,
      },
    });
  });

  it("projects account rate-limit and app summary refreshes from notification-event reads", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    input.canReadNotificationEvents = true;
    input.canReadAccount = true;
    input.canReadAccountRateLimits = true;
    input.canListApps = true;
    const setThreadSidebarRuntimeSummary = vi.fn(
      (_nextValue: SetStateAction<ThreadSidebarRuntimeSummary>): void => {},
    );
    input.setThreadSidebarRuntimeSummary = setThreadSidebarRuntimeSummary;
    const readNotificationEvents = vi
      .spyOn(input.capabilityServerClient, "readNotificationEvents")
      .mockResolvedValue(createAccountAndAppNotificationEventsResponse());
    const readAccountRateLimits = vi
      .spyOn(input.capabilityServerClient, "readAccountRateLimits")
      .mockResolvedValue(createAccountRateLimitsResponse());
    const readAccount = vi
      .spyOn(input.capabilityServerClient, "readAccount")
      .mockResolvedValue(createAccountResponse());
    const listApps = vi
      .spyOn(input.capabilityServerClient, "listApps")
      .mockResolvedValue(createAppsResponse());

    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(NOTIFICATION_PROJECTION_ONLY_REFRESH_FLAGS);

    expect(readNotificationEvents).toHaveBeenCalledWith({
      agentId: "codex",
      limit: 80,
      sinceSequence: null,
    });
    expect(readAccount).toHaveBeenCalledWith({
      agentId: "codex",
    });
    expect(readAccountRateLimits).toHaveBeenCalledWith({
      agentId: "codex",
    });
    expect(listApps).toHaveBeenCalledWith({
      limit: 100,
    });
    expect(setThreadSidebarRuntimeSummary).toHaveBeenCalled();
  });

  it("projects selected-thread progress/warning-error token-usage and model-reroute summaries", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    input.canReadNotificationEvents = true;
    const setThreadSidebarRuntimeSummary = vi.fn(
      (_nextValue: SetStateAction<ThreadSidebarRuntimeSummary>): void => {},
    );
    input.setThreadSidebarRuntimeSummary = setThreadSidebarRuntimeSummary;
    vi.spyOn(input.capabilityServerClient, "readNotificationEvents").mockResolvedValue(
      createThreadProgressWarningErrorTokenUsageAndModelRerouteNotificationEventsResponse(),
    );

    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(NOTIFICATION_PROJECTION_ONLY_REFRESH_FLAGS);

    const updateStateAction = setThreadSidebarRuntimeSummary.mock.calls
      .map((call) => call[0])
      .find(
        (
          action,
        ): action is (previousValue: ThreadSidebarRuntimeSummary) => ThreadSidebarRuntimeSummary =>
          typeof action === "function",
      );

    if (updateStateAction === undefined) {
      throw new Error("Expected sidebar runtime summary update state action");
    }

    expect(
      updateStateAction({
        account: null,
        rateLimits: null,
        apps: null,
        progress: null,
        warning: null,
        tokenUsage: null,
        modelReroute: null,
      }),
    ).toEqual({
      account: null,
      rateLimits: null,
      apps: null,
      progress: {
        method: "thread/compacted",
        threadId: "thread-1",
        turnId: "turn-2",
        preview: null,
        modelProvider: null,
        sequence: 63,
        receivedAtMilliseconds: 2_032,
        refreshedAtMilliseconds: expect.any(Number),
      },
      warning: {
        method: "error",
        summary: "Turn failed to stream",
        threadId: "thread-1",
        isRetrying: true,
        sequence: 65,
        receivedAtMilliseconds: 2_034,
        refreshedAtMilliseconds: expect.any(Number),
      },
      tokenUsage: {
        threadId: "thread-1",
        turnId: "turn-1",
        totalTokens: 42_000,
        lastTotalTokens: 5_000,
        modelContextWindow: 200_000,
        usedPercent: 21,
        sequence: 61,
        receivedAtMilliseconds: 2_030,
        refreshedAtMilliseconds: expect.any(Number),
      },
      modelReroute: {
        threadId: "thread-1",
        turnId: "turn-1",
        fromModel: "gpt-5",
        toModel: "gpt-5-safe",
        reason: "highRiskCyberActivity",
        sequence: 62,
        receivedAtMilliseconds: 2_031,
        refreshedAtMilliseconds: expect.any(Number),
      },
    });
  });

  it("hydrates sidebar runtime summary on mount when capability reads are enabled", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    input.canReadAccount = true;
    input.canReadAccountRateLimits = true;
    input.canListApps = true;
    const readAccount = vi
      .spyOn(input.capabilityServerClient, "readAccount")
      .mockResolvedValue(createAccountResponse());
    const readAccountRateLimits = vi
      .spyOn(input.capabilityServerClient, "readAccountRateLimits")
      .mockResolvedValue(createAccountRateLimitsResponse());
    const listApps = vi
      .spyOn(input.capabilityServerClient, "listApps")
      .mockResolvedValue(createAppsResponse());

    render(<Harness input={input} />);

    await waitFor(() => {
      expect(readAccount).toHaveBeenCalledTimes(1);
      expect(readAccountRateLimits).toHaveBeenCalledTimes(1);
      expect(listApps).toHaveBeenCalledTimes(1);
    });

    expect(readAccount).toHaveBeenCalledWith({
      agentId: "codex",
    });
    expect(readAccountRateLimits).toHaveBeenCalledWith({
      agentId: "codex",
    });
    expect(listApps).toHaveBeenCalledWith({
      limit: 100,
    });
  });

  it("suppresses canceled-request errors from runtime error reporting", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    input.loadCoreDataTrackedRef.current = vi.fn(async (): Promise<void> => {
      throw new RequestCanceledError("/api/threads");
    });
    render(<Harness input={input} />);

    const startInput = await readStartInputOrThrow(eventStreamConnectionCoordinator);
    await startInput.executeScheduledRefresh(CORE_ONLY_REFRESH_FLAGS);

    expect(input.handleRuntimeRequestError).not.toHaveBeenCalled();
  });

  it("delays event-stream startup when API session bootstrap does not report readiness", async () => {
    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot()),
    );
    input.ensureApiSessionBootstrapped = vi.fn(async () => false);

    render(<Harness input={input} />);

    await waitFor(() => {
      expect(input.ensureApiSessionBootstrapped).toHaveBeenCalledTimes(1);
    });

    expect(eventStreamConnectionCoordinator.startInput).toBeNull();
    expect(input.handleRuntimeRequestError).not.toHaveBeenCalled();
  });
});
