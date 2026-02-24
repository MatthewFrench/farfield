import { describe, expect, it } from "vitest";
import { PendingUserInputAnswerBuilder } from "../Source/Features/Chat/DomainModel/PendingUserInputAnswerBuilder";

describe("PendingUserInputAnswerBuilder", () => {
  it("builds answers from selected options and trimmed freeform input", () => {
    const builder = new PendingUserInputAnswerBuilder();

    const answers = builder.buildAnswersByQuestionId({
      questions: [
        { id: "q1" },
        { id: "q2" },
        { id: "q3" }
      ],
      answerDraftByQuestionId: {
        q1: {
          option: "yes",
          freeform: ""
        },
        q2: {
          option: "",
          freeform: "   custom value  "
        },
        q3: {
          option: "",
          freeform: "   "
        }
      }
    });

    expect(answers).toEqual({
      q1: { answers: ["yes"] },
      q2: { answers: ["custom value"] }
    });
  });
});
