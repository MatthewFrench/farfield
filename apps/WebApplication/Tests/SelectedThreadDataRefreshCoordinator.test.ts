import { describe, expect, it, vi } from "vitest";
import type { SelectedThreadDataRefreshChatClient } from "../Source/Features/Chat/StateManagement/SelectedThreadDataRefreshCoordinator";
import {
  SelectedThreadDataRefreshCoordinator,
  type SelectedThreadLiveStateSnapshot,
  type SelectedThreadReadThreadSnapshot,
  type SelectedThreadStreamEventsSnapshot,
} from "../Source/Features/Chat/StateManagement/SelectedThreadDataRefreshCoordinator";

function buildLiveStateSnapshot(
  threadId: string,
  conversationState: SelectedThreadLiveStateSnapshot["conversationState"],
): SelectedThreadLiveStateSnapshot {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    conversationState,
    liveStateError: null,
  };
}

function buildStreamEventsSnapshot(threadId: string): SelectedThreadStreamEventsSnapshot {
  return {
    ok: true,
    threadId,
    ownerClientId: null,
    events: [],
    nextSequence: 0,
    firstAvailableSequence: 0,
    resetRequired: false,
  };
}

function buildReadThreadSnapshot(
  threadId: string,
  turns: SelectedThreadReadThreadSnapshot["thread"]["turns"],
): SelectedThreadReadThreadSnapshot {
  return {
    ok: true,
    thread: {
      id: threadId,
      turns,
      requests: [],
      updatedAt: 1_700_000_000,
      latestModel: "gpt-5.3-codex",
      latestReasoningEffort: "medium",
      latestCollaborationMode: {
        mode: "default",
        settings: {
          model: "gpt-5.3-codex",
          reasoning_effort: "medium",
          developer_instructions: null,
        },
      },
    },
    agentId: "codex",
  };
}

function createChatClient(
  overrides?: Partial<SelectedThreadDataRefreshChatClient>,
): SelectedThreadDataRefreshChatClient {
  return {
    readThread:
      overrides?.readThread ??
      vi.fn(async (threadId: string) => buildReadThreadSnapshot(threadId, [])),
    readLiveState:
      overrides?.readLiveState ??
      vi.fn(async (threadId: string) => buildLiveStateSnapshot(threadId, null)),
    readStreamEvents:
      overrides?.readStreamEvents ??
      vi.fn(async (threadId: string) => buildStreamEventsSnapshot(threadId)),
  };
}

