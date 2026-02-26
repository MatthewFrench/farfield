import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DebugHistoryDetailPanel } from "@/Features/Debugging/UserInterface/DebugHistoryDetailPanel";

function renderDebugHistoryDetailPanel(input?: {
  historyEntryId?: string | null;
  waitForReplayResponse?: boolean;
  onWaitForReplayResponseChange?: (enabled: boolean) => void;
  onReplayHistoryEntry?: (replayInput: { entryId: string; waitForResponse: boolean }) => void;
}): void {
  cleanup();
  render(
    <DebugHistoryDetailPanel
      historyEntryId={input?.historyEntryId === undefined ? "history-1" : input.historyEntryId}
      historyDetailPayloadText='{"ok":true}'
      waitForReplayResponse={input?.waitForReplayResponse ?? false}
      onWaitForReplayResponseChange={input?.onWaitForReplayResponseChange ?? (() => {})}
      onReplayHistoryEntry={input?.onReplayHistoryEntry ?? (() => {})}
    />
  );
}

describe("DebugHistoryDetailPanel", () => {
  it("renders an empty state when no history entry is selected", () => {
    renderDebugHistoryDetailPanel({ historyEntryId: null });

    expect(screen.getByText("Select an entry")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Replay" })).toBeNull();
  });

  it("invokes replay and wait-for-response callbacks", () => {
    const onWaitForReplayResponseChange = vi.fn();
    const onReplayHistoryEntry = vi.fn();
    renderDebugHistoryDetailPanel({
      historyEntryId: "history-7",
      waitForReplayResponse: false,
      onWaitForReplayResponseChange,
      onReplayHistoryEntry
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));

    expect(onWaitForReplayResponseChange).toHaveBeenCalledWith(true);
    expect(onReplayHistoryEntry).toHaveBeenCalledWith({
      entryId: "history-7",
      waitForResponse: false
    });
  });
});
