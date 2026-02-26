import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../Source/Features/Chat/DataAccess/ChatApi", () => ({
  getLiveState: vi.fn(),
  getStreamEvents: vi.fn(),
  interruptThread: vi.fn(),
  readThread: vi.fn(),
  sendMessage: vi.fn(),
  setCollaborationMode: vi.fn(),
  submitUserInput: vi.fn()
}));

import {
  getLiveState,
  getStreamEvents,
  interruptThread,
  readThread,
  sendMessage,
  setCollaborationMode,
  submitUserInput
} from "../Source/Features/Chat/DataAccess/ChatApi";
import {
  ChatServerClient,
  type ChatLiveStateResponse,
  type ChatReadThreadResponse,
  type ChatStreamEventsResponse
} from "../Source/Features/Chat/DataAccess/ChatServerClient";

function createReadThreadSnapshot(): ChatReadThreadResponse {
  return {
    ok: true,
    thread: {
      id: "thread-1",
      turns: [],
      requests: [],
      updatedAt: 1_700_000_000,
      latestModel: "gpt-5.3-codex",
      latestReasoningEffort: "medium",
      latestCollaborationMode: {
        mode: "default",
        settings: {
          model: "gpt-5.3-codex",
          reasoning_effort: "medium",
          developer_instructions: null
        }
      }
    },
    agentId: "codex"
  };
}

function createLiveStateSnapshot(): ChatLiveStateResponse {
  return {
    ok: true,
    threadId: "thread-1",
    ownerClientId: null,
    conversationState: null,
    liveStateError: null
  };
}

function createStreamEventsSnapshot(): ChatStreamEventsResponse {
  return {
    ok: true,
    threadId: "thread-1",
    ownerClientId: null,
    events: [],
    nextSequence: 20,
    firstAvailableSequence: 0,
    resetRequired: false
  };
}

describe("ChatServerClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readThread).mockResolvedValue(createReadThreadSnapshot());
    vi.mocked(getLiveState).mockResolvedValue(createLiveStateSnapshot());
    vi.mocked(getStreamEvents).mockResolvedValue(createStreamEventsSnapshot());
    vi.mocked(sendMessage).mockResolvedValue();
    vi.mocked(setCollaborationMode).mockResolvedValue();
    vi.mocked(submitUserInput).mockResolvedValue();
    vi.mocked(interruptThread).mockResolvedValue();
  });

  it("delegates read calls to ChatApi and returns typed snapshots", async () => {
    const chatServerClient = new ChatServerClient();

    const readThreadSnapshot = await chatServerClient.readThread("thread-1", { includeTurns: true });
    const liveStateSnapshot = await chatServerClient.readLiveState("thread-1");
    const streamEventsSnapshot = await chatServerClient.readStreamEvents("thread-1", { sinceSequence: 10 });

    expect(readThread).toHaveBeenCalledWith("thread-1", { includeTurns: true });
    expect(getLiveState).toHaveBeenCalledWith("thread-1", undefined);
    expect(getStreamEvents).toHaveBeenCalledWith("thread-1", { sinceSequence: 10 });
    expect(readThreadSnapshot["ok"]).toBe(true);
    expect(liveStateSnapshot["ok"]).toBe(true);
    expect(streamEventsSnapshot["ok"]).toBe(true);
  });

  it("delegates mutation calls to ChatApi", async () => {
    const chatServerClient = new ChatServerClient();

    await chatServerClient.sendMessage({
      threadId: "thread-1",
      ownerClientId: "client-1",
      text: "Hello"
    });
    await chatServerClient.setCollaborationMode({
      threadId: "thread-1",
      collaborationMode: {
        mode: "default",
        settings: {
          model: "gpt-5.3-codex",
          reasoning_effort: "medium",
          developer_instructions: null
        }
      }
    });
    await chatServerClient.submitUserInput({
      threadId: "thread-1",
      requestId: 12,
      response: {
        answers: {
          "question-1": {
            answers: ["option-1"]
          }
        }
      }
    });
    await chatServerClient.interruptThread({
      threadId: "thread-1"
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(setCollaborationMode).toHaveBeenCalledTimes(1);
    expect(submitUserInput).toHaveBeenCalledTimes(1);
    expect(interruptThread).toHaveBeenCalledTimes(1);
  });
});
