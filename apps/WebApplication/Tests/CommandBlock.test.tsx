import type { CommandExecutionItemSchema } from "@farfield/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { CommandBlock } from "@/Components/CommandBlock";

type CommandExecutionItem = z.infer<typeof CommandExecutionItemSchema>;

vi.mock("@/Components/CodeSnippet", () => ({
  CodeSnippet(input: { code: string }) {
    return <pre>{input.code}</pre>;
  },
}));

function createCommandExecutionItem(input?: {
  aggregatedOutput?: string | null;
  commandActions?: CommandExecutionItem["commandActions"];
}): CommandExecutionItem {
  return {
    type: "commandExecution",
    id: "command-item-1",
    command: "echo hello",
    status: "completed",
    aggregatedOutput: input?.aggregatedOutput,
    commandActions: input?.commandActions,
  };
}

function renderCommandBlock(item: CommandExecutionItem): void {
  cleanup();
  render(<CommandBlock item={item} isActive={false} />);
}

describe("CommandBlock", () => {
  it("renders an explicit empty output label when output is null and no actions are present", () => {
    renderCommandBlock(createCommandExecutionItem({ aggregatedOutput: null }));

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("No output")).toBeDefined();
  });

  it("renders command output when output text is present", () => {
    renderCommandBlock(createCommandExecutionItem({ aggregatedOutput: "hello" }));

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Output")).toBeDefined();
    expect(screen.getByText("hello")).toBeDefined();
  });
});
