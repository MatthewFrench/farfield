import { describe, expect, it } from "vitest";
import {
  ProtocolValidationError,
  type JsonValue,
  UserInputRequestMethod,
  parseThreadConversationState
} from "../Source/Index.js";

function captureThreadConversationStateParseError(value: JsonValue): ProtocolValidationError {
  try {
    parseThreadConversationState(value);
  } catch (error) {
    if (error instanceof ProtocolValidationError) {
      return error;
    }
    throw error;
  }

  throw new Error("Expected parseThreadConversationState to throw ProtocolValidationError");
}

describe("codex-protocol validation error formatting", () => {
  it("formats root-level issues using the root path token", () => {
    const error = captureThreadConversationStateParseError("not-an-object");

    expect(error.issues[0]).toContain("<root>:");
    expect(error.message).toContain("<root>:");
  });

  it("formats nested array paths without separator artifacts", () => {
    const error = captureThreadConversationStateParseError({
      id: "thread-123",
      turns: [],
      requests: [
        {
          method: UserInputRequestMethod,
          id: 7,
          params: {
            threadId: "thread-123",
            turnId: "turn-123",
            itemId: "item-123",
            questions: [
              {
                id: "",
                header: "Question Header",
                question: "Question text",
                isOther: false,
                isSecret: false,
                options: []
              }
            ]
          }
        }
      ]
    });

    expect(error.issues.some((issue) => issue.startsWith("requests[0].params.questions[0].id:"))).toBe(
      true
    );
    expect(error.issues.every((issue) => !issue.includes(".["))).toBe(true);
    expect(error.message).toContain("requests[0].params.questions[0].id:");
  });
});
