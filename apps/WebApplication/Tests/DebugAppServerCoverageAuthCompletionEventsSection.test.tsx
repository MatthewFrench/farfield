import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoverageAuthCompletionEventsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoverageAuthCompletionEventsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoverageAuthCompletionEventsSection", () => {
  it("reads auth completion events when the action button is clicked", () => {
    const readAuthCompletionEventsSpy = vi.fn((_sinceSequence?: number | null) => {});

    render(
      <DebugAppServerCoverageAuthCompletionEventsSection
        isRunningCoverageAction={false}
        lastAuthCompletionEventsResult={null}
        onReadAuthCompletionEvents={readAuthCompletionEventsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-auth-completion-events-read"));

    expect(readAuthCompletionEventsSpy).toHaveBeenCalledWith(null);
  });

  it("filters auth completion events by method input", () => {
    render(
      <DebugAppServerCoverageAuthCompletionEventsSection
        isRunningCoverageAction={false}
        lastAuthCompletionEventsResult={{
          sinceSequence: 10,
          eventCount: 2,
          nextSequence: 14,
          firstAvailableSequence: 4,
          resetRequired: false,
          events: [
            {
              method: "mcpServer/oauthLogin/completed",
              sequence: 12,
              receivedAtMilliseconds: 17_700,
              status: "success",
              subject: "github",
              errorMessage: null,
            },
            {
              method: "account/login/completed",
              sequence: 13,
              receivedAtMilliseconds: 17_800,
              status: "error",
              subject: "login-1",
              errorMessage: "Login canceled.",
            },
          ],
          methodCounts: [
            {
              method: "mcpServer/oauthLogin/completed",
              count: 1,
            },
            {
              method: "account/login/completed",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadAuthCompletionEvents={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-auth-completion-events-method-filter"), {
      target: { value: "account/login" },
    });

    expect(
      screen.getByTestId("debug-coverage-auth-completion-events-filter-summary").textContent,
    ).toContain("Showing 1 of 2 completion events");
    expect(screen.queryByTestId("debug-coverage-auth-completion-event-12")).toBeNull();
  });

  it("sets the method filter from method-count buttons", () => {
    render(
      <DebugAppServerCoverageAuthCompletionEventsSection
        isRunningCoverageAction={false}
        lastAuthCompletionEventsResult={{
          sinceSequence: null,
          eventCount: 1,
          nextSequence: 3,
          firstAvailableSequence: 1,
          resetRequired: false,
          events: [
            {
              method: "mcpServer/oauthLogin/completed",
              sequence: 2,
              receivedAtMilliseconds: 17_100,
              status: "success",
              subject: "github",
              errorMessage: null,
            },
          ],
          methodCounts: [
            {
              method: "mcpServer/oauthLogin/completed",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadAuthCompletionEvents={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByTestId(
        "debug-coverage-auth-completion-events-method-count-mcpServer-oauthLogin-completed",
      ),
    );

    expect(
      (
        screen.getByTestId(
          "debug-coverage-auth-completion-events-method-filter",
        ) as HTMLInputElement
      ).value,
    ).toBe("mcpServer/oauthLogin/completed");
  });
});
