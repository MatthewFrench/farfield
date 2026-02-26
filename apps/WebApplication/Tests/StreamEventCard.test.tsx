import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IpcFrame } from "@farfield/protocol";

interface DiffBlockMockProps {
  changes: readonly {
    path: string;
    kind: {
      type: string;
      move_path?: string | null;
    };
    diff?: string;
  }[];
}

vi.mock("@/Components/DiffBlock", () => ({
  DiffBlock(input: DiffBlockMockProps) {
    return <div data-testid="stream-event-diff-block">{`changes:${String(input.changes.length)}`}</div>;
  }
}));

import { StreamEventCard } from "@/Components/StreamEventCard";

function createFileChangeRequestEvent(): IpcFrame {
  return {
    type: "request",
    requestId: "request-1",
    method: "thread/file/change",
    params: {
      changes: [
        {
          path: "apps/WebApplication/Source/App.tsx",
          kind: {
            type: "update",
            move_path: null
          },
          diff: "@@ -1 +1 @@\n-old\n+new"
        }
      ]
    }
  };
}

function createResponseEvent(input?: { method?: string }): IpcFrame {
  return {
    type: "response",
    requestId: "response-1",
    method: input?.method,
    resultType: "success",
    result: {
      ok: true
    }
  };
}

function renderStreamEventCard(event: IpcFrame): void {
  cleanup();
  render(<StreamEventCard event={event} />);
}

describe("StreamEventCard", () => {
  it("renders parsed file-change payloads through the diff block contract", () => {
    renderStreamEventCard(createFileChangeRequestEvent());

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByTestId("stream-event-diff-block").textContent).toBe("changes:1");
  });

  it("renders full event JSON when no diff payload contract is matched", () => {
    renderStreamEventCard(createResponseEvent({ method: "thread/read" }));

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/"resultType": "success"/)).toBeDefined();
  });

  it("uses explicit response type labeling when response methods are absent", () => {
    renderStreamEventCard(createResponseEvent());

    expect(screen.getByText("response")).toBeDefined();
  });
});
