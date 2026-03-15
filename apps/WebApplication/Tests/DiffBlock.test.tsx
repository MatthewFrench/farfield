import type { FileChangeEntrySchema } from "@farfield/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { DiffBlock } from "@/Components/DiffBlock";

type FileChangeEntry = z.infer<typeof FileChangeEntrySchema>;

function renderDiffBlock(changes: readonly FileChangeEntry[]): void {
  cleanup();
  render(<DiffBlock changes={changes} />);
}

describe("DiffBlock", () => {
  it("does not render a synthetic directory segment for top-level file paths", () => {
    renderDiffBlock([
      {
        path: "README.md",
        kind: { type: "create" },
        diff: "+new line",
      },
    ]);

    expect(screen.getByText("README.md")).toBeDefined();
    expect(screen.queryByText("README.m")).toBeNull();
  });

  it("renders line counts and expanded diff content", () => {
    renderDiffBlock([
      {
        path: "Source/Features/Chat/ChatWorkspacePane.tsx",
        kind: { type: "create" },
        diff: "@@ -1 +1 @@\n-old line\n+new line",
      },
    ]);

    expect(screen.getByText("+1")).toBeDefined();
    expect(screen.getByText("−1")).toBeDefined();
    expect(screen.getByText("created")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /ChatWorkspacePane\.tsx/i }));

    expect(screen.getByText("@@ -1 +1 @@")).toBeDefined();
    expect(screen.getByText("old line")).toBeDefined();
    expect(screen.getByText("new line")).toBeDefined();
  });

  it("shows an empty diff message when no diff payload exists", () => {
    renderDiffBlock([
      {
        path: "Source/Features/Chat/ChatWorkspacePane.tsx",
        kind: { type: "rename" },
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /ChatWorkspacePane\.tsx/i }));

    expect(screen.getByText("No diff available")).toBeDefined();
    expect(screen.getByText("modified")).toBeDefined();
  });
});
