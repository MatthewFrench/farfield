import { describe, expect, it } from "vitest";
import { readRunningTerminalCount } from "../Source/Features/Chat/DomainModel/RunningTerminalCountSelector";

function createConversationState(
  turns: Array<{
    id: string;
    status: string;
    items: Array<
      | {
          type: "agentMessage";
          id: string;
          text: string;
        }
      | {
          type: "commandExecution";
          id: string;
          command: string;
          status: string;
          processId?: string;
        }
    >;
  }>,
) {
  return {
    id: "thread-1",
    turns,
    requests: [],
  };
}

describe("readRunningTerminalCount", () => {
  it("returns zero when conversation state is not available", () => {
    expect(readRunningTerminalCount(null)).toBe(0);
  });

  it("counts command-execution items that are still running", () => {
    const conversationState = createConversationState([
      {
        id: "turn-1",
        status: "completed",
        items: [
          {
            type: "commandExecution",
            id: "command-1",
            command: "npm run dev",
            status: "inProgress",
            processId: "pty-1",
          },
          {
            type: "commandExecution",
            id: "command-2",
            command: "npm run test",
            status: "completed",
            processId: "pty-2",
          },
          {
            type: "agentMessage",
            id: "item-1",
            text: "done",
          },
        ],
      },
    ]);

    expect(readRunningTerminalCount(conversationState)).toBe(1);
  });

  it("deduplicates running terminals by process identifier", () => {
    const conversationState = createConversationState([
      {
        id: "turn-1",
        status: "completed",
        items: [
          {
            type: "commandExecution",
            id: "command-1",
            command: "npm run dev",
            status: "inProgress",
            processId: "pty-1",
          },
        ],
      },
      {
        id: "turn-2",
        status: "inProgress",
        items: [
          {
            type: "commandExecution",
            id: "command-2",
            command: "npm run dev",
            status: "inProgress",
            processId: "pty-1",
          },
        ],
      },
    ]);

    expect(readRunningTerminalCount(conversationState)).toBe(1);
  });

  it("uses command item identifiers when process identifiers are missing", () => {
    const conversationState = createConversationState([
      {
        id: "turn-1",
        status: "inProgress",
        items: [
          {
            type: "commandExecution",
            id: "command-1",
            command: "ls",
            status: "inProgress",
          },
          {
            type: "commandExecution",
            id: "command-2",
            command: "pwd",
            status: "in-progress",
          },
        ],
      },
    ]);

    expect(readRunningTerminalCount(conversationState)).toBe(2);
  });
});
