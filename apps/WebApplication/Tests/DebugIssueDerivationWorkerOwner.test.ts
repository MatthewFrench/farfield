import { describe, expect, it } from "vitest";
import type {
  DebugErrorLike,
  DebugHistoryEntryLike,
} from "../Source/Features/Debugging/DomainModel/DebugIssueContracts";
import { DebugIssueStateResolver } from "../Source/Features/Debugging/DomainModel/DebugIssueStateResolver";
import {
  type DebugIssueDerivationResult,
  type DebugIssueDerivationWorkerRequest,
  type DebugIssueDerivationWorkerResponse,
  parseDebugIssueDerivationWorkerRequest,
} from "../Source/Features/Debugging/StateManagement/DebugIssueDerivationWorkerContracts";
import {
  type DebugIssueDerivationMessageWorker,
  DebugIssueDerivationWorkerOwner,
} from "../Source/Features/Debugging/StateManagement/DebugIssueDerivationWorkerOwner";

type TestWorkerMode = "in-order" | "reverse-first-two" | "hold";

const WORKER_EVENT_NAME_MESSAGE = "message";

function createDebugErrorRecord(input: {
  errorId: string;
  message: string;
  operation?: string;
  actionName?: string;
}): DebugErrorLike {
  return {
    errorId: input.errorId,
    origin: "client",
    source: "farfield-web",
    operation: input.operation ?? "runtime-request-error",
    message: input.message,
    severity: "error",
    name: null,
    stack: null,
    requestId: null,
    threadId: null,
    occurredAt: "2026-02-28T00:00:00.000Z",
    details: input.actionName
      ? {
          actionName: input.actionName,
        }
      : {},
  };
}

function createDebugHistoryEntry(input: {
  entryId: string;
  source: "ipc" | "app" | "system";
}): DebugHistoryEntryLike {
  return {
    id: input.entryId,
    at: "2026-02-28T00:00:00.000Z",
    source: input.source,
    payload: {
      type: "action",
      action: "thread-stream-state-changed",
    },
    meta: {
      method: "thread-stream-state-changed",
      threadId: "thread-1",
    },
  };
}

class TestDebugIssueDerivationWorker implements DebugIssueDerivationMessageWorker {
  private readonly debugIssueStateResolver = new DebugIssueStateResolver();
  private readonly messageListeners: Array<(event: MessageEvent) => void> = [];
  private readonly errorListeners: Array<(event: Event) => void> = [];
  private readonly mode: TestWorkerMode;
  private readonly pendingRequests: DebugIssueDerivationWorkerRequest[] = [];
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

