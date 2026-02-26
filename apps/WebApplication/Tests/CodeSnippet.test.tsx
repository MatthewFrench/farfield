import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

interface SyntaxHighlighterProps {
  children: string;
  language: string;
  wrapLongLines?: boolean;
}

vi.mock("@/Features/Theme/StateManagement/UseTheme", () => ({
  useTheme() {
    return {
      theme: "light",
      toggle: () => {}
    };
  }
}));

vi.mock("react-syntax-highlighter", () => ({
  Prism(input: SyntaxHighlighterProps) {
    return (
      <pre
        data-testid="code-snippet"
        data-language={input.language}
        data-wrap-long-lines={String(input.wrapLongLines ?? false)}
      >
        {input.children}
      </pre>
    );
  }
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
  oneLight: {}
}));

import { CodeSnippet } from "@/Components/CodeSnippet";

function renderCodeSnippet(input?: {
  code?: string;
  language?: string;
  wrapLongLines?: boolean;
}): void {
  cleanup();

  const wrapLongLinesProperties =
    input?.wrapLongLines === undefined
      ? {}
      : { wrapLongLines: input.wrapLongLines };

  render(
    <CodeSnippet
      code={input?.code ?? "const value = 1;"}
      language={input?.language ?? "ts"}
      {...wrapLongLinesProperties}
    />
  );
}

describe("CodeSnippet", () => {
  it("normalizes empty language input to the text language contract", () => {
    renderCodeSnippet({
      language: "   "
    });

    const snippet = screen.getByTestId("code-snippet");

    expect(snippet.getAttribute("data-language")).toBe("text");
  });

  it("defaults wrap-long-lines to true and allows explicit disablement", () => {
    renderCodeSnippet();

    const defaultSnippet = screen.getByTestId("code-snippet");
    expect(defaultSnippet.getAttribute("data-wrap-long-lines")).toBe("true");

    renderCodeSnippet({
      wrapLongLines: false
    });

    const noWrapSnippet = screen.getByTestId("code-snippet");
    expect(noWrapSnippet.getAttribute("data-wrap-long-lines")).toBe("false");
  });
});
