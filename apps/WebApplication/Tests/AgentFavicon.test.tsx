import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentFavicon } from "@/Application/UserInterface/AgentFavicon";

const DATA_URL_PREFIX = "data:image/svg+xml,";

function readDecodedSvgMarkup(imageName: string): string {
  const image = screen.getByRole("img", { name: imageName });
  const source = image.getAttribute("src");
  if (source === null) {
    throw new Error("AgentFavicon image src must be present");
  }
  expect(source.startsWith(DATA_URL_PREFIX)).toBe(true);
  return decodeURIComponent(source.slice(DATA_URL_PREFIX.length));
}

describe("AgentFavicon", () => {
  it("renders codex favicon markup", () => {
    render(<AgentFavicon agentId="codex" label="Codex" />);

    const svgMarkup = readDecodedSvgMarkup("Codex");
    expect(svgMarkup.includes("fill='#10A37F'")).toBe(true);
    expect(svgMarkup.includes(">C<")).toBe(true);
  });

  it("renders opencode favicon markup", () => {
    render(<AgentFavicon agentId="opencode" label="OpenCode" />);

    const svgMarkup = readDecodedSvgMarkup("OpenCode");
    expect(svgMarkup.includes("fill='#F97316'")).toBe(true);
    expect(svgMarkup.includes(">O<")).toBe(true);
  });
});
