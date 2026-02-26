import { describe, expect, it } from "vitest";
import {
  createEmptyPendingUserInputAnswerDraft,
  PendingUserInputAnswerBuilder
} from "../Source/Features/Chat/DomainModel/PendingUserInputAnswerBuilder";

describe("PendingUserInputAnswerBuilder", () => {
  it("creates independent empty answer drafts", () => {
    const firstDraft = createEmptyPendingUserInputAnswerDraft();
    const secondDraft = createEmptyPendingUserInputAnswerDraft();

    expect(firstDraft).toEqual({ option: "", freeform: "" });
    expect(secondDraft).toEqual({ option: "", freeform: "" });
    expect(firstDraft).not.toBe(secondDraft);
  });

  it("builds answer payloads using selected options or trimmed freeform text", () => {
    const builder = new PendingUserInputAnswerBuilder();

    const answersByQuestionId = builder.buildAnswersByQuestionId({
      questions: [
        { id: "question-1" },
        { id: "question-2" },
        { id: "question-3" }
      ],
      answerDraftByQuestionId: {
        "question-1": {
          option: "selected-option",
          freeform: "ignored text"
        },
        "question-2": {
          option: "",
          freeform: "  freeform response  "
        },
        "question-3": {
          option: "",
          freeform: "   "
        }
      }
    });

    expect(answersByQuestionId).toEqual({
      "question-1": {
        answers: ["selected-option"]
      },
      "question-2": {
        answers: ["freeform response"]
      }
    });
  });
});
