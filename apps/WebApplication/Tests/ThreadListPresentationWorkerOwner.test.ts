import { describe, expect, it } from "vitest";
import type { ThreadListItem } from "../Source/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListPresentationStateResolver } from "../Source/Features/Threads/StateManagement/ThreadListPresentationStateResolver";
import {
  parseThreadListPresentationWorkerRequest,
  type ThreadListPresentationWorkerRequest,
  type ThreadListPresentationWorkerResponse,
} from "../Source/Features/Threads/StateManagement/ThreadListPresentationWorkerContracts";
import {
  type ThreadListPresentationMessageWorker,
  ThreadListPresentationWorkerOwner,
} from "../Source/Features/Threads/StateManagement/ThreadListPresentationWorkerOwner";

type TestWorkerMode = "in-order" | "reverse-first-two" | "hold";

const WORKER_EVENT_NAME_MESSAGE = "message";

function createThreadListItem(input: {
  threadId: string;
  projectPath: string;
  updatedAt: number;
  agentId?: ThreadListItem["agentId"];
}): ThreadListItem {
  return {
    id: input.threadId,
    preview: input.threadId,
    createdAt: input.updatedAt - 5,
    updatedAt: input.updatedAt,
    cwd: input.projectPath,
    agentId: input.agentId ?? "codex",
    hasUnreadTurn: false,
    isProjectRemoved: false,
  };
}

class TestThreadListPresentationWorker implements ThreadListPresentationMessageWorker {
  private readonly resolver = new ThreadListPresentationStateResolver();
  private readonly messageListeners: Array<(event: MessageEvent) => void> = [];
  private readonly errorListeners: Array<(event: Event) => void> = [];
  private readonly mode: TestWorkerMode;
  private readonly pendingRequests: ThreadListPresentationWorkerRequest[] = [];
  private terminated = false;

  public constructor(mode: TestWorkerMode) {
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

  public postMessage(message: ThreadListPresentationWorkerRequest): void {
    const parsedRequest = parseThreadListPresentationWorkerRequest(message);

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

  private dispatchRequest(request: ThreadListPresentationWorkerRequest): void {
    const state = this.resolver.readState(request.input);
    this.emitMessage({
      requestId: request.requestId,
      kind: "success",
      result: {
        selectedThread: state.selectedThread,
        activeProjectGroups: state.activeProjectGroups,
        archivedProjectGroups: state.archivedProjectGroups,
        archivedThreadIdentifiers: Array.from(state.archivedThreadIdentifiers),
        archivedSectionThreadCount: state.archivedSectionThreadCount,
      },
    });
  }

  private emitMessage(response: ThreadListPresentationWorkerResponse): void {
    const messageEvent = new MessageEvent(WORKER_EVENT_NAME_MESSAGE, {
      data: response,
    });
    for (const messageListener of this.messageListeners) {
      messageListener(messageEvent);
    }
  }
}

describe("ThreadListPresentationWorkerOwner", () => {
  it("matches canonical presentation-state outputs during replay", async () => {
    const worker = new TestThreadListPresentationWorker("in-order");
    const owner = new ThreadListPresentationWorkerOwner({
      createWorker: () => worker,
    });
    const canonicalResolver = new ThreadListPresentationStateResolver();
    const replayInputs = [
      {
        threads: [
          createThreadListItem({
            threadId: "thread-1",
            projectPath: "/workspace/caddy",
            updatedAt: 100,
          }),
        ],
        archivedThreads: [],
        selectedThreadIdentifier: "thread-1",
      },
      {
        threads: [
          createThreadListItem({
            threadId: "thread-2",
            projectPath: "/workspace/farfield",
            updatedAt: 200,
          }),
        ],
        archivedThreads: [
          createThreadListItem({
            threadId: "thread-archived-1",
            projectPath: "/workspace/caddy",
            updatedAt: 90,
          }),
        ],
        selectedThreadIdentifier: "thread-2",
      },
    ];

    for (const replayInput of replayInputs) {
      const workerState = await owner.readState(replayInput);
      const canonicalState = canonicalResolver.readState(replayInput);
      expect(workerState).toEqual(canonicalState);
    }

    owner.dispose();
    expect(worker.readTerminatedState()).toBe(true);
  });

  it("resolves request promises by request identifier when responses arrive out of order", async () => {
    const worker = new TestThreadListPresentationWorker("reverse-first-two");
    const owner = new ThreadListPresentationWorkerOwner({
      createWorker: () => worker,
    });
    const firstInput = {
      threads: [
        createThreadListItem({
          threadId: "thread-3",
          projectPath: "/workspace/project-one",
          updatedAt: 300,
        }),
      ],
      archivedThreads: [],
      selectedThreadIdentifier: "thread-3",
    };
    const secondInput = {
      threads: [
        createThreadListItem({
          threadId: "thread-4",
          projectPath: "/workspace/project-two",
          updatedAt: 400,
        }),
      ],
      archivedThreads: [],
      selectedThreadIdentifier: "thread-4",
    };

    const firstStatePromise = owner.readState(firstInput);
    const secondStatePromise = owner.readState(secondInput);
    const [firstState, secondState] = await Promise.all([firstStatePromise, secondStatePromise]);

    expect(firstState.selectedThread?.id).toBe("thread-3");
    expect(secondState.selectedThread?.id).toBe("thread-4");

    owner.dispose();
  });

  it("rejects pending presentation requests when disposed", async () => {
    const worker = new TestThreadListPresentationWorker("hold");
    const owner = new ThreadListPresentationWorkerOwner({
      createWorker: () => worker,
    });

    const pendingStatePromise = owner.readState({
      threads: [
        createThreadListItem({
          threadId: "thread-5",
          projectPath: "/workspace/held",
          updatedAt: 500,
        }),
      ],
      archivedThreads: [],
      selectedThreadIdentifier: "thread-5",
    });
    owner.dispose();

    await expect(pendingStatePromise).rejects.toThrow(
      "ThreadListPresentationWorkerOwner has been disposed.",
    );
  });
});
