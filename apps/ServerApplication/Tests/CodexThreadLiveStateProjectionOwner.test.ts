import { type IpcFrame, parseThreadStreamStateChangedBroadcast } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { CodexThreadLiveStateProjectionOwner } from "../Source/Agents/Adapters/CodexThreadLiveStateProjectionOwner.js";
import { THREAD_STREAM_STATE_CHANGED_METHOD } from "../Source/Agents/ThreadStreamStateChangedContract.js";

function createSnapshotEvent(): IpcFrame {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: THREAD_STREAM_STATE_CHANGED_METHOD,
    sourceClientId: "client-a",
    version: 4,
    params: {
      conversationId: "thread-1",
      type: THREAD_STREAM_STATE_CHANGED_METHOD,
      version: 4,
      change: {
        type: "snapshot",
        conversationState: {
          id: "thread-1",
          turns: [
            {
              params: {
                threadId: "thread-1",
                input: [{ type: "text", text: "hello" }],
                attachments: [],
              },
              status: "completed",
              items: [],
            },
          ],
          requests: [],
        },
      },
    },
  });
}

function createPatchEvent(): IpcFrame {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: THREAD_STREAM_STATE_CHANGED_METHOD,
    sourceClientId: "client-a",
    version: 4,
    params: {
      conversationId: "thread-1",
      type: THREAD_STREAM_STATE_CHANGED_METHOD,
      version: 4,
      change: {
        type: "patches",
        patches: [
          {
            op: "replace",
            path: ["requests"],
            value: [
              {
                method: "item/tool/requestUserInput",
                id: 3,
                params: {
                  threadId: "thread-1",
                  turnId: "turn-2",
                  itemId: "item-9",
                  questions: [
                    {
                      id: "q1",
                      header: "Header",
                      question: "Choose",
                      isOther: true,
                      isSecret: false,
                      options: [
                        {
                          label: "A",
                          description: "A desc",
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  });
}

function createInvalidPatchEvent(): IpcFrame {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: THREAD_STREAM_STATE_CHANGED_METHOD,
    sourceClientId: "client-a",
    version: 4,
    params: {
      conversationId: "thread-1",
      type: THREAD_STREAM_STATE_CHANGED_METHOD,
      version: 4,
      change: {
        type: "patches",
        patches: [
          {
            op: "replace",
            path: ["turns", 0, "items", 0],
            value: {
              id: "item-2",
              type: "newUnknownItemType",
            },
          },
        ],
      },
    },
  });
}

describe("CodexThreadLiveStateProjectionOwner", () => {
  it("applies snapshot and patch events to projected conversation state", () => {
    const owner = new CodexThreadLiveStateProjectionOwner();

    owner.projectEvent(createSnapshotEvent(), 0, new Map<string, string>());
    owner.projectEvent(createPatchEvent(), 1, new Map<string, string>());

    const projection = owner.readLiveState("thread-1", null);
    expect(projection.ownerClientId).toBe("client-a");
    expect(projection.liveStateError).toBeNull();
    expect(projection.conversationState?.requests.length).toBe(1);
  });

  it("keeps projection empty when patches arrive before baseline snapshot", () => {
    const owner = new CodexThreadLiveStateProjectionOwner();

    owner.projectEvent(createPatchEvent(), 0, new Map<string, string>());

    const projection = owner.readLiveState("thread-1", null);
    expect(projection.ownerClientId).toBe("client-a");
    expect(projection.conversationState).toBeNull();
    expect(projection.liveStateError).toBeNull();
  });

  it("stores reduction failure localization when patch application fails", () => {
    const owner = new CodexThreadLiveStateProjectionOwner();

    owner.projectEvent(createSnapshotEvent(), 0, new Map<string, string>());
    owner.projectEvent(createInvalidPatchEvent(), 1, new Map<string, string>());

    const projection = owner.readLiveState("thread-1", null);
    expect(projection.conversationState).toBeNull();
    expect(projection.liveStateError?.kind).toBe("reductionFailed");
    expect(projection.liveStateError?.eventIndex).toBe(1);
    expect(projection.liveStateError?.patchIndex).toBe(0);
  });

  it("returns owner fallback for unseen threads", () => {
    const owner = new CodexThreadLiveStateProjectionOwner();

    const projection = owner.readLiveState("unknown-thread", "owner-client");

    expect(projection.ownerClientId).toBe("owner-client");
    expect(projection.conversationState).toBeNull();
    expect(projection.liveStateError).toBeNull();
  });
});
