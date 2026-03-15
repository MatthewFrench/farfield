import { describe, expect, it } from "vitest";
import { parseServerCliOptions } from "../Source/Agents/CliOptions.js";

describe("server cli options", () => {
  it("defaults to codex when --agents is omitted", () => {
    const parsed = parseServerCliOptions([]);
    expect(parsed.agentIds).toEqual(["codex"]);
  });

  it("expands all to every known agent", () => {
    const parsed = parseServerCliOptions(["--agents=all"]);
    expect(parsed.agentIds).toEqual(["codex", "opencode"]);
  });

  it("keeps order and dedupes repeated agent ids", () => {
    const parsed = parseServerCliOptions(["--agents", "opencode,codex,opencode"]);
    expect(parsed.agentIds).toEqual(["opencode", "codex"]);
  });

  it("rejects unknown agent ids", () => {
    expect(() => parseServerCliOptions(["--agents=foo"])).toThrowError(/Unknown agent id/);
  });

  it("rejects empty comma-delimited agent tokens", () => {
    expect(() => parseServerCliOptions(["--agents=codex,,opencode"])).toThrowError(
      /Missing value for --agents/,
    );
  });

  it("sets showHelp for both help flags", () => {
    expect(parseServerCliOptions(["--help"]).showHelp).toBe(true);
    expect(parseServerCliOptions(["-h"]).showHelp).toBe(true);
  });

  it("rejects --agents when the next token is another flag", () => {
    expect(() => parseServerCliOptions(["--agents", "--help"])).toThrowError(
      /Missing value for --agents/,
    );
  });
});
