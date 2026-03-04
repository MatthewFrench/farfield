import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

interface SyntaxHighlighterProps {
  children: string;
  language: string;
}

vi.mock("@/Features/Theme/StateManagement/UseTheme", () => ({
  useTheme() {
    return {
      theme: "light",
      toggle: () => {},
    };
  },
}));

vi.mock("react-syntax-highlighter", () => ({
  Prism(input: SyntaxHighlighterProps) {
    return (
      <pre data-testid="markdown-syntax-highlighter" data-language={input.language}>
        {input.children}
      </pre>
    );
  },
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
  oneLight: {},
}));

import { MarkdownText } from "@/Components/MarkdownText";

afterEach(() => {
  cleanup();
});

describe("MarkdownText", () => {
  it("renders inline code without invoking the code block renderer", () => {
    render(<MarkdownText text="Use `npm test` before commit." />);

    expect(screen.getByText("npm test")).toBeDefined();
    expect(screen.queryByTestId("markdown-syntax-highlighter")).toBeNull();
  });

  it("renders fenced code blocks with parsed language labels", () => {
    render(<MarkdownText text={"```ts\nconst value = 1;\n```"} />);

    const block = screen.getByTestId("markdown-syntax-highlighter");

    expect(block.getAttribute("data-language")).toBe("ts");
    expect(block.textContent).toBe("const value = 1;");
  });

  it("uses the text language contract when fenced code language is omitted", () => {
    render(<MarkdownText text={"```\nplain block\n```"} />);

    const block = screen.getByTestId("markdown-syntax-highlighter");

    expect(block.getAttribute("data-language")).toBe("text");
    expect(block.textContent).toBe("plain block");
  });

  it("rewrites local absolute image paths through the local-image route", () => {
    render(<MarkdownText text={"![Local image](/tmp/screenshot.png)"} />);

    const image = screen.getByRole("img", { name: "Local image" });

    expect(image.getAttribute("src")).toBe("/api/files/local-image?path=%2Ftmp%2Fscreenshot.png");
  });

  it("keeps remote image URLs unchanged", () => {
    render(<MarkdownText text={"![Remote image](https://example.com/screenshot.png)"} />);

    const image = screen.getByRole("img", { name: "Remote image" });

    expect(image.getAttribute("src")).toBe("https://example.com/screenshot.png");
  });
});
