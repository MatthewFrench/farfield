import { describe, expect, it } from "vitest";
import {
  SelectedThreadRefreshConcurrencyCoordinator,
  type SelectedThreadRefreshRequest
} from "../Source/Features/Chat/StateManagement/SelectedThreadRefreshConcurrencyCoordinator";

class TestCanceledRefreshError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TestCanceledRefreshError";
  }
}

function isCanceledRefreshError(error: Error): boolean {
  return error instanceof TestCanceledRefreshError;
}

function createRefreshRequest(input: {
  threadId: string;
  includeTurns: boolean;
  includeReadThread: boolean;
}): SelectedThreadRefreshRequest {
  return {
    threadId: input.threadId,
    includeTurns: input.includeTurns,
    includeReadThread: input.includeReadThread
  };
}

describe("SelectedThreadRefreshConcurrencyCoordinator", () => {
  it("merges queued requests for the same thread", async () => {
    const coordinator = new SelectedThreadRefreshConcurrencyCoordinator();
    const executedRequests: SelectedThreadRefreshRequest[] = [];
    let resolveFirstRefresh: () => void = () => {
      throw new Error("Expected resolveFirstRefresh to be initialized");
    };
    const firstRefreshSettled = new Promise<void>((resolve) => {
      resolveFirstRefresh = resolve;
    });

    const firstRun = coordinator.run({
      request: createRefreshRequest({
        threadId: "thread-1",
        includeTurns: false,
        includeReadThread: false
      }),
      executeRefresh: async (request) => {
        executedRequests.push(request);
        if (executedRequests.length === 1) {
          await firstRefreshSettled;
        }
      },
      isCanceledError: isCanceledRefreshError
    });
    const secondRun = coordinator.run({
      request: createRefreshRequest({
        threadId: "thread-1",
        includeTurns: true,
        includeReadThread: true
      }),
      executeRefresh: async (request) => {
        executedRequests.push(request);
      },
      isCanceledError: isCanceledRefreshError
    });

    await Promise.resolve();
    resolveFirstRefresh();

    await Promise.all([firstRun, secondRun]);

    expect(executedRequests).toEqual([
      createRefreshRequest({
        threadId: "thread-1",
        includeTurns: false,
        includeReadThread: false
      }),
      createRefreshRequest({
        threadId: "thread-1",
        includeTurns: true,
        includeReadThread: true
      })
    ]);
  });

  it("aborts in-flight refresh when a new thread request is queued", async () => {
    const coordinator = new SelectedThreadRefreshConcurrencyCoordinator();
    const executedRequests: SelectedThreadRefreshRequest[] = [];

    const firstRun = coordinator.run({
      request: createRefreshRequest({
        threadId: "thread-1",
        includeTurns: false,
        includeReadThread: true
      }),
      executeRefresh: async (request, signal) => {
        executedRequests.push(request);
        await new Promise<void>((resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new TestCanceledRefreshError("refresh canceled"));
          }, { once: true });
          window.setTimeout(resolve, 50);
        });
      },
      isCanceledError: isCanceledRefreshError
    });

    const secondRun = coordinator.run({
      request: createRefreshRequest({
        threadId: "thread-2",
        includeTurns: true,
        includeReadThread: true
      }),
      executeRefresh: async (request) => {
        executedRequests.push(request);
      },
      isCanceledError: isCanceledRefreshError
    });

    await Promise.all([firstRun, secondRun]);

    expect(executedRequests).toEqual([
      createRefreshRequest({
        threadId: "thread-1",
        includeTurns: false,
        includeReadThread: true
      }),
      createRefreshRequest({
        threadId: "thread-2",
        includeTurns: true,
        includeReadThread: true
      })
    ]);
  });

  it("normalizes non-Error refresh failures into Error instances", async () => {
    const coordinator = new SelectedThreadRefreshConcurrencyCoordinator();

    try {
      await coordinator.run({
        request: createRefreshRequest({
          threadId: "thread-1",
          includeTurns: true,
          includeReadThread: true
        }),
        executeRefresh: async () => {
          throw "refresh failed";
        },
        isCanceledError: isCanceledRefreshError
      });
      throw new Error("Expected coordinator.run to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) {
        throw new Error("Expected error to be an Error instance");
      }
      expect(error.message).toBe("refresh failed");
    }
  });
});
