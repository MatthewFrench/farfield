import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReasoningBlock } from "@/Components/ReasoningBlock";

interface AnimatePresenceProps {
  children?: ReactNode;
}

interface MotionDivProps extends ComponentPropsWithoutRef<"div"> {}
interface MotionSpanProps extends ComponentPropsWithoutRef<"span"> {}

vi.mock("framer-motion", () => ({
  AnimatePresence({ children }: AnimatePresenceProps) {
    return <>{children}</>;
  },
  motion: {
    div({ children, ...props }: MotionDivProps) {
      return <div {...props}>{children}</div>;
    },
    span({ children, ...props }: MotionSpanProps) {
      return <span {...props}>{children}</span>;
    }
  }
}));

function renderReasoningBlock(input?: {
  summary?: string[];
  text?: string;
  isActive?: boolean;
}) {
  cleanup();

  return render(
    <ReasoningBlock
      summary={input?.summary ?? ["Step one"]}
      text={input?.text}
      isActive={input?.isActive ?? false}
    />
  );
}

describe("ReasoningBlock", () => {
  it("uses the explicit default summary line when no summary entries exist", () => {
    renderReasoningBlock({
      summary: []
    });

    expect(screen.getByText("Thinking…")).toBeDefined();
  });

  it("sanitizes summary lines and expands deterministic detail content", () => {
    renderReasoningBlock({
      summary: ["  **First step**  ", "**Second step**"],
      text: "Detailed reasoning"
    });

    expect(screen.getByText("Second step")).toBeDefined();

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("First step")).toBeDefined();
    expect(screen.getByText("Detailed reasoning")).toBeDefined();
  });

  it("does not render an expanded text block for blank reasoning text", () => {
    const renderResult = renderReasoningBlock({
      summary: ["Step A", "Step B"],
      text: "   "
    });

    fireEvent.click(screen.getByRole("button"));

    expect(renderResult.container.querySelector("pre")).toBeNull();
  });
});
