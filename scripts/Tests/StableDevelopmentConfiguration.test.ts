import { describe, expect, it } from "vitest";
import {
  formatStableDevelopmentHelpText,
  readStableDevelopmentConfiguration,
} from "../development/StableDevelopmentConfiguration.mjs";

describe("StableDevelopmentConfiguration", () => {
  it("uses dedicated stable-development defaults", () => {
    const configuration = readStableDevelopmentConfiguration([], {});

    expect(configuration.host).toBe("127.0.0.1");
    expect(configuration.apiPort).toBe(4311);
    expect(configuration.webPort).toBe(4312);
    expect(configuration.liveReloadPort).toBe(4313);
    expect(configuration.idleMilliseconds).toBe(60000);
    expect(configuration.pollIntervalMilliseconds).toBe(1000);
    expect(configuration.agentIds).toEqual(["codex"]);
  });

  it("uses remote host binding when requested", () => {
    const configuration = readStableDevelopmentConfiguration(["--remote"], {});

    expect(configuration.host).toBe("0.0.0.0");
  });

  it("parses explicit agent ids and port overrides", () => {
    const configuration = readStableDevelopmentConfiguration(["--agents=codex,opencode"], {
      FARFIELD_STABLE_DEV_API_PORT: "5511",
      FARFIELD_STABLE_DEV_WEB_PORT: "5512",
      FARFIELD_STABLE_DEV_LIVE_RELOAD_PORT: "5513",
      FARFIELD_STABLE_DEV_IDLE_MS: "90000",
      FARFIELD_STABLE_DEV_POLL_INTERVAL_MS: "2500",
    });

    expect(configuration.agentIds).toEqual(["codex", "opencode"]);
    expect(configuration.apiPort).toBe(5511);
    expect(configuration.webPort).toBe(5512);
    expect(configuration.liveReloadPort).toBe(5513);
    expect(configuration.idleMilliseconds).toBe(90000);
    expect(configuration.pollIntervalMilliseconds).toBe(2500);
  });

  it("rejects duplicate stable-development ports", () => {
    expect(() =>
      readStableDevelopmentConfiguration([], {
        FARFIELD_STABLE_DEV_API_PORT: "4311",
        FARFIELD_STABLE_DEV_WEB_PORT: "4311",
        FARFIELD_STABLE_DEV_LIVE_RELOAD_PORT: "4313",
      }),
    ).toThrowError("Stable development ports must be distinct");
  });

  it("renders stable-development help text", () => {
    expect(formatStableDevelopmentHelpText()).toContain("bun run dev:stable");
  });
});
