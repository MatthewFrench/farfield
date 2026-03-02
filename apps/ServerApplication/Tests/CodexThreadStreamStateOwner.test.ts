import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { type IpcFrame, parseThreadStreamStateChangedBroadcast } from "@farfield/protocol";
import { describe, expect, it } from "vitest";
import { CodexThreadStreamStateOwner } from "../Source/Agents/Adapters/CodexThreadStreamStateOwner.js";
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

describe("CodexThreadStreamStateOwner", () => {
  it("describes and ingests stream events under owner boundaries", () => {
    const owner = new CodexThreadStreamStateOwner();
    const requestFrame: IpcFrame = {
      type: "request",
      requestId: "request-1",
      method: "thread-read",
      params: {
        conversationId: " thread-1 ",
        threadId: "thread-2",
      },
    };

    const frameDescription = owner.describeFrame(requestFrame);
    expect(frameDescription.method).toBe("thread-read");
    expect(frameDescription.threadId).toBe("thread-1");

    owner.ingestInboundFrame(createSnapshotEvent());
    owner.ingestInboundFrame(createPatchEvent());

    expect(owner.getThreadOwnerCount()).toBe(1);
    expect(owner.resolveKnownOwnerClientId("thread-1", null)).toBe("client-a");
    expect(owner.resolveRequiredOwnerClientId("thread-1", null)).toBe("client-a");
    expect(
      owner.readStreamEvents("thread-1", {
        limit: 1,
        sinceSequence: null,
      }).events.length,
    ).toBe(1);
    expect(owner.readLiveState("thread-1").conversationState?.requests.length).toBe(1);
  });

  it("uses stable frame method descriptions for response and discovery frames", () => {
    const owner = new CodexThreadStreamStateOwner();
    const responseFrame: IpcFrame = {
      type: "response",
      requestId: "request-1",
      resultType: "success",
    };
    const discoveryRequestFrame: IpcFrame = {
      type: "client-discovery-request",
      requestId: "request-2",
      request: {
        type: "request",
        requestId: "request-3",
        method: "thread-read",
      },
    };

    expect(owner.describeFrame(responseFrame).method).toBe("response");
    expect(owner.describeFrame(discoveryRequestFrame).method).toBe("client-discovery-request");
  });

  it("stores reduction errors when patch application fails", () => {
    const owner = new CodexThreadStreamStateOwner();
    owner.ingestInboundFrame(
      parseThreadStreamStateChangedBroadcast({
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
                  status: "completed",
                  items: [
                    {
                      id: "item-1",
                      type: "userMessage",
                      content: [{ type: "text", text: "hello" }],
                    },
                  ],
                },
              ],
              requests: [],
            },
          },
        },
      }),
    );

    owner.ingestInboundFrame(createInvalidPatchEvent());
    const projectedState = owner.readLiveState("thread-1");
    expect(projectedState.conversationState).toBeNull();
    expect(projectedState.liveStateError?.kind).toBe("reductionFailed");
    expect(projectedState.liveStateError?.eventIndex).toBe(1);
    expect(projectedState.liveStateError?.patchIndex).toBe(0);
  });

  it("keeps projection empty when patches arrive before a snapshot baseline", () => {
    const owner = new CodexThreadStreamStateOwner();

    owner.ingestInboundFrame(createPatchEvent());
    const projectedState = owner.readLiveState("thread-1");

    expect(projectedState.ownerClientId).toBe("client-a");
    expect(projectedState.conversationState).toBeNull();
    expect(projectedState.liveStateError).toBeNull();
  });

  it("clears reduction errors after a replacement snapshot arrives", () => {
    const owner = new CodexThreadStreamStateOwner();
    owner.ingestInboundFrame(createSnapshotEvent());
    owner.ingestInboundFrame(createInvalidPatchEvent());

    const failedState = owner.readLiveState("thread-1");
    expect(failedState.liveStateError?.kind).toBe("reductionFailed");

    owner.ingestInboundFrame(createSnapshotEvent());
    const recoveredState = owner.readLiveState("thread-1");
    expect(recoveredState.liveStateError).toBeNull();
    expect(recoveredState.conversationState?.id).toBe("thread-1");
    expect(recoveredState.conversationState?.requests.length).toBe(0);
  });

  it("returns sequence metadata and incremental stream slices for cursor-based reads", () => {
    const owner = new CodexThreadStreamStateOwner();
    owner.ingestInboundFrame(createSnapshotEvent());
    owner.ingestInboundFrame(createPatchEvent());

    const fullSlice = owner.readStreamEvents("thread-1", {
      limit: 80,
      sinceSequence: null,
    });
    expect(fullSlice.resetRequired).toBe(false);
    expect(fullSlice.firstAvailableSequence).toBe(0);
    expect(fullSlice.nextSequence).toBe(2);
    expect(fullSlice.events.length).toBe(2);

    const incrementalSlice = owner.readStreamEvents("thread-1", {
      limit: 80,
      sinceSequence: 0,
    });
    expect(incrementalSlice.resetRequired).toBe(false);
    expect(incrementalSlice.events.length).toBe(1);

    const noChangeSlice = owner.readStreamEvents("thread-1", {
      limit: 80,
      sinceSequence: 1,
    });
    expect(noChangeSlice.resetRequired).toBe(false);
    expect(noChangeSlice.events.length).toBe(0);
  });

  it("marks stream reads for reset when cursor history has been evicted", () => {
    const owner = new CodexThreadStreamStateOwner({
      streamEventLimit: 40,
    });
    owner.ingestInboundFrame(createSnapshotEvent());
    for (let eventIndex = 0; eventIndex < 50; eventIndex += 1) {
      owner.ingestInboundFrame(createPatchEvent());
    }

    const staleCursorSlice = owner.readStreamEvents("thread-1", {
      limit: 20,
      sinceSequence: 0,
    });
    expect(staleCursorSlice.resetRequired).toBe(true);
    expect(staleCursorSlice.firstAvailableSequence).toBeGreaterThan(0);
    expect(staleCursorSlice.events.length).toBe(20);
  });

  it("keeps reduction event indexes monotonic after retained history eviction", () => {
    const streamEventLimit = 40;
    const patchEventCountBeforeFailure = 50;
    const snapshotSequenceCount = 1;
    const expectedFailureEventIndex = snapshotSequenceCount + patchEventCountBeforeFailure;
    const owner = new CodexThreadStreamStateOwner({
      streamEventLimit,
    });
    owner.ingestInboundFrame(createSnapshotEvent());
    for (let eventIndex = 0; eventIndex < patchEventCountBeforeFailure; eventIndex += 1) {
      owner.ingestInboundFrame(createPatchEvent());
    }

    owner.ingestInboundFrame(createInvalidPatchEvent());
    const projectedState = owner.readLiveState("thread-1");
    expect(projectedState.liveStateError?.kind).toBe("reductionFailed");
    expect(projectedState.liveStateError?.eventIndex).toBe(expectedFailureEventIndex);
    expect(projectedState.liveStateError?.patchIndex).toBe(0);
  });

  it("writes malformed stream events to the invalid-event detail log", () => {
    const logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-stream-owner-test-"));
    const invalidStreamEventsLogPath = path.join(logDirectory, "invalid-stream-events.ndjson");
    const owner = new CodexThreadStreamStateOwner({
      invalidStreamEventsLogPath,
    });

    const malformedFrame: IpcFrame = {
      type: "broadcast",
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      sourceClientId: "client-a",
      version: 4,
      params: {},
    };
    owner.ingestInboundFrame(malformedFrame);

    expect(fs.existsSync(invalidStreamEventsLogPath)).toBe(true);
    const content = fs.readFileSync(invalidStreamEventsLogPath, "utf8").trim();
    expect(content.length > 0).toBe(true);
    expect(content.includes(`"${THREAD_STREAM_STATE_CHANGED_METHOD}"`)).toBe(true);
    expect(content.includes('"threadId"')).toBe(true);
    expect(content.includes('"error"')).toBe(true);
  });

  it("creates missing parent directories for invalid-event detail logs", () => {
    const logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-stream-owner-nested-test-"));
    const invalidStreamEventsLogPath = path.join(
      logDirectory,
      "nested",
      "logs",
      "invalid-stream-events.ndjson",
    );
    const owner = new CodexThreadStreamStateOwner({
      invalidStreamEventsLogPath,
    });

    const malformedFrame: IpcFrame = {
      type: "broadcast",
      method: THREAD_STREAM_STATE_CHANGED_METHOD,
      sourceClientId: "client-a",
      version: 4,
      params: {},
    };
    owner.ingestInboundFrame(malformedFrame);

    expect(fs.existsSync(invalidStreamEventsLogPath)).toBe(true);
  });

  it("reduces high patch volumes without entering reduction-failure state", () => {
    const owner = new CodexThreadStreamStateOwner();
    const patchCount = 1000;
    owner.ingestInboundFrame(createSnapshotEvent());
    const highPatchVolumeBudgetMilliseconds = 6_000;

    const startedAtMilliseconds = performance.now();
    for (let patchIndex = 0; patchIndex < patchCount; patchIndex += 1) {
      owner.ingestInboundFrame(createPatchEvent());
    }
    const elapsedMilliseconds = performance.now() - startedAtMilliseconds;

    const projectedState = owner.readLiveState("thread-1");
    expect(projectedState.liveStateError).toBeNull();
    expect(projectedState.conversationState?.requests.length).toBe(1);
    expect(elapsedMilliseconds).toBeLessThan(highPatchVolumeBudgetMilliseconds);
  });

  it("rejects non-positive stream event limits", () => {
    expect(
      () =>
        new CodexThreadStreamStateOwner({
          streamEventLimit: 0,
        }),
    ).toThrow("streamEventLimit must be a positive integer");
  });
});
