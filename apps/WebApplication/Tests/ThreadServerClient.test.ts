import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiThreadListResponse } from "@/Features/Threads/DataAccess/ThreadApi";
import * as ThreadApi from "@/Features/Threads/DataAccess/ThreadApi";
import { ThreadServerClient } from "@/Features/Threads/DataAccess/ThreadServerClient";

function buildThreadListResponse(): ApiThreadListResponse {
  return {
    data: [
      {
        id: "thread-server-client",
        preview: "Thread server client response",
        createdAt: 1_735_000_000_000,
        updatedAt: 1_735_000_000_100,
        cwd: "/tmp/thread-server-client",
        path: "/tmp/thread-server-client",
        agentId: "codex",
        hasUnreadTurn: null,
        isProjectRemoved: false,
      },
    ],
    nextCursor: null,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThreadServerClient", () => {
  it("maps thread-list load options to strict thread API request options", async () => {
    const response = buildThreadListResponse();
    const listThreadsSpy = vi.spyOn(ThreadApi, "listThreads").mockResolvedValue(response);
    const threadServerClient = new ThreadServerClient();
    const abortController = new AbortController();

    const result = await threadServerClient.listThreads({
      archived: true,
      limit: 42,
      maxPages: 5,
      sortKey: "updated_at",
      sinceUpdatedAt: 1_735_000_000_050,
      cwd: "/tmp/workspace",
      signal: abortController.signal,
      actionId: "action-load-archived-threads",
      actionName: "load-archived-threads",
    });

    expect(result).toEqual(response);
    expect(listThreadsSpy).toHaveBeenCalledTimes(1);
    expect(listThreadsSpy).toHaveBeenCalledWith({
      archived: true,
      limit: 42,
      maxPages: 5,
      all: true,
      sortKey: "updated_at",
      sinceUpdatedAt: 1_735_000_000_050,
      cwd: "/tmp/workspace",
      signal: abortController.signal,
      actionId: "action-load-archived-threads",
      actionName: "load-archived-threads",
    });
  });

  it("omits optional API request fields when load options do not provide them", async () => {
    const response = buildThreadListResponse();
    const listThreadsSpy = vi.spyOn(ThreadApi, "listThreads").mockResolvedValue(response);
    const threadServerClient = new ThreadServerClient();

    await threadServerClient.listThreads({
      archived: false,
      limit: 80,
      maxPages: 20,
      sortKey: "created_at",
    });

    const callArguments = listThreadsSpy.mock.calls[0];
    if (!callArguments) {
      throw new Error("Expected listThreads to be called");
    }
    const [requestOptions] = callArguments;

    expect(requestOptions).toEqual({
      archived: false,
      limit: 80,
      maxPages: 20,
      all: true,
      sortKey: "created_at",
    });
  });
});
