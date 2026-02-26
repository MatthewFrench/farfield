import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../Source/Features/Threads/DataAccess/ThreadApi", () => ({
  archiveThread: vi.fn(),
  createThread: vi.fn(),
  unarchiveThread: vi.fn()
}));

import {
  archiveThread,
  createThread,
  unarchiveThread
} from "../Source/Features/Threads/DataAccess/ThreadApi";
import { ThreadMutationServerClient } from "../Source/Features/Threads/DataAccess/ThreadMutationServerClient";

describe("ThreadMutationServerClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createThread).mockResolvedValue({
      threadId: "thread-1",
      agentId: "codex"
    });
    vi.mocked(archiveThread).mockResolvedValue();
    vi.mocked(unarchiveThread).mockResolvedValue();
  });

  it("delegates create-thread requests with typed request options", async () => {
    const threadMutationServerClient = new ThreadMutationServerClient();
    const createThreadInput = {
      cwd: "/tmp/project",
      agentId: "codex" as const
    };
    const requestOptions = {
      actionId: "action-create-thread",
      actionName: "create-thread"
    };

    const response = await threadMutationServerClient.createThread(createThreadInput, requestOptions);

    expect(createThread).toHaveBeenCalledWith(createThreadInput, requestOptions);
    expect(response).toEqual({
      threadId: "thread-1",
      agentId: "codex"
    });
  });

  it("normalizes thread identifiers before archive and unarchive calls", async () => {
    const threadMutationServerClient = new ThreadMutationServerClient();
    const archiveOptions = {
      actionId: "action-archive-thread",
      actionName: "archive-thread"
    };
    const unarchiveOptions = {
      actionId: "action-unarchive-thread",
      actionName: "unarchive-thread"
    };

    await threadMutationServerClient.archiveThread("  thread-1  ", archiveOptions);
    await threadMutationServerClient.unarchiveThread("  thread-2  ", unarchiveOptions);

    expect(archiveThread).toHaveBeenCalledWith("thread-1", archiveOptions);
    expect(unarchiveThread).toHaveBeenCalledWith("thread-2", unarchiveOptions);
  });

  it("rejects blank thread identifiers before issuing mutation requests", async () => {
    const threadMutationServerClient = new ThreadMutationServerClient();

    await expect(threadMutationServerClient.archiveThread("   ")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string"
    );
    await expect(threadMutationServerClient.unarchiveThread("\n\t")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string"
    );
    expect(archiveThread).not.toHaveBeenCalled();
    expect(unarchiveThread).not.toHaveBeenCalled();
  });
});
