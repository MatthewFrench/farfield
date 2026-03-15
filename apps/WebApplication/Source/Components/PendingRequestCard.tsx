import { motion } from "framer-motion";
import { Button } from "@/Components/UserInterface/Button";
import { Input } from "@/Components/UserInterface/Input";
import { Label } from "@/Components/UserInterface/Label";
import { RadioGroup, RadioGroupItem } from "@/Components/UserInterface/RadioGroup";
import {
  createEmptyPendingUserInputAnswerDraft,
  type PendingUserInputAnswerDraftByQuestionId,
} from "@/Features/Chat/DomainModel/PendingUserInputAnswerBuilder";
import { type PendingUserInputRequest } from "@/Features/Chat/DomainModel/PendingUserInputRequestSelector";

type PendingRequestDraftField = "option" | "freeform";

const FREEFORM_INPUT_PLACEHOLDER = "Free-form answer…";
const OPTION_CONTAINER_CLASS_NAME = "space-y-1";
const SELECTED_OPTION_CLASS_NAME = "bg-muted text-foreground";
const UNSELECTED_OPTION_CLASS_NAME =
  "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

export interface PendingRequestCardProps {
  request: PendingUserInputRequest;
  answerDraft: PendingUserInputAnswerDraftByQuestionId;
  onDraftChange: (questionId: string, field: PendingRequestDraftField, value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  isBusy: boolean;
}

function readOptionInputIdentifier(questionIndex: number, optionIndex: number): string {
  return `pending-request-question-${String(questionIndex)}-option-${String(optionIndex)}`;
}

function readQuestionDescription(description: string): string | null {
  const trimmedDescription = description.trim();
  return trimmedDescription.length > 0 ? trimmedDescription : null;
}

export function PendingRequestCard({
  request,
  answerDraft,
  onDraftChange,
  onSubmit,
  onSkip,
  isBusy,
}: PendingRequestCardProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      {request.params.questions.map((question, questionIndex) => {
        const draft = answerDraft[question.id] ?? createEmptyPendingUserInputAnswerDraft();
        return (
          <div key={question.id} className="space-y-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {question.header}
            </div>
            <div className="text-sm font-medium text-foreground">{question.question}</div>
            <div className={OPTION_CONTAINER_CLASS_NAME}>
              <RadioGroup
                value={draft.option}
                onValueChange={(value) => onDraftChange(question.id, "option", value)}
                className="space-y-1"
              >
                {question.options.map((option, optionIndex) => {
                  const optionInputIdentifier = readOptionInputIdentifier(
                    questionIndex,
                    optionIndex,
                  );
                  const descriptionText = readQuestionDescription(option.description);
                  return (
                    <Label
                      key={optionInputIdentifier}
                      htmlFor={optionInputIdentifier}
                      className={`flex items-start gap-2.5 cursor-pointer p-2 rounded-lg transition-colors ${
                        draft.option === option.label
                          ? SELECTED_OPTION_CLASS_NAME
                          : UNSELECTED_OPTION_CLASS_NAME
                      }`}
                    >
                      <RadioGroupItem
                        id={optionInputIdentifier}
                        value={option.label}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{option.label}</span>
                        {descriptionText !== null ? (
                          <span className="block text-xs text-muted-foreground/70 mt-0.5">
                            {descriptionText}
                          </span>
                        ) : null}
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>
            {question.isOther && (
              <Input
                type={question.isSecret ? "password" : "text"}
                value={draft.freeform}
                onChange={(event) => onDraftChange(question.id, "freeform", event.target.value)}
                placeholder={FREEFORM_INPUT_PLACEHOLDER}
                className="h-8 bg-background text-base md:text-sm"
              />
            )}
          </div>
        );
      })}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={onSkip}
          disabled={isBusy}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Skip
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isBusy}
          size="sm"
          className="h-8 text-xs"
        >
          Submit
        </Button>
      </div>
    </motion.div>
  );
}
