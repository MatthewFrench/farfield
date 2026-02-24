import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseThreadStreamStateChangedBroadcast, type IpcFrame } from "@farfield/protocol";
import { CodexThreadStreamStateOwner } from "../Source/Agents/Adapters/CodexThreadStreamStateOwner.js";

function createSnapshotEvent(): IpcFrame {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: "thread-stream-state-changed",
    sourceClientId: "client-a",
    version: 4,
    params: {
      conversationId: "thread-1",
      type: "thread-stream-state-changed",
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
                attachments: []
              },
              status: "completed",
              items: []
            }
          ],
          requests: []
        }
      }
    }
  });
}

function createPatchEvent(): IpcFrame {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: "thread-stream-state-changed",
    sourceClientId: "client-a",
    version: 4,
    params: {
      conversationId: "thread-1",
      type: "thread-stream-state-changed",
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
                          description: "A desc"
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  });
}

function createInvalidPatchEvent(): IpcFrame {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: "thread-stream-state-changed",
    sourceClientId: "client-a",
    version: 4,
    params: {
      conversationId: "thread-1",
      type: "thread-stream-state-changed",
      version: 4,
      change: {
        type: "patches",
        patches: [
          {
            op: "replace",
            path: ["turns", 0, "items", 0],
            value: {
              id: "item-2",
              type: "newUnknownItemType"
            }
          }
        ]
      }
    }
  });
}

describe("CodexThreadStreamStateOwner", () => {
  it("describes and ingests stream events under owner boundaries", () => {
    const owner = new CodexThreadStreamStateOwner();
    const requestFrame: IpcFrame = {
      type: "request",
      requestId: "request-1",
      method: "thread-read",
      params: {
        threadId: "thread-1"
      }
    };

    const frameDescription = owner.describeFrame(requestFrame);
    expect(frameDescription.method).toBe("thread-read");
    expect(frameDescription.threadId).toBe("thread-1");

    owner.ingestInboundFrame(createSnapshotEvent());
    owner.ingestInboundFrame(createPatchEvent());

    expect(owner.getThreadOwnerCount()).toBe(1);
    expect(owner.resolveKnownOwnerClientId("thread-1", null)).toBe("client-a");
    expect(owner.resolveRequiredOwnerClientId("thread-1", null)).toBe("client-a");
    expect(owner.readStreamEvents("thread-1", 1).events.length).toBe(1);
    expect(owner.readLiveState("thread-1").conversationState?.requests.length).toBe(1);
  });

  it("stores reduction errors when patch application fails", () => {
    const owner = new CodexThreadStreamStateOwner();
    owner.ingestInboundFrame(parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-a",
      version: 4,
      params: {
        conversationId: "thread-1",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-1",
            turns: [
              {
                status: "completed",
                items: [
                  {
                    id: "item-1",
                    type: "userMessage",
                    content: [{ type: "text", text: "hello" }]
                  }
                ]
              }
            ],
            requests: []
          }
        }
      }
    }));

    owner.ingestInboundFrame(createInvalidPatchEvent());
    const projectedState = owner.readLiveState("thread-1");
    expect(projectedState.conversationState).toBeNull();
    expect(projectedState.liveStateError?.kind).toBe("reductionFailed");
    expect(projectedState.liveStateError?.patchIndex).toBe(0);
  });

  it("writes malformed stream events to the invalid-event detail log", () => {
    const logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-stream-owner-test-"));
    const invalidStreamEventsLogPath = path.join(logDirectory, "invalid-stream-events.ndjson");
    const owner = new CodexThreadStreamStateOwner({
      invalidStreamEventsLogPath
    });

    const malformedFrame: IpcFrame = {
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-a",
      version: 4,
      params: {}
    };
    owner.ingestInboundFrame(malformedFrame);

    expect(fs.existsSync(invalidStreamEventsLogPath)).toBe(true);
    const content = fs.readFileSync(invalidStreamEventsLogPath, "utf8").trim();
    expect(content.length > 0).toBe(true);
    expect(content.includes("\"thread-stream-state-changed\"")).toBe(true);
    expect(content.includes("\"error\"")).toBe(true);
  });
});
