import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type DebugIssue } from "@/Features/Debugging/DomainModel/DebugIssueContracts";
import { DebugIssuesPanel } from "@/Features/Debugging/UserInterface/DebugIssuesPanel";

const exampleDebugIssue: DebugIssue = {
  id: "error:error-1",
  kind: "debug-error",
  severity: "error",
  occurredAt: "2026-02-26T00:00:00.000Z",
  message: "Request failed",
  sourceLabel: "Server (thread.read)",
  threadId: "thread-1",
  requestId: "request-1",
  actionId: "action-1",
  actionName: "thread-read",
  searchText: "request failed",
  errorId: "error-1",
  origin: "server",
  source: "farfield-server",
  operation: "thread.read",
  name: "Error",
  stack: null,
  detailsText: "{}"
};

function renderDebugIssuesPanel(input?: {
  issues?: readonly DebugIssue[];
  selectedIssue?: DebugIssue | null;
  selectedIssueId?: string;
  debugErrorSessionLogPath?: string;
  onIssueSelect?: (issueId: string) => void;
  onSeverityFilterChange?: (severity: "all" | "error" | "warning") => void;
  onFilterQueryChange?: (filterQuery: string) => void;
}): void {
  cleanup();
  render(
    <DebugIssuesPanel
      issues={input?.issues ?? [exampleDebugIssue]}
      selectedIssue={input?.selectedIssue ?? exampleDebugIssue}
      selectedIssueId={input?.selectedIssueId ?? exampleDebugIssue.id}
      severityFilter="all"
      filterQuery=""
      debugErrorSessionId="session-1"
      debugErrorSessionLogPath={input?.debugErrorSessionLogPath ?? "/tmp/session.ndjson"}
      onIssueSelect={input?.onIssueSelect ?? (() => {})}
      onSeverityFilterChange={input?.onSeverityFilterChange ?? (() => {})}
      onFilterQueryChange={input?.onFilterQueryChange ?? (() => {})}
      onClearIssues={() => {}}
    />
  );
}

describe("DebugIssuesPanel", () => {
  it("invokes severity-filter and issue-selection callbacks", () => {
    const onIssueSelect = vi.fn();
    const onSeverityFilterChange = vi.fn();

    renderDebugIssuesPanel({
      onIssueSelect,
      onSeverityFilterChange
    });

    fireEvent.click(screen.getByRole("button", { name: "Errors" }));
    fireEvent.click(screen.getByRole("button", { name: "Warnings" }));
    fireEvent.click(screen.getByRole("button", { name: /Request failed/i }));

    expect(onSeverityFilterChange).toHaveBeenNthCalledWith(1, "error");
    expect(onSeverityFilterChange).toHaveBeenNthCalledWith(2, "warning");
    expect(onIssueSelect).toHaveBeenCalledWith("error:error-1");
  });

  it("invokes query callback when filter input changes", () => {
    const onFilterQueryChange = vi.fn();
    renderDebugIssuesPanel({ onFilterQueryChange });

    fireEvent.change(screen.getByPlaceholderText("Filter by action/request/error/thread/message"), {
      target: { value: "request-1" }
    });

    expect(onFilterQueryChange).toHaveBeenCalledWith("request-1");
  });

  it("renders the session-log link only when a log path is available", () => {
    renderDebugIssuesPanel({ debugErrorSessionLogPath: "" });
    expect(screen.queryByText("session log")).toBeNull();

    renderDebugIssuesPanel({ debugErrorSessionLogPath: "/tmp/session.ndjson" });
    expect(screen.getByText("session log").getAttribute("href")).toBe(
      "/api/debug/client-errors/session-log"
    );
  });
});
