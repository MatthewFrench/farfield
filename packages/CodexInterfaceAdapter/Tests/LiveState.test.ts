import { describe, expect, it } from "vitest";
import {
  parseThreadStreamStateChangedBroadcast,
  type ThreadConversationState,
  type ThreadStreamPatch
} from "@farfield/protocol";
import {
  applyStrictPatchSequence,
  applyTrustedPatchSequence,
  findLatestTurnParamsTemplate,
  reduceThreadStreamEvents,
  StrictPatchSequenceError,
  ThreadStreamReductionError
} from "../Source/LiveState.js";

type ConversationTurn = ThreadConversationState["turns"][number];
const STREAM_EVENT_VERSION = 4;

function createUserMessageTurn(itemIdentifier: string): ConversationTurn {
  return {
    status: "completed",
    items: [
      {
        id: itemIdentifier,
        type: "userMessage",
        content: [{ type: "text", text: itemIdentifier }]
      }
    ]
  };
}

function createSnapshotStreamEvent(input: {
  threadId: string;
  sourceClientId: string;
  turns: ThreadConversationState["turns"];
}) {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: "thread-stream-state-changed",
    sourceClientId: input.sourceClientId,
    version: STREAM_EVENT_VERSION,
    params: {
      conversationId: input.threadId,
      type: "thread-stream-state-changed",
      version: STREAM_EVENT_VERSION,
      change: {
        type: "snapshot",
        conversationState: {
          id: input.threadId,
          turns: input.turns,
          requests: []
        }
      }
    }
  });
}

function createPatchStreamEvent(input: {
  threadId: string;
  sourceClientId: string;
  patches: ThreadStreamPatch[];
}) {
  return parseThreadStreamStateChangedBroadcast({
    type: "broadcast",
    method: "thread-stream-state-changed",
    sourceClientId: input.sourceClientId,
    version: STREAM_EVENT_VERSION,
    params: {
      conversationId: input.threadId,
      type: "thread-stream-state-changed",
      version: STREAM_EVENT_VERSION,
      change: {
        type: "patches",
        patches: input.patches
      }
    }
  });
}

function createAppendTurnPatch(itemIdentifier: string): ThreadStreamPatch {
  return {
    op: "add",
    path: ["turns", "-"],
    value: createUserMessageTurn(itemIdentifier)
  };
}

