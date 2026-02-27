import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "@/Components/ChatComposer";

function renderChatComposer(input?: {
  canSend?: boolean;
  isBusy?: boolean;
  isGenerating?: boolean;
  onInterrupt?: () => void | Promise<void>;
  onSend?: (text: string) => void | Promise<void>;
}): void {
  cleanup();
  render(
    <ChatComposer
      canSend={input?.canSend ?? true}
      isBusy={input?.isBusy ?? false}
      isGenerating={input?.isGenerating ?? false}
      onInterrupt={input?.onInterrupt ?? (() => {})}
      onSend={input?.onSend ?? (() => {})}
    />,
  );
}

describe("ChatComposer", () => {
  it("sends the current draft and clears the composer", async () => {
    const onSend = vi.fn();
    renderChatComposer({ onSend });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Ship this change  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1);
    });
    expect(onSend).toHaveBeenCalledWith("  Ship this change  ");
    await waitFor(() => {
      expect(screen.queryByDisplayValue("  Ship this change  ")).toBeNull();
    });
  });

  it("does not send when the draft has only whitespace", () => {
    const onSend = vi.fn();
    renderChatComposer({ onSend });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    const sendButton = screen.getByRole("button", { name: "Send" });

    expect(sendButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("submits the draft on the keyboard send shortcut", async () => {
    const onSend = vi.fn();
    renderChatComposer({ onSend });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Shortcut send" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1);
    });
    expect(onSend).toHaveBeenCalledWith("Shortcut send");
  });

  it("triggers interrupt instead of send while generation is active", async () => {
    const onInterrupt = vi.fn();
    const onSend = vi.fn();
    renderChatComposer({
      isGenerating: true,
      onInterrupt,
      onSend,
    });

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(onInterrupt).toHaveBeenCalledTimes(1);
    });
    expect(onSend).not.toHaveBeenCalled();
  });
});
