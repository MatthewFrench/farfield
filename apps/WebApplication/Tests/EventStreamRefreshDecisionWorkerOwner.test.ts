import { describe, expect, it } from "vitest";
import {
  EventStreamRefreshDecisionEngine,
  type EventStreamRefreshDecisionInput,
} from "../Source/Application/StateManagement/EventStreamRefreshDecisionEngine";
import {
  type EventStreamRefreshDecisionWorkerRequest,
  type EventStreamRefreshDecisionWorkerResponse,
  parseEventStreamRefreshDecisionWorkerRequest,
} from "../Source/Application/StateManagement/EventStreamRefreshDecisionWorkerContracts";
import {
  type EventStreamRefreshDecisionMessageWorker,
  EventStreamRefreshDecisionWorkerOwner,
} from "../Source/Application/StateManagement/EventStreamRefreshDecisionWorkerOwner";

const THREAD_ONLY_METHODS = [
  "thread-stream-state-changed",
  "thread-queued-followups-changed",
] as const;
const WORKER_EVENT_NAME_MESSAGE = "message";

type TestDecisionWorkerMode = "in-order" | "reverse-first-two" | "hold";

function createRuntimeStateChangedInput(): EventStreamRefreshDecisionInput {
  return {
    activeTab: "chat",
    selectedThreadId: "thread-1",
    eventData: JSON.stringify({
      sequence: 1,
      event: {
        type: "runtime-state-changed",
        state: {
          appReady: true,
        },
      },
    }),
  };
}

function createThreadHistoryInput(): EventStreamRefreshDecisionInput {
  return {
    activeTab: "debug",
    selectedThreadId: "thread-1",
    eventData: JSON.stringify({
      sequence: 2,
      event: {
        type: "activity-history-appended",
        entry: {
          id: "entry-1",
          at: "2026-02-28T00:00:00.000Z",
          source: "app",
          direction: "out",
          payload: {
            type: "action",
            action: "thread-queued-followups-changed",
          },
          meta: {
            method: "thread-queued-followups-changed",
            threadId: "thread-1",
          },
        },
      },
    }),
  };
}

function createSelectedThreadDeltaInput(): EventStreamRefreshDecisionInput {
  return {
    activeTab: "chat",
    selectedThreadId: "thread-1",
    eventData: JSON.stringify({
      sequence: 3,
      event: {
        type: "thread-stream-delta",
        delta: {
          threadId: "thread-1",
          liveStateSnapshot: {
            ok: true,
            threadId: "thread-1",
            ownerClientId: "client-1",
            conversationState: null,
            liveStateError: null,
          },
          streamEventsSnapshot: {
            ok: true,
            threadId: "thread-1",
            ownerClientId: "client-1",
            events: [],
            nextSequence: 2,
            firstAvailableSequence: 0,
            resetRequired: false,
          },
          streamEventsSinceSequenceUsed: 1,
        },
      },
    }),
  };
}

