export interface PendingUserInputQuestionLike {
  id: string;
}

export interface PendingUserInputAnswerDraft {
  option: string;
  freeform: string;
}

export type PendingUserInputAnswerDraftByQuestionId = Record<string, PendingUserInputAnswerDraft>;

export type PendingUserInputAnswersByQuestionId = Record<string, { answers: string[] }>;

export class PendingUserInputAnswerBuilder {
  public buildAnswersByQuestionId(input: {
    questions: PendingUserInputQuestionLike[];
    answerDraftByQuestionId: PendingUserInputAnswerDraftByQuestionId;
  }): PendingUserInputAnswersByQuestionId {
    const answersByQuestionId: PendingUserInputAnswersByQuestionId = {};
    for (const question of input.questions) {
      const draft = input.answerDraftByQuestionId[question.id] ?? {
        option: "",
        freeform: ""
      };
      const answerText = draft.option || draft.freeform.trim();
      if (answerText) {
        answersByQuestionId[question.id] = {
          answers: [answerText]
        };
      }
    }
    return answersByQuestionId;
  }
}
