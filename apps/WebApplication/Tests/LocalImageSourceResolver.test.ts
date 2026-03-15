import { describe, expect, it } from "vitest";
import { resolveLocalImageSourceForRender } from "../Source/Features/Chat/DomainModel/LocalImageSourceResolver";

describe("resolveLocalImageSourceForRender", () => {
  it("keeps direct browser URLs unchanged", () => {
    expect(resolveLocalImageSourceForRender("https://example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
    expect(resolveLocalImageSourceForRender("data:image/png;base64,abcd")).toBe(
      "data:image/png;base64,abcd",
    );
  });

  it("converts unix absolute paths into local-image route URLs", () => {
    const resolvedPath = resolveLocalImageSourceForRender("/tmp/example image.png");
    const parsedUrl = new URL(resolvedPath, "http://127.0.0.1");

    expect(parsedUrl.pathname).toBe("/api/files/local-image");
    expect(parsedUrl.searchParams.get("path")).toBe("/tmp/example image.png");
  });

  it("converts windows absolute paths into local-image route URLs", () => {
    const resolvedPath = resolveLocalImageSourceForRender("C:/Users/matt/image.png");
    const parsedUrl = new URL(resolvedPath, "http://127.0.0.1");

    expect(parsedUrl.pathname).toBe("/api/files/local-image");
    expect(parsedUrl.searchParams.get("path")).toBe("C:/Users/matt/image.png");
  });

  it("converts file URLs into local-image route URLs", () => {
    const resolvedPath = resolveLocalImageSourceForRender("file:///tmp/sample.png");
    const parsedUrl = new URL(resolvedPath, "http://127.0.0.1");

    expect(parsedUrl.pathname).toBe("/api/files/local-image");
    expect(parsedUrl.searchParams.get("path")).toBe("/tmp/sample.png");
  });

  it("keeps relative paths unchanged", () => {
    expect(resolveLocalImageSourceForRender("./images/sample.png")).toBe("./images/sample.png");
  });
});