class TestEventStreamDecisionWorker implements EventStreamRefreshDecisionMessageWorker {
  private readonly decisionEngine = new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);
  private readonly messageListeners: Array<(event: MessageEvent) => void> = [];
  private readonly errorListeners: Array<(event: Event) => void> = [];
  private readonly mode: TestDecisionWorkerMode;
  private readonly pendingRequests: EventStreamRefreshDecisionWorkerRequest[] = [];
  private terminated = false;

  public constructor(mode: TestDecisionWorkerMode) {
    this.mode = mode;
  }

  public addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  public addEventListener(type: "error", listener: (event: Event) => void): void;
  public addEventListener(
    type: "message" | "error",
    listener: ((event: MessageEvent) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      this.messageListeners.push(listener as (event: MessageEvent) => void);
      return;
    }
    this.errorListeners.push(listener as (event: Event) => void);
  }

  public removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  public removeEventListener(type: "error", listener: (event: Event) => void): void;
  public removeEventListener(
    type: "message" | "error",
    listener: ((event: MessageEvent) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      const listenerIndex = this.messageListeners.indexOf(
        listener as (event: MessageEvent) => void,
      );
      if (listenerIndex >= 0) {
        this.messageListeners.splice(listenerIndex, 1);
      }
      return;
    }
    const listenerIndex = this.errorListeners.indexOf(listener as (event: Event) => void);
    if (listenerIndex >= 0) {
      this.errorListeners.splice(listenerIndex, 1);
    }
  }

  public postMessage(message: EventStreamRefreshDecisionWorkerRequest): void {
    const parsedRequest = parseEventStreamRefreshDecisionWorkerRequest(message);
    if (this.mode === "hold") {
      this.pendingRequests.push(parsedRequest);
      return;
    }

    if (this.mode === "reverse-first-two") {
      this.pendingRequests.push(parsedRequest);
      if (this.pendingRequests.length === 2) {
        const firstRequest = this.pendingRequests[0];
        const secondRequest = this.pendingRequests[1];
        this.pendingRequests.length = 0;
        if (secondRequest && firstRequest) {
          this.dispatchRequest(secondRequest);
          this.dispatchRequest(firstRequest);
        }
      }
      return;
    }

    this.dispatchRequest(parsedRequest);
  }

  public terminate(): void {
    this.terminated = true;
  }

  public readTerminatedState(): boolean {
    return this.terminated;
  }

  private dispatchRequest(request: EventStreamRefreshDecisionWorkerRequest): void {
    const decision = this.decisionEngine.readDecision(request.input);
    this.emitMessage({
      requestId: request.requestId,
      kind: "success",
      decision,
    });
  }

  private emitMessage(response: EventStreamRefreshDecisionWorkerResponse): void {
    const messageEvent = new MessageEvent(WORKER_EVENT_NAME_MESSAGE, {
      data: response,
    });
    for (const messageListener of this.messageListeners) {
      messageListener(messageEvent);
    }
  }
}

describe("EventStreamRefreshDecisionWorkerOwner", () => {
  it("matches canonical decision outputs during replay", async () => {
    const worker = new TestEventStreamDecisionWorker("in-order");
    const owner = new EventStreamRefreshDecisionWorkerOwner({
      threadOnlyHistoryMethods: THREAD_ONLY_METHODS,
      createWorker: () => worker,
    });
    const canonicalEngine = new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);
    const replayInputs = [
      createRuntimeStateChangedInput(),
      createThreadHistoryInput(),
      createSelectedThreadDeltaInput(),
    ];

    for (const replayInput of replayInputs) {
      const workerDecision = await owner.readDecision(replayInput);
      const canonicalDecision = canonicalEngine.readDecision(replayInput);
      expect(workerDecision).toEqual(canonicalDecision);
    }

    owner.dispose();
    expect(worker.readTerminatedState()).toBe(true);
  });

  it("resolves request promises by request identifier when responses arrive out of order", async () => {
    const worker = new TestEventStreamDecisionWorker("reverse-first-two");
    const owner = new EventStreamRefreshDecisionWorkerOwner({
      threadOnlyHistoryMethods: THREAD_ONLY_METHODS,
      createWorker: () => worker,
    });
    const canonicalEngine = new EventStreamRefreshDecisionEngine(THREAD_ONLY_METHODS);
    const firstInput = createRuntimeStateChangedInput();
    const secondInput = createThreadHistoryInput();

    const firstDecisionPromise = owner.readDecision(firstInput);
    const secondDecisionPromise = owner.readDecision(secondInput);
    const [firstDecision, secondDecision] = await Promise.all([
      firstDecisionPromise,
      secondDecisionPromise,
    ]);

    expect(firstDecision).toEqual(canonicalEngine.readDecision(firstInput));
    expect(secondDecision).toEqual(canonicalEngine.readDecision(secondInput));

    owner.dispose();
  });

  it("rejects pending decision requests when disposed", async () => {
    const worker = new TestEventStreamDecisionWorker("hold");
    const owner = new EventStreamRefreshDecisionWorkerOwner({
      threadOnlyHistoryMethods: THREAD_ONLY_METHODS,
      createWorker: () => worker,
    });

    const pendingDecisionPromise = owner.readDecision(createRuntimeStateChangedInput());
    owner.dispose();

    await expect(pendingDecisionPromise).rejects.toThrow(
      "EventStreamRefreshDecisionWorkerOwner has been disposed.",
    );
  });
});
