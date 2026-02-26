import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { UserInputRequestSchema } from "@farfield/protocol";
import { PendingRequestCard, type PendingRequestCardProps } from "@/Components/PendingRequestCard";

type PendingUserInputRequest = z.infer<typeof UserInputRequestSchema>;

function createPendingUserInputRequest(): PendingUserInputRequest {
  return {
    method: "item/tool/requestUserInput",
    id: 12,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      questions: [
        {
          id: "question-1",
          header: "Credentials",
          question: "Provide a token",
          isOther: true,
          isSecret: false,
          options: [
            {
              label: "Use workspace token",
              description: ""
            },
            {
              label: "Use local token",
              description: "Read from local keychain"
            }
          ]
        }
      ]
    }
  };
}

function renderPendingRequestCard(overrides?: Partial<PendingRequestCardProps>): void {
  cleanup();

  render(
    <PendingRequestCard
      request={createPendingUserInputRequest()}
      answerDraft={{}}
      onDraftChange={() => {}}
      onSubmit={() => {}}
      onSkip={() => {}}
      isBusy={false}
      {...overrides}
    />
  );
}

describe("PendingRequestCard", () => {
  it("uses an explicit empty draft contract when no draft exists for a question", () => {
    renderPendingRequestCard();

    const freeformInput = screen.getByPlaceholderText<HTMLInputElement>("Free-form answer…");

    expect(freeformInput.value).toBe("");
  });

  it("emits draft updates for free-form question input", () => {
    const onDraftChange = vi.fn();

    renderPendingRequestCard({
      onDraftChange
    });

    fireEvent.change(
      screen.getByPlaceholderText("Free-form answer…"),
      { target: { value: "token-value" } }
    );

    expect(onDraftChange).toHaveBeenCalledWith("question-1", "freeform", "token-value");
  });

  it("disables submit actions while a request is in flight", () => {
    const onSubmit = vi.fn();
    const onSkip = vi.fn();

    renderPendingRequestCard({
      isBusy: true,
      onSubmit,
      onSkip
    });

    const skipButton = screen.getByRole("button", { name: "Skip" });
    const submitButton = screen.getByRole("button", { name: "Submit" });

    expect(skipButton.hasAttribute("disabled")).toBe(true);
    expect(submitButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(skipButton);
    fireEvent.click(submitButton);

    expect(onSkip).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