  public postMessage(message: DebugIssueDerivationWorkerRequest): void {
    const parsedRequest = parseDebugIssueDerivationWorkerRequest(message);

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

  private dispatchRequest(request: DebugIssueDerivationWorkerRequest): void {
    const debugErrorIssues = this.debugIssueStateResolver.readDebugErrorIssues(
      request.input.debugErrors,
    );
    const debugWarningIssues = this.debugIssueStateResolver.readDebugWarningIssues(
      request.input.historyEntries,
    );
    const debugIssues = this.debugIssueStateResolver.readCombinedDebugIssues({
      debugErrorIssues,
      debugWarningIssues,
    });
    const runtimeRequestErrorOperationMetrics =
      this.debugIssueStateResolver.readRuntimeRequestErrorOperationMetrics(
        request.input.debugErrors,
      );
    const filteredDebugIssues = this.debugIssueStateResolver.readFilteredDebugIssues({
      debugIssues,
      severityFilter: request.input.severityFilter,
      filterQuery: request.input.filterQuery,
    });
    const selectedDebugIssue = this.debugIssueStateResolver.readSelectedDebugIssue({
      debugIssues: filteredDebugIssues,
      selectedIssueIdentifier: request.input.selectedIssueIdentifier,
    });
    this.emitMessage({
      requestId: request.requestId,
      kind: "success",
      result: {
        debugErrorIssues,
        debugWarningIssues,
        debugIssues,
        runtimeRequestErrorOperationMetrics,
        filteredDebugIssues,
        selectedDebugIssue,
      },
    });
  }

  private emitMessage(response: DebugIssueDerivationWorkerResponse): void {
    const messageEvent = new MessageEvent(WORKER_EVENT_NAME_MESSAGE, {
      data: response,
    });
    for (const messageListener of this.messageListeners) {
      messageListener(messageEvent);
    }
  }
}

describe("DebugIssueDerivationWorkerOwner", () => {
  it("matches canonical debug-issue derivation outputs during replay", async () => {
    const worker = new TestDebugIssueDerivationWorker("in-order");
    const owner = new DebugIssueDerivationWorkerOwner({
      createWorker: () => worker,
    });
    const canonicalResolver = new DebugIssueStateResolver();
    const replayInputs = [
      {
        debugErrors: [
          createDebugErrorRecord({
            errorId: "error-1",
            message: "request failed for /api/threads",
          }),
        ],
        historyEntries: [createDebugHistoryEntry({ entryId: "history-1", source: "ipc" })],
        severityFilter: "all" as const,
        filterQuery: "",
        selectedIssueIdentifier: "",
      },
      {
        debugErrors: [
          createDebugErrorRecord({
            errorId: "error-2",
            message: "request failed for /api/messages",
            actionName: "startup-critical.messages",
          }),
        ],
        historyEntries: [createDebugHistoryEntry({ entryId: "history-2", source: "system" })],
        severityFilter: "error" as const,
        filterQuery: "request",
        selectedIssueIdentifier: "",
      },
    ];

    for (const replayInput of replayInputs) {
      const workerResult = await owner.readDerivedDebugIssueState(replayInput);
      const debugErrorIssues = canonicalResolver.readDebugErrorIssues(replayInput.debugErrors);
      const debugWarningIssues = canonicalResolver.readDebugWarningIssues(
        replayInput.historyEntries,
      );
      const debugIssues = canonicalResolver.readCombinedDebugIssues({
        debugErrorIssues,
        debugWarningIssues,
      });
      const canonicalResult: DebugIssueDerivationResult = {
        debugErrorIssues,
        debugWarningIssues,
        debugIssues,
        runtimeRequestErrorOperationMetrics:
          canonicalResolver.readRuntimeRequestErrorOperationMetrics(replayInput.debugErrors),
        filteredDebugIssues: canonicalResolver.readFilteredDebugIssues({
          debugIssues,
          severityFilter: replayInput.severityFilter,
          filterQuery: replayInput.filterQuery,
        }),
        selectedDebugIssue: canonicalResolver.readSelectedDebugIssue({
          debugIssues,
          selectedIssueIdentifier: replayInput.selectedIssueIdentifier,
        }),
      };
      canonicalResult.selectedDebugIssue = canonicalResolver.readSelectedDebugIssue({
        debugIssues: canonicalResult.filteredDebugIssues,
        selectedIssueIdentifier: replayInput.selectedIssueIdentifier,
      });

      expect(workerResult).toEqual(canonicalResult);
    }

    owner.dispose();
    expect(worker.readTerminatedState()).toBe(true);
  });

  it("resolves request promises by request identifier when responses arrive out of order", async () => {
    const worker = new TestDebugIssueDerivationWorker("reverse-first-two");
    const owner = new DebugIssueDerivationWorkerOwner({
      createWorker: () => worker,
    });
    const firstInput = {
      debugErrors: [createDebugErrorRecord({ errorId: "error-3", message: "first failure" })],
      historyEntries: [createDebugHistoryEntry({ entryId: "history-3", source: "app" })],
      severityFilter: "all" as const,
      filterQuery: "first",
      selectedIssueIdentifier: "",
    };
    const secondInput = {
      debugErrors: [createDebugErrorRecord({ errorId: "error-4", message: "second failure" })],
      historyEntries: [createDebugHistoryEntry({ entryId: "history-4", source: "system" })],
      severityFilter: "all" as const,
      filterQuery: "second",
      selectedIssueIdentifier: "",
    };

    const firstResultPromise = owner.readDerivedDebugIssueState(firstInput);
    const secondResultPromise = owner.readDerivedDebugIssueState(secondInput);
    const [firstResult, secondResult] = await Promise.all([
      firstResultPromise,
      secondResultPromise,
    ]);

    expect(firstResult.filteredDebugIssues[0]?.searchText).toContain("first");
    expect(secondResult.filteredDebugIssues[0]?.searchText).toContain("second");

    owner.dispose();
  });

  it("rejects pending derivation requests when disposed", async () => {
    const worker = new TestDebugIssueDerivationWorker("hold");
    const owner = new DebugIssueDerivationWorkerOwner({
      createWorker: () => worker,
    });

    const pendingResultPromise = owner.readDerivedDebugIssueState({
      debugErrors: [createDebugErrorRecord({ errorId: "error-5", message: "held failure" })],
      historyEntries: [],
      severityFilter: "all",
      filterQuery: "",
      selectedIssueIdentifier: "",
    });
    owner.dispose();

    await expect(pendingResultPromise).rejects.toThrow(
      "DebugIssueDerivationWorkerOwner has been disposed.",
    );
  });
});
