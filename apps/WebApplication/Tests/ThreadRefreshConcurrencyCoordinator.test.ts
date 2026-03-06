import { describe, expect, it } from "vitest";
import type { ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";
import { ThreadListCacheKeyByName } from "@/Features/Threads/StateManagement/ThreadListCacheKeyContracts";
import { ThreadRefreshConcurrencyCoordinator } from "@/Features/Threads/StateManagement/ThreadRefreshConcurrencyCoordinator";

function buildThreadListResponse(threadIdentifier: string): ThreadListResponse {
  return {
    data: [
      {
        id: threadIdentifier,
        preview: `Preview for ${threadIdentifier}`,
        createdAt: 1_735_000_000_000,
        updatedAt: 1_735_000_000_100,
        cwd: "/tmp/thread-refresh",
        path: "/tmp/thread-refresh",
        agentId: "codex",
        hasUnreadTurn: null,
        isProjectRemoved: false,
      },
    ],
    nextCursor: null,
  };
}

describe("ThreadRefreshConcurrencyCoordinator", () => {
  it("reuses one in-flight request for matching request keys", async () => {
    const coordinator = new ThreadRefreshConcurrencyCoordinator();
    const response = buildThreadListResponse("thread-active");
    let invocationCount = 0;

    const task = async (): Promise<ThreadListResponse> => {
      invocationCount += 1;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
      return response;
    };

    const [firstResult, secondResult] = await Promise.all([
      coordinator.runSingleFlight(ThreadListCacheKeyByName.activeThreads, task),
      coordinator.runSingleFlight(ThreadListCacheKeyByName.activeThreads, task),
    ]);

    expect(invocationCount).toBe(1);
    expect(firstResult).toEqual(response);
    expect(secondResult).toEqual(response);
  });

  it("releases failed in-flight requests so a later call can retry", async () => {
    const coordinator = new ThreadRefreshConcurrencyCoordinator();
    const successfulResponse = buildThreadListResponse("thread-retry");
    let invocationCount = 0;

    const task = async (): Promise<ThreadListResponse> => {
      invocationCount += 1;
      if (invocationCount === 1) {
        throw new Error("request failed");
      }
      return successfulResponse;
    };

    await expect(
      coordinator.runSingleFlight(ThreadListCacheKeyByName.archivedThreads, task),
    ).rejects.toThrow("request failed");

    const retryResult = await coordinator.runSingleFlight(
      ThreadListCacheKeyByName.archivedThreads,
      task,
    );
    expect(retryResult).toEqual(successfulResponse);
    expect(invocationCount).toBe(2);
  });
});
