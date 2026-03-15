import { describe, expect, it } from "vitest";
import {
  readForkThreadFromMessageRollbackCount,
  ThreadForkFromMessageRollbackCountError,
} from "../Source/Modules/Threads/ThreadForkFromMessageRollbackCount.js";

describe("readForkThreadFromMessageRollbackCount", () => {
  it("returns the number of turns after the matched message turn", () => {
    const rollbackCount = readForkThreadFromMessageRollbackCount(
      {
        id: "thread-1",
        turns: [
          {
            status: "completed",
            items: [
              {
                id: "message-1",
                type: "userMessage",
                content: [{ type: "text", text: "First" }],
              },
            ],
          },
          {
            status: "completed",
            items: [
              {
                id: "message-2",
                type: "agentMessage",
                text: "Second",
              },
            ],
          },
          {
            status: "completed",
            items: [
              {
                id: "message-3",
                type: "agentMessage",
                text: "Third",
              },
            ],
          },
        ],
        requests: [],
      },
      "message-2",
    );

    expect(rollbackCount).toBe(1);
  });

  it("fails when the message is absent", () => {
    expect(() =>
      readForkThreadFromMessageRollbackCount(
        {
          id: "thread-1",
          turns: [],
          requests: [],
        },
        "missing-message",
      ),
    ).toThrowError(ThreadForkFromMessageRollbackCountError);
  });
});
