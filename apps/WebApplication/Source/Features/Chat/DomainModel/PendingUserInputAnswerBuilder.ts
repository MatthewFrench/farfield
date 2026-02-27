export interface PendingUserInputQuestionLike {
  id: string;
}

export interface PendingUserInputAnswerDraft {
  option: string;
  freeform: string;
}

export type PendingUserInputAnswerDraftByQuestionId = Record<string, PendingUserInputAnswerDraft>;

export type PendingUserInputAnswersByQuestionId = Record<string, { answers: string[] }>;

export function createEmptyPendingUserInputAnswerDraft(): PendingUserInputAnswerDraft {
  return {
    option: "",
    freeform: "",
  };
}

export class PendingUserInputAnswerBuilder {
  public buildAnswersByQuestionId(input: {
    questions: PendingUserInputQuestionLike[];
    answerDraftByQuestionId: PendingUserInputAnswerDraftByQuestionId;
  }): PendingUserInputAnswersByQuestionId {
    const answerEntries: Array<readonly [string, { answers: string[] }]> = [];
    for (const question of input.questions) {
      const draft =
        input.answerDraftByQuestionId[question.id] ?? createEmptyPendingUserInputAnswerDraft();
      const normalizedFreeform = draft.freeform.trim();
      const answerText = draft.option.length > 0 ? draft.option : normalizedFreeform;
      if (answerText.length === 0) {
        continue;
      }
      answerEntries.push([
        question.id,
        {
          answers: [answerText],
        },
      ]);
    }
    return Object.fromEntries(answerEntries);
  }
}
