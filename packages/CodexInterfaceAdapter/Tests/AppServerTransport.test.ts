import { describe, expect, it } from "vitest";
import {
  buildAppServerSpawnEnvironment,
  isChildProcessAppServerTransportOptions,
  type AppServerTransport
} from "../Source/AppServerTransport.js";

describe("buildAppServerSpawnEnvironment", () => {
  it("keeps only allowlisted inherited keys and injects codex identity keys", () => {
    const environment = buildAppServerSpawnEnvironment({
      baseEnvironment: {
        HOME: "/Users/tester",
        PATH: "/usr/bin",
        RANDOM_KEY: "ignored"
      },
      userAgent: "farfield-tests",
      clientId: "client-1"
    });

    expect(environment).toEqual({
      HOME: "/Users/tester",
      PATH: "/usr/bin",
      CODEX_USER_AGENT: "farfield-tests",
      CODEX_CLIENT_ID: "client-1"
    });
  });

  it("allows explicit overrides for allowlisted keys", () => {
    const environment = buildAppServerSpawnEnvironment({
      baseEnvironment: {
        HOME: "/Users/tester",
        PATH: "/usr/bin"
      },
      overrideEnvironment: {
        PATH: "/custom/bin",
        CODEX_HOME: "/Users/tester/.codex"
      },
      userAgent: "farfield-tests",
      clientId: "client-2"
    });

    expect(environment).toEqual({
      HOME: "/Users/tester",
      PATH: "/custom/bin",
      CODEX_HOME: "/Users/tester/.codex",
      CODEX_USER_AGENT: "farfield-tests",
      CODEX_CLIENT_ID: "client-2"
    });
  });

  it("throws when overrides contain unapproved keys", () => {
    expect(() =>
      buildAppServerSpawnEnvironment({
        baseEnvironment: {},
        overrideEnvironment: {
          UNSAFE_KEY: "not-allowed"
        },
        userAgent: "farfield-tests",
        clientId: "client-3"
      })
    ).toThrowError(/Unrecognized key/);
  });
});

describe("isChildProcessAppServerTransportOptions", () => {
  it("returns true for child-process transport option shapes", () => {
    const isOptions = isChildProcessAppServerTransportOptions({
      executablePath: "/usr/local/bin/codex",
      userAgent: "farfield-tests",
      baseEnvironment: {
        PATH: "/usr/bin"
      },
      cwd: "/tmp/project",
      requestTimeoutMs: 5_000
    });

    expect(isOptions).toBe(true);
  });

  it("returns false for pre-built transport implementations", () => {
    const transport: AppServerTransport = {
      request: async () => ({}),
      close: async () => Promise.resolve()
    };

    expect(isChildProcessAppServerTransportOptions(transport)).toBe(false);
  });
});
