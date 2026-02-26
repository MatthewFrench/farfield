import { cleanup, render } from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import type {
  Dispatch,
  SetStateAction
} from "react";
import {
  RequestCanceledError
} from "../Source/Shared/Errors/RequestCanceledError";
import {
  type DebugErrorListResponse,
  type DebugHistoryResponse,
  DebugServerClient
} from "../Source/Features/Debugging/DataAccess/DebugServerClient";
import {
  DebugWorkspaceDataReader,
  type DebugWorkspaceDataSnapshot
} from "../Source/Features/Debugging/StateManagement/DebugWorkspaceDataReader";
import { DebugWorkspaceStateStore } from "../Source/Features/Debugging/StateManagement/DebugWorkspaceStateStore";
import { EventRefreshScheduler } from "../Source/Application/StateManagement/EventRefreshScheduler";
import {
  EventStreamConnectionCoordinator,
  type EventStreamConnectionCoordinatorStartInput
} from "../Source/Application/StateManagement/EventStreamConnectionCoordinator";
import { EventStreamRefreshDecisionEngine } from "../Source/Application/StateManagement/EventStreamRefreshDecisionEngine";
import {
  useEventStreamEffects,
  type UseEventStreamEffectsInput
} from "../Source/Application/StateManagement/UseEventStreamEffects";

type DebugErrors = DebugErrorListResponse["data"];
type DebugHistory = DebugHistoryResponse["history"];

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
        close: () => {}
      })
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
    _errorListLimit: number
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
  const history: DebugHistory = [{
    id: "history-1",
    at: "2026-02-26T00:00:00.000Z",
    source: "app",
    direction: "in",
    payload: { type: "history" },
    meta: {}
  }];
  const debugErrors: DebugErrors = [{
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
    details: {}
  }];

  return {
    history,
    debugErrors,
    debugErrorSessionId: "session-1",
    debugErrorSessionLogPath: "/tmp/session-1.ndjson",
    debugErrorsSignature: ["error-1|2026-02-26T00:00:02.000Z|debug-error"]
  };
}

function createBaseInput(
  eventStreamConnectionCoordinator: TestEventStreamConnectionCoordinator,
  debugWorkspaceDataReader: TestDebugWorkspaceDataReader
): UseEventStreamEffectsInput {
  const loadCoreDataTracked = vi.fn(async (): Promise<void> => {});
  const loadSelectedThread = vi.fn(async (_threadId: string): Promise<void> => {});

  return {
    debugHistoryLimit: 50,
    debugErrorListLimit: 75,
    eventRefreshScheduler: new EventRefreshScheduler(0),
    eventStreamConnectionCoordinator,
    eventStreamRefreshDecisionEngine: new EventStreamRefreshDecisionEngine(["history"]),
    activeTabRef: { current: "chat" },
    selectedThreadIdRef: { current: "thread-1" },
    loadCoreDataTrackedRef: { current: loadCoreDataTracked },
    loadSelectedThreadRef: {
      current: loadSelectedThread
    },
    debugWorkspaceDataReader,
    debugWorkspaceStateStore: new DebugWorkspaceStateStore(),
    debugErrorsSignatureRef: { current: [] },
    eventsConnectedRef: { current: false },
    setHistory: createDispatchSpy<DebugHistory>(),
    setDebugErrors: createDispatchSpy<DebugErrors>(),
    setDebugErrorSessionId: createDispatchSpy<string>(),
    setDebugErrorSessionLogPath: createDispatchSpy<string>(),
    applySelectedThreadStreamDelta: vi.fn(),
    handleRuntimeRequestError: vi.fn()
  };
}

const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");

function setDocumentVisibilityState(nextVisibilityState: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => nextVisibilityState
  });
}

describe("useEventStreamEffects", () => {
  afterEach(() => {
    cleanup();
    if (originalVisibilityStateDescriptor) {
      Object.defineProperty(document, "visibilityState", originalVisibilityStateDescriptor);
    }
  });

  it("wires lifecycle start/stop through the event-stream connection coordinator", () => {
    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot())
    );

    const { unmount } = render(<Harness input={input} />);

    expect(eventStreamConnectionCoordinator.startInput).not.toBeNull();
    unmount();
    expect(eventStreamConnectionCoordinator.stopCallCount).toBe(1);
  });

  it("skips scheduled refresh work while the document is hidden", async () => {
    setDocumentVisibilityState("hidden");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot())
    );
    render(<Harness input={input} />);

    if (!eventStreamConnectionCoordinator.startInput) {
      throw new Error("Expected event-stream start input");
    }

    await eventStreamConnectionCoordinator.startInput.executeScheduledRefresh({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: true
    });

    expect(input.loadCoreDataTrackedRef.current).not.toHaveBeenCalled();
    expect(input.loadSelectedThreadRef.current).not.toHaveBeenCalled();
  });

  it("uses deterministic selected-thread incremental refresh options", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot())
    );
    render(<Harness input={input} />);

    if (!eventStreamConnectionCoordinator.startInput) {
      throw new Error("Expected event-stream start input");
    }

    await eventStreamConnectionCoordinator.startInput.executeScheduledRefresh({
      refreshCore: false,
      refreshHistory: false,
      refreshSelectedThread: true
    });

    expect(input.loadSelectedThreadRef.current).toHaveBeenCalledTimes(1);
    expect(input.loadSelectedThreadRef.current).toHaveBeenCalledWith("thread-1", {
      includeReadThread: true,
      includeTurns: false
    });
  });

  it("routes debug history refresh through debug workspace state ownership", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const debugWorkspaceDataReader = new TestDebugWorkspaceDataReader(createDebugSnapshot());
    const input = createBaseInput(eventStreamConnectionCoordinator, debugWorkspaceDataReader);
    input.activeTabRef.current = "debug";
    render(<Harness input={input} />);

    if (!eventStreamConnectionCoordinator.startInput) {
      throw new Error("Expected event-stream start input");
    }

    await eventStreamConnectionCoordinator.startInput.executeScheduledRefresh({
      refreshCore: false,
      refreshHistory: true,
      refreshSelectedThread: false
    });

    expect(debugWorkspaceDataReader.readSnapshotCallCount).toBe(1);
    expect(input.setHistory).toHaveBeenCalledTimes(1);
    expect(input.setDebugErrors).toHaveBeenCalledTimes(1);
    expect(input.setDebugErrorSessionId).toHaveBeenCalledWith("session-1");
    expect(input.setDebugErrorSessionLogPath).toHaveBeenCalledWith("/tmp/session-1.ndjson");
    expect(input.debugErrorsSignatureRef.current).toEqual([
      "error-1|2026-02-26T00:00:02.000Z|debug-error"
    ]);
  });

  it("suppresses canceled-request errors from runtime error reporting", async () => {
    setDocumentVisibilityState("visible");

    const eventStreamConnectionCoordinator = new TestEventStreamConnectionCoordinator();
    const input = createBaseInput(
      eventStreamConnectionCoordinator,
      new TestDebugWorkspaceDataReader(createDebugSnapshot())
    );
    input.loadCoreDataTrackedRef.current = vi.fn(async (): Promise<void> => {
      throw new RequestCanceledError("/api/threads");
    });
    render(<Harness input={input} />);

    if (!eventStreamConnectionCoordinator.startInput) {
      throw new Error("Expected event-stream start input");
    }

    await eventStreamConnectionCoordinator.startInput.executeScheduledRefresh({
      refreshCore: true,
      refreshHistory: false,
      refreshSelectedThread: false
    });

    expect(input.handleRuntimeRequestError).not.toHaveBeenCalled();
  });
});