describe("live-state reducer", () => {
  it("applies snapshot then patches", () => {
    const snapshotEvent = parseThreadStreamStateChangedBroadcast({
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

    const patchEvent = parseThreadStreamStateChangedBroadcast({
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

    const state = reduceThreadStreamEvents([snapshotEvent, patchEvent]);
    const thread = state.get("thread-1");

    expect(thread?.conversationState?.requests.length).toBe(1);
  });

  it("keeps reducer alive when patches arrive before snapshot", () => {
    const patchEvent = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-a",
      version: 4,
      params: {
        conversationId: "thread-2",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "patches",
          patches: [
            {
              op: "add",
              path: ["turns", 0],
              value: {
                status: "inProgress",
                items: []
              }
            }
          ]
        }
      }
    });

    const snapshotEvent = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-a",
      version: 4,
      params: {
        conversationId: "thread-2",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-2",
            turns: [],
            requests: []
          }
        }
      }
    });

    const state = reduceThreadStreamEvents([patchEvent, snapshotEvent]);
    const thread = state.get("thread-2");

    expect(thread?.conversationState?.id).toBe("thread-2");
    expect(thread?.conversationState?.turns.length).toBe(0);
    expect(thread?.ownerClientId).toBe("client-a");
  });

  it("resets thread state when a newer snapshot arrives after append patches", () => {
    const threadId = "thread-append-reset";
    const state = reduceThreadStreamEvents([
      createSnapshotStreamEvent({
        threadId,
        sourceClientId: "client-a",
        turns: [createUserMessageTurn("seed-turn")]
      }),
      createPatchStreamEvent({
        threadId,
        sourceClientId: "client-a",
        patches: [
          createAppendTurnPatch("appended-turn-1"),
          createAppendTurnPatch("appended-turn-2")
        ]
      }),
      createSnapshotStreamEvent({
        threadId,
        sourceClientId: "client-b",
        turns: [createUserMessageTurn("reset-base-turn")]
      }),
      createPatchStreamEvent({
        threadId,
        sourceClientId: "client-b",
        patches: [createAppendTurnPatch("post-reset-turn")]
      })
    ]);
    const thread = state.get(threadId);

    expect(thread?.conversationState?.turns.map((turn) => turn.items[0]?.id)).toEqual([
      "reset-base-turn",
      "post-reset-turn"
    ]);
    expect(thread?.ownerClientId).toBe("client-b");
  });

  it("throws reduction error with raw payload details when patch introduces invalid item type", () => {
    const snapshotEvent = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-a",
      version: 4,
      params: {
        conversationId: "thread-3",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-3",
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
    });

    const patchEvent = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-a",
      version: 4,
      params: {
        conversationId: "thread-3",
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

    let captured: ThreadStreamReductionError | null = null;
    try {
      reduceThreadStreamEvents([snapshotEvent, patchEvent]);
    } catch (error) {
      if (error instanceof ThreadStreamReductionError) {
        captured = error;
      } else {
        throw error;
      }
    }

    expect(captured).toBeInstanceOf(ThreadStreamReductionError);
    if (!captured) {
      throw new Error("Expected ThreadStreamReductionError");
    }
    const reductionError = captured;
    expect(reductionError.details.threadId).toBe("thread-3");
    expect(reductionError.details.eventIndex).toBe(1);
    expect(reductionError.details.patchIndex).toBe(0);
    expect(reductionError.details.event.params.conversationId).toBe("thread-3");
    expect(reductionError.details.patch.op).toBe("replace");
  });

  it("applies strict patch sequences with one end-state validation pass", () => {
    const sourceState = {
      id: "thread-sequence-1",
      turns: [
        {
          status: "completed",
          items: []
        }
      ],
      requests: []
    };

    const patchedState = applyStrictPatchSequence(sourceState, [
      {
        op: "add",
        path: ["requests", 0],
        value: {
          method: "item/tool/requestUserInput",
          id: 3,
          params: {
            threadId: "thread-sequence-1",
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
      },
      {
        op: "replace",
        path: ["turns", 0, "status"],
        value: "inProgress"
      }
    ]);

    expect(patchedState.requests.length).toBe(1);
    expect(patchedState.turns[0]?.status).toBe("inProgress");
  });

  it("reports failing patch index for strict patch sequences", () => {
    const sourceState = {
      id: "thread-sequence-2",
      turns: [
        {
          status: "completed",
          items: []
        }
      ],
      requests: []
    };

    let capturedError: StrictPatchSequenceError | null = null;
    try {
      applyStrictPatchSequence(sourceState, [
        {
          op: "replace",
          path: ["turns", 9, "status"],
          value: "inProgress"
        }
      ]);
    } catch (error) {
      if (error instanceof StrictPatchSequenceError) {
        capturedError = error;
      } else {
        throw error;
      }
    }

    expect(capturedError).toBeInstanceOf(StrictPatchSequenceError);
    if (!capturedError) {
      throw new Error("Expected StrictPatchSequenceError");
    }
    expect(capturedError.patchIndex).toBe(0);
  });

  it("localizes final-state validation failures to the first invalid patch index", () => {
    const sourceState = {
      id: "thread-sequence-3",
      turns: [
        {
          status: "completed",
          items: []
        }
      ],
      requests: []
    };

    let capturedError: StrictPatchSequenceError | null = null;
    try {
      applyStrictPatchSequence(sourceState, [
        {
          op: "replace",
          path: ["turns", 0, "status"],
          value: "completed"
        },
        {
          op: "remove",
          path: ["turns", 0, "items"]
        }
      ]);
    } catch (error) {
      if (error instanceof StrictPatchSequenceError) {
        capturedError = error;
      } else {
        throw error;
      }
    }

    expect(capturedError).toBeInstanceOf(StrictPatchSequenceError);
    if (!capturedError) {
      throw new Error("Expected StrictPatchSequenceError");
    }
    expect(capturedError.patchIndex).toBe(1);
    expect(capturedError.message).toContain("produced invalid conversation state at index 1");
  });

  it("applies large strict append sequences without mutating source state", () => {
    const appendPatchCount = 250;
    const sourceState = {
      id: "thread-large-strict",
      turns: [createUserMessageTurn("seed-turn")],
      requests: []
    };
    const patches = Array.from({ length: appendPatchCount }, (_value, index) =>
      createAppendTurnPatch(`strict-append-${String(index)}`)
    );

    const patchedState = applyStrictPatchSequence(sourceState, patches);

    expect(sourceState.turns).toHaveLength(1);
    expect(patchedState.turns).toHaveLength(appendPatchCount + 1);
    expect(patchedState.turns[1]?.items[0]?.id).toBe("strict-append-0");
    expect(patchedState.turns[appendPatchCount]?.items[0]?.id).toBe(
      `strict-append-${String(appendPatchCount - 1)}`
    );
  });

  it("applies trusted patch sequences for parsed stream patches", () => {
    const sourceState = {
      id: "thread-trusted-sequence-1",
      turns: [
        {
          status: "completed",
          items: []
        }
      ],
      requests: []
    };

    const patchedState = applyTrustedPatchSequence(sourceState, [
      {
        op: "replace",
        path: ["turns", 0, "status"],
        value: "inProgress"
      },
      {
        op: "add",
        path: ["requests", 0],
        value: {
          method: "item/tool/requestUserInput",
          id: 5,
          params: {
            threadId: "thread-trusted-sequence-1",
            turnId: "turn-2",
            itemId: "item-5",
            questions: [
              {
                id: "question-1",
                header: "Header",
                question: "Choose",
                isOther: false,
                isSecret: false,
                options: [
                  {
                    label: "Option",
                    description: "Description"
                  }
                ]
              }
            ]
          }
        }
      }
    ]);

    expect(patchedState.turns[0]?.status).toBe("inProgress");
    expect(patchedState.requests.length).toBe(1);
  });

  it("applies large trusted append sequences in place while preserving append order", () => {
    const appendPatchCount = 250;
    const sourceState = {
      id: "thread-large-trusted",
      turns: [createUserMessageTurn("seed-turn")],
      requests: []
    };
    const patches = Array.from({ length: appendPatchCount }, (_value, index) =>
      createAppendTurnPatch(`trusted-append-${String(index)}`)
    );

    const patchedState = applyTrustedPatchSequence(sourceState, patches);

    expect(sourceState.turns).toHaveLength(appendPatchCount + 1);
    expect(patchedState.turns).toHaveLength(appendPatchCount + 1);
    expect(sourceState.turns[1]?.items[0]?.id).toBe("trusted-append-0");
    expect(patchedState.turns[appendPatchCount]?.items[0]?.id).toBe(
      `trusted-append-${String(appendPatchCount - 1)}`
    );
  });

  it("supports append, remove, and index-shift patch application", () => {
    const sourceState = {
      id: "thread-trusted-sequence-3",
      turns: [
        {
          status: "completed",
          items: []
        }
      ],
      requests: []
    };

    const patchedState = applyTrustedPatchSequence(sourceState, [
      {
        op: "add",
        path: ["turns", "-"],
        value: {
          status: "completed",
          items: []
        }
      },
      {
        op: "remove",
        path: ["turns", 0]
      },
      {
        op: "replace",
        path: ["turns", 0, "status"],
        value: "inProgress"
      }
    ]);

    expect(patchedState.turns).toHaveLength(1);
    expect(patchedState.turns[0]?.status).toBe("inProgress");
  });

  it("reports trusted patch sequence errors when final state becomes invalid", () => {
    const sourceState = {
      id: "thread-trusted-sequence-2",
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
    };

    let capturedError: StrictPatchSequenceError | null = null;
    try {
      applyTrustedPatchSequence(sourceState, [
        {
          op: "replace",
          path: ["turns", 0, "items", 0],
          value: {
            id: "item-2",
            type: "newUnknownItemType"
          }
        }
      ]);
    } catch (error) {
      if (error instanceof StrictPatchSequenceError) {
        capturedError = error;
      } else {
        throw error;
      }
    }

    expect(capturedError).toBeInstanceOf(StrictPatchSequenceError);
    if (!capturedError) {
      throw new Error("Expected StrictPatchSequenceError");
    }
    expect(capturedError.patchIndex).toBe(0);
  });

  it("reports trusted final-state validation failures at the last applied patch index", () => {
    const sourceState = {
      id: "thread-trusted-sequence-4",
      turns: [
        {
          status: "completed",
          items: []
        }
      ],
      requests: []
    };

    let capturedError: StrictPatchSequenceError | null = null;
    try {
      applyTrustedPatchSequence(sourceState, [
        {
          op: "replace",
          path: ["turns", 0, "status"],
          value: "inProgress"
        },
        {
          op: "remove",
          path: ["turns", 0, "items"]
        }
      ]);
    } catch (error) {
      if (error instanceof StrictPatchSequenceError) {
        capturedError = error;
      } else {
        throw error;
      }
    }

    expect(capturedError).toBeInstanceOf(StrictPatchSequenceError);
    if (!capturedError) {
      throw new Error("Expected StrictPatchSequenceError");
    }
    expect(capturedError.patchIndex).toBe(1);
    expect(capturedError.message).toContain("produced invalid conversation state at index 1");
  });

  it("returns latest available turn params template", () => {
    const template = findLatestTurnParamsTemplate({
      id: "thread-template-1",
      turns: [
        {
          status: "completed",
          items: []
        },
        {
          params: {
            threadId: "thread-template-1",
            input: [{ type: "text", text: "latest prompt" }],
            attachments: []
          },
          status: "completed",
          items: []
        }
      ],
      requests: []
    });

    expect(template.threadId).toBe("thread-template-1");
    expect(template.input[0]?.type).toBe("text");
  });

  it("throws when no turn contains params for template extraction", () => {
    expect(() =>
      findLatestTurnParamsTemplate({
        id: "thread-template-2",
        turns: [
          {
            status: "completed",
            items: []
          }
        ],
        requests: []
      })
    ).toThrowError("No turn params template found in conversation state");
  });
});
