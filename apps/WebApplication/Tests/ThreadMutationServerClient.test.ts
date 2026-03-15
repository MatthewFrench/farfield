import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../Source/Features/Threads/DataAccess/ThreadApi", () => ({
  archiveThread: vi.fn(),
  cleanThreadBackgroundTerminals: vi.fn(),
  compactThread: vi.fn(),
  createThread: vi.fn(),
  forkThread: vi.fn(),
  forkThreadFromMessage: vi.fn(),
  rollbackThread: vi.fn(),
  startThreadReview: vi.fn(),
  setThreadName: vi.fn(),
  unarchiveThread: vi.fn(),
}));

import {
  archiveThread,
  cleanThreadBackgroundTerminals,
  compactThread,
  createThread,
  forkThread,
  forkThreadFromMessage,
  rollbackThread,
  setThreadName,
  startThreadReview,
  unarchiveThread,
} from "../Source/Features/Threads/DataAccess/ThreadApi";
import { ThreadMutationServerClient } from "../Source/Features/Threads/DataAccess/ThreadMutationServerClient";

describe("ThreadMutationServerClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createThread).mockResolvedValue({
      threadId: "thread-1",
      agentId: "codex",
    });
    vi.mocked(archiveThread).mockResolvedValue();
    vi.mocked(cleanThreadBackgroundTerminals).mockResolvedValue();
    vi.mocked(compactThread).mockResolvedValue();
    vi.mocked(forkThread).mockResolvedValue({
      threadId: "thread-2",
      sourceThreadId: "thread-1",
    });
    vi.mocked(forkThreadFromMessage).mockResolvedValue({
      threadId: "thread-2a",
      sourceThreadId: "thread-1",
      sourceMessageId: "message-1",
    });
    vi.mocked(rollbackThread).mockResolvedValue();
    vi.mocked(startThreadReview).mockResolvedValue({
      reviewThreadId: "thread-review-1",
      reviewTurnId: "turn-review-1",
    });
    vi.mocked(setThreadName).mockResolvedValue();
    vi.mocked(unarchiveThread).mockResolvedValue();
  });

  it("delegates create-thread requests with typed request options", async () => {
    const threadMutationServerClient = new ThreadMutationServerClient();
    const createThreadInput = {
      cwd: "/tmp/project",
      agentId: "codex" as const,
    };
    const requestOptions = {
      actionId: "action-create-thread",
      actionName: "create-thread",
    };

    const response = await threadMutationServerClient.createThread(
      createThreadInput,
      requestOptions,
    );

    expect(createThread).toHaveBeenCalledWith(createThreadInput, requestOptions);
    expect(response).toEqual({
      threadId: "thread-1",
      agentId: "codex",
    });
  });

  it("normalizes thread identifiers before archive and unarchive calls", async () => {
    const threadMutationServerClient = new ThreadMutationServerClient();
    const archiveOptions = {
      actionId: "action-archive-thread",
      actionName: "archive-thread",
    };
    const unarchiveOptions = {
      actionId: "action-unarchive-thread",
      actionName: "unarchive-thread",
    };
    const forkOptions = {
      actionId: "action-fork-thread",
      actionName: "fork-thread",
    };
    const setNameOptions = {
      actionId: "action-set-thread-name",
      actionName: "set-thread-name",
    };

    await threadMutationServerClient.archiveThread("  thread-1  ", archiveOptions);
    await threadMutationServerClient.unarchiveThread("  thread-2  ", unarchiveOptions);
    await threadMutationServerClient.forkThread("  thread-3  ", forkOptions);
    await threadMutationServerClient.forkThreadFromMessage("  thread-3  ", "  message-1  ", {
      actionId: "action-fork-thread-from-message",
      actionName: "fork-thread-from-message",
    });
    await threadMutationServerClient.rollbackThread("  thread-4  ", 2, {
      actionId: "action-rollback-thread",
      actionName: "rollback-thread",
    });
    await threadMutationServerClient.compactThread("  thread-4  ", {
      actionId: "action-compact-thread",
      actionName: "compact-thread",
    });
    await threadMutationServerClient.cleanThreadBackgroundTerminals("  thread-4  ", {
      actionId: "action-clean-thread-background-terminals",
      actionName: "clean-thread-background-terminals",
    });
    await threadMutationServerClient.startThreadReview("  thread-5  ", {
      actionId: "action-start-thread-review",
      actionName: "start-thread-review",
    });
    await threadMutationServerClient.setThreadName(
      "  thread-4  ",
      "  Better title  ",
      setNameOptions,
    );

    expect(archiveThread).toHaveBeenCalledWith("thread-1", archiveOptions);
    expect(unarchiveThread).toHaveBeenCalledWith("thread-2", unarchiveOptions);
    expect(forkThread).toHaveBeenCalledWith("thread-3", forkOptions);
    expect(forkThreadFromMessage).toHaveBeenCalledWith(
      {
        threadId: "thread-3",
        messageId: "message-1",
      },
      {
        actionId: "action-fork-thread-from-message",
        actionName: "fork-thread-from-message",
      },
    );
    expect(rollbackThread).toHaveBeenCalledWith(
      {
        threadId: "thread-4",
        numTurns: 2,
      },
      {
        actionId: "action-rollback-thread",
        actionName: "rollback-thread",
      },
    );
    expect(compactThread).toHaveBeenCalledWith("thread-4", {
      actionId: "action-compact-thread",
      actionName: "compact-thread",
    });
    expect(cleanThreadBackgroundTerminals).toHaveBeenCalledWith("thread-4", {
      actionId: "action-clean-thread-background-terminals",
      actionName: "clean-thread-background-terminals",
    });
    expect(startThreadReview).toHaveBeenCalledWith("thread-5", {
      actionId: "action-start-thread-review",
      actionName: "start-thread-review",
    });
    expect(setThreadName).toHaveBeenCalledWith(
      {
        threadId: "thread-4",
        name: "  Better title  ",
      },
      setNameOptions,
    );
  });

  it("rejects blank thread identifiers before issuing mutation requests", async () => {
    const threadMutationServerClient = new ThreadMutationServerClient();

    await expect(threadMutationServerClient.archiveThread("   ")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string",
    );
    await expect(threadMutationServerClient.unarchiveThread("\n\t")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string",
    );
    await expect(threadMutationServerClient.forkThread("\n\t")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string",
    );
    await expect(
      threadMutationServerClient.forkThreadFromMessage("\n\t", "message-1"),
    ).rejects.toThrowError("ThreadMutationServerClient requires threadId to be a non-empty string");
    await expect(
      threadMutationServerClient.forkThreadFromMessage("thread-1", "\n\t"),
    ).rejects.toThrowError(
      "ThreadMutationServerClient requires messageId to be a non-empty string",
    );
    await expect(threadMutationServerClient.rollbackThread("\n\t", 1)).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string",
    );
    await expect(threadMutationServerClient.compactThread("\n\t")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string",
    );
    await expect(
      threadMutationServerClient.cleanThreadBackgroundTerminals("\n\t"),
    ).rejects.toThrowError("ThreadMutationServerClient requires threadId to be a non-empty string");
    await expect(threadMutationServerClient.startThreadReview("\n\t")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string",
    );
    await expect(threadMutationServerClient.setThreadName("", "name")).rejects.toThrowError(
      "ThreadMutationServerClient requires threadId to be a non-empty string",
    );
    expect(archiveThread).not.toHaveBeenCalled();
    expect(unarchiveThread).not.toHaveBeenCalled();
    expect(forkThread).not.toHaveBeenCalled();
    expect(forkThreadFromMessage).not.toHaveBeenCalled();
    expect(rollbackThread).not.toHaveBeenCalled();
    expect(compactThread).not.toHaveBeenCalled();
    expect(cleanThreadBackgroundTerminals).not.toHaveBeenCalled();
    expect(startThreadReview).not.toHaveBeenCalled();
    expect(setThreadName).not.toHaveBeenCalled();
  });
});
