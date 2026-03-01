import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugAppServerCoveragePendingServerRequestsSection } from "@/Features/Debugging/UserInterface/DebugAppServerCoveragePendingServerRequestsSection";

afterEach(() => {
  cleanup();
});

describe("DebugAppServerCoveragePendingServerRequestsSection", () => {
  it("reads pending server requests when the action button is clicked", () => {
    const readPendingServerRequestsSpy = vi.fn(() => {});

    render(
      <DebugAppServerCoveragePendingServerRequestsSection
        isRunningCoverageAction={false}
        lastPendingServerRequestsResult={null}
        onReadPendingServerRequests={readPendingServerRequestsSpy}
      />,
    );

    fireEvent.click(screen.getByTestId("debug-coverage-pending-server-requests-read"));

    expect(readPendingServerRequestsSpy).toHaveBeenCalledTimes(1);
  });

  it("filters pending server requests by method input", () => {
    render(
      <DebugAppServerCoveragePendingServerRequestsSection
        isRunningCoverageAction={false}
        lastPendingServerRequestsResult={{
          requestCount: 2,
          requests: [
            {
              requestId: 13,
              method: "item/tool/requestUserInput",
              receivedAtMilliseconds: 17_700,
              preview: '{"question":"Select deployment target"}',
            },
            {
              requestId: 14,
              method: "item/commandExecution/requestApproval",
              receivedAtMilliseconds: 17_800,
              preview: '{"command":["npm","run","build"]}',
            },
          ],
          methodCounts: [
            {
              method: "item/tool/requestUserInput",
              count: 1,
            },
            {
              method: "item/commandExecution/requestApproval",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadPendingServerRequests={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("debug-coverage-pending-server-requests-method-filter"), {
      target: { value: "commandExecution" },
    });

    expect(
      screen.getByTestId("debug-coverage-pending-server-requests-filter-summary").textContent,
    ).toContain("Showing 1 of 2 pending requests");
    expect(screen.queryByTestId("debug-coverage-pending-server-request-13")).toBeNull();
  });

  it("sets method filter from method-count buttons", () => {
    render(
      <DebugAppServerCoveragePendingServerRequestsSection
        isRunningCoverageAction={false}
        lastPendingServerRequestsResult={{
          requestCount: 1,
          requests: [
            {
              requestId: 13,
              method: "item/tool/requestUserInput",
              receivedAtMilliseconds: 17_700,
              preview: '{"question":"Select deployment target"}',
            },
          ],
          methodCounts: [
            {
              method: "item/tool/requestUserInput",
              count: 1,
            },
          ],
          readAtIso8601: "2026-03-01T00:00:00.000Z",
        }}
        onReadPendingServerRequests={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByTestId(
        "debug-coverage-pending-server-requests-method-count-item-tool-requestUserInput",
      ),
    );

    expect(
      (
        screen.getByTestId(
          "debug-coverage-pending-server-requests-method-filter",
        ) as HTMLInputElement
      ).value,
    ).toBe("item/tool/requestUserInput");
  });
});