describe("SelectedThreadDataRefreshCoordinator", () => {
  it("reads live state, stream events, and read-thread snapshot when capabilities allow", async () => {
    const coordinator = new SelectedThreadDataRefreshCoordinator();
    const chatClient = createChatClient({
      readLiveState: vi.fn(async (threadId: string) =>
        buildLiveStateSnapshot(threadId, {
          id: threadId,
          turns: [
            {
              id: "turn-live-1",
              status: "completed",
              items: [],
            },
          ],
          requests: [],
          updatedAt: 1_700_000_000,
          latestModel: "gpt-5.3-codex",
          latestReasoningEffort: "medium",
          latestCollaborationMode: {
            mode: "default",
            settings: {
              model: "gpt-5.3-codex",
              reasoning_effort: "medium",
              developer_instructions: null,
            },
          },
        }),
      ),
      readThread: vi.fn(async (threadId: string) =>
        buildReadThreadSnapshot(threadId, [
          {
            id: "turn-read-1",
            status: "completed",
            items: [],
          },
        ]),
      ),
      readStreamEvents: vi.fn(async (threadId: string) => buildStreamEventsSnapshot(threadId)),
    });

    const snapshot = await coordinator.readSnapshot({
      threadId: "thread-1",
      includeTurns: true,
      includeReadThread: true,
      canReadLiveState: true,
      canReadStreamEvents: true,
      streamEventsSinceSequence: null,
      chatClient,
    });

    expect(chatClient.readLiveState).toHaveBeenCalledWith("thread-1");
    expect(chatClient.readStreamEvents).toHaveBeenCalledWith("thread-1", {});
    expect(chatClient.readThread).toHaveBeenCalledWith("thread-1", { includeTurns: true });
    expect(snapshot.readThreadSnapshot).not.toBeNull();
    expect(snapshot.includeTurnsUsedForRead).toBe(true);
    expect(snapshot.containsAnyTurns).toBe(true);
  });

  it("retries transient read-thread errors and forces includeTurns on retry", async () => {
    const waitDurations: number[] = [];
    const coordinator = new SelectedThreadDataRefreshCoordinator({
      retryConfiguration: {
        maximumAttempts: 3,
        baseDelayMilliseconds: 10,
        maximumDelayMilliseconds: 40,
      },
      waitForMilliseconds: async (durationMilliseconds) => {
        waitDurations.push(durationMilliseconds);
      },
    });
    const readThreadCalls: boolean[] = [];
    const chatClient = createChatClient({
      readThread: vi.fn(async (threadId: string, options) => {
        readThreadCalls.push(options?.includeTurns === true);
        if (readThreadCalls.length === 1) {
          throw new Error("thread not loaded in app-server");
        }
        return buildReadThreadSnapshot(threadId, [
          {
            id: "turn-read-2",
            status: "completed",
            items: [],
          },
        ]);
      }),
      readLiveState: vi.fn(async (threadId: string) => buildLiveStateSnapshot(threadId, null)),
      readStreamEvents: vi.fn(async (threadId: string) => buildStreamEventsSnapshot(threadId)),
    });

    const snapshot = await coordinator.readSnapshot({
      threadId: "thread-2",
      includeTurns: false,
      includeReadThread: true,
      canReadLiveState: false,
      canReadStreamEvents: false,
      streamEventsSinceSequence: null,
      chatClient,
    });

    expect(readThreadCalls).toEqual([false, true]);
    expect(waitDurations).toEqual([10]);
    expect(snapshot.includeTurnsUsedForRead).toBe(true);
    expect(snapshot.containsAnyTurns).toBe(true);
  });

  it("caps retry delay growth at configured maximum across repeated transient retries", async () => {
    const waitDurations: number[] = [];
    const coordinator = new SelectedThreadDataRefreshCoordinator({
      retryConfiguration: {
        maximumAttempts: 4,
        baseDelayMilliseconds: 10,
        maximumDelayMilliseconds: 25,
      },
      waitForMilliseconds: async (durationMilliseconds) => {
        waitDurations.push(durationMilliseconds);
      },
    });
    const readThreadCalls: boolean[] = [];
    const chatClient = createChatClient({
      readThread: vi.fn(async (threadId: string, options) => {
        readThreadCalls.push(options?.includeTurns === true);
        if (readThreadCalls.length < 4) {
          throw new Error("thread not loaded in app-server");
        }
        return buildReadThreadSnapshot(threadId, []);
      }),
    });

    const snapshot = await coordinator.readSnapshot({
      threadId: "thread-2a",
      includeTurns: false,
      includeReadThread: true,
      canReadLiveState: false,
      canReadStreamEvents: false,
      streamEventsSinceSequence: null,
      chatClient,
    });

    expect(waitDurations).toEqual([10, 20, 25]);
    expect(readThreadCalls).toEqual([false, true, true, true]);
    expect(snapshot.includeTurnsUsedForRead).toBe(true);
  });

  it("returns deterministic default snapshots when capabilities do not allow reads", async () => {
    const coordinator = new SelectedThreadDataRefreshCoordinator();
    const chatClient = createChatClient();

    const snapshot = await coordinator.readSnapshot({
      threadId: "thread-3",
      includeTurns: false,
      includeReadThread: false,
      canReadLiveState: false,
      canReadStreamEvents: false,
      streamEventsSinceSequence: null,
      chatClient,
    });

    expect(chatClient.readLiveState).not.toHaveBeenCalled();
    expect(chatClient.readStreamEvents).not.toHaveBeenCalled();
    expect(chatClient.readThread).not.toHaveBeenCalled();
    expect(snapshot.liveStateSnapshot).toEqual({
      ok: true,
      threadId: "thread-3",
      ownerClientId: null,
      conversationState: null,
      liveStateError: null,
    });
    expect(snapshot.streamEventsSnapshot).toEqual({
      ok: true,
      threadId: "thread-3",
      ownerClientId: null,
      events: [],
      nextSequence: 0,
      firstAvailableSequence: 0,
      resetRequired: false,
    });
    expect(snapshot.readThreadSnapshot).toBeNull();
    expect(snapshot.includeTurnsUsedForRead).toBe(false);
    expect(snapshot.containsAnyTurns).toBe(false);
  });

  it("preserves requested includeTurns value when read-thread snapshots are disabled", async () => {
    const coordinator = new SelectedThreadDataRefreshCoordinator();
    const chatClient = createChatClient();

    const snapshot = await coordinator.readSnapshot({
      threadId: "thread-3a",
      includeTurns: true,
      includeReadThread: false,
      canReadLiveState: false,
      canReadStreamEvents: false,
      streamEventsSinceSequence: null,
      chatClient,
    });

    expect(snapshot.readThreadSnapshot).toBeNull();
    expect(snapshot.includeTurnsUsedForRead).toBe(true);
  });

  it("passes stream event cursor options to stream-event reads", async () => {
    const coordinator = new SelectedThreadDataRefreshCoordinator();
    const chatClient = createChatClient({
      readLiveState: vi.fn(async (threadId: string) => buildLiveStateSnapshot(threadId, null)),
      readStreamEvents: vi.fn(async (threadId: string) => buildStreamEventsSnapshot(threadId)),
    });

    await coordinator.readSnapshot({
      threadId: "thread-5",
      includeTurns: false,
      includeReadThread: false,
      canReadLiveState: true,
      canReadStreamEvents: true,
      streamEventsSinceSequence: 44,
      chatClient,
    });

    expect(chatClient.readStreamEvents).toHaveBeenCalledWith("thread-5", {
      sinceSequence: 44,
    });
  });

  it("passes abort signals to live-state, stream-events, and read-thread reads", async () => {
    const coordinator = new SelectedThreadDataRefreshCoordinator();
    const abortController = new AbortController();
    const chatClient = createChatClient({
      readThread: vi.fn(async (threadId: string) => buildReadThreadSnapshot(threadId, [])),
      readLiveState: vi.fn(async (threadId: string) => buildLiveStateSnapshot(threadId, null)),
      readStreamEvents: vi.fn(async (threadId: string) => buildStreamEventsSnapshot(threadId)),
    });

    await coordinator.readSnapshot({
      threadId: "thread-6",
      includeTurns: false,
      includeReadThread: true,
      canReadLiveState: true,
      canReadStreamEvents: true,
      streamEventsSinceSequence: null,
      chatClient,
      signal: abortController.signal,
    });

    expect(chatClient.readLiveState).toHaveBeenCalledWith("thread-6", {
      signal: abortController.signal,
    });
    expect(chatClient.readStreamEvents).toHaveBeenCalledWith("thread-6", {
      signal: abortController.signal,
    });
    expect(chatClient.readThread).toHaveBeenCalledWith("thread-6", {
      includeTurns: false,
      signal: abortController.signal,
    });
  });

  it("passes both stream cursor and abort signal to stream-event reads", async () => {
    const coordinator = new SelectedThreadDataRefreshCoordinator();
    const abortController = new AbortController();
    const chatClient = createChatClient({
      readLiveState: vi.fn(async (threadId: string) => buildLiveStateSnapshot(threadId, null)),
      readStreamEvents: vi.fn(async (threadId: string) => buildStreamEventsSnapshot(threadId)),
    });

    await coordinator.readSnapshot({
      threadId: "thread-7",
      includeTurns: false,
      includeReadThread: false,
      canReadLiveState: true,
      canReadStreamEvents: true,
      streamEventsSinceSequence: 9,
      chatClient,
      signal: abortController.signal,
    });

    expect(chatClient.readStreamEvents).toHaveBeenCalledWith("thread-7", {
      sinceSequence: 9,
      signal: abortController.signal,
    });
  });

  it("throws non-transient read-thread errors without retrying", async () => {
    const waitDurations: number[] = [];
    const coordinator = new SelectedThreadDataRefreshCoordinator({
      waitForMilliseconds: async (durationMilliseconds) => {
        waitDurations.push(durationMilliseconds);
      },
    });
    const chatClient = createChatClient({
      readThread: vi.fn(async () => {
        throw new Error("permission denied");
      }),
    });

    await expect(
      coordinator.readSnapshot({
        threadId: "thread-4",
        includeTurns: false,
        includeReadThread: true,
        canReadLiveState: false,
        canReadStreamEvents: false,
        streamEventsSinceSequence: null,
        chatClient,
      }),
    ).rejects.toThrow("permission denied");

    expect(chatClient.readThread).toHaveBeenCalledTimes(1);
    expect(waitDurations).toEqual([]);
  });
});
