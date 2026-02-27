import { describe, expect, it } from "vitest";
import { parseAppServerIncomingLine } from "../Source/AppServerIncomingLineParser.js";
import {
  type AppServerTransport,
  buildAppServerSpawnEnvironment,
  isChildProcessAppServerTransportOptions,
} from "../Source/AppServerTransport.js";

describe("buildAppServerSpawnEnvironment", () => {
  it("keeps only allowlisted inherited keys and injects codex identity keys", () => {
    const environment = buildAppServerSpawnEnvironment({
      baseEnvironment: {
        HOME: "/Users/tester",
        PATH: "/usr/bin",
        RANDOM_KEY: "ignored",
      },
      userAgent: "farfield-tests",
      clientId: "client-1",
    });

    expect(environment).toEqual({
      HOME: "/Users/tester",
      PATH: "/usr/bin",
      CODEX_USER_AGENT: "farfield-tests",
      CODEX_CLIENT_ID: "client-1",
    });
  });

  it("allows explicit overrides for allowlisted keys", () => {
    const environment = buildAppServerSpawnEnvironment({
      baseEnvironment: {
        HOME: "/Users/tester",
        PATH: "/usr/bin",
      },
      overrideEnvironment: {
        PATH: "/custom/bin",
        CODEX_HOME: "/Users/tester/.codex",
      },
      userAgent: "farfield-tests",
      clientId: "client-2",
    });

    expect(environment).toEqual({
      HOME: "/Users/tester",
      PATH: "/custom/bin",
      CODEX_HOME: "/Users/tester/.codex",
      CODEX_USER_AGENT: "farfield-tests",
      CODEX_CLIENT_ID: "client-2",
    });
  });

  it("throws when overrides contain unapproved keys", () => {
    expect(() =>
      buildAppServerSpawnEnvironment({
        baseEnvironment: {},
        overrideEnvironment: {
          UNSAFE_KEY: "not-allowed",
        },
        userAgent: "farfield-tests",
        clientId: "client-3",
      }),
    ).toThrowError(/Unrecognized key/);
  });

  it("throws when codex identity values are empty", () => {
    expect(() =>
      buildAppServerSpawnEnvironment({
        baseEnvironment: {},
        userAgent: "",
        clientId: "client-4",
      }),
    ).toThrowError(/at least 1 character/);

    expect(() =>
      buildAppServerSpawnEnvironment({
        baseEnvironment: {},
        userAgent: "farfield-tests",
        clientId: "",
      }),
    ).toThrowError(/at least 1 character/);
  });
});

describe("isChildProcessAppServerTransportOptions", () => {
  it("returns true for child-process transport option shapes", () => {
    const isOptions = isChildProcessAppServerTransportOptions({
      executablePath: "/usr/local/bin/codex",
      userAgent: "farfield-tests",
      baseEnvironment: {
        PATH: "/usr/bin",
      },
      cwd: "/tmp/project",
      requestTimeoutMs: 5_000,
    });

    expect(isOptions).toBe(true);
  });

  it("returns false for pre-built transport implementations", () => {
    const transport: AppServerTransport = {
      request: async () => ({}),
      close: async () => Promise.resolve(),
    };

    expect(isChildProcessAppServerTransportOptions(transport)).toBe(false);
  });
});

describe("parseAppServerIncomingLine", () => {
  it("returns ignore for empty lines", () => {
    expect(parseAppServerIncomingLine("  ")).toEqual({ kind: "ignore" });
  });

  it("returns invalid-json errors for malformed payloads", () => {
    expect(parseAppServerIncomingLine("{")).toEqual({
      kind: "error",
      errorKind: "invalid-json",
    });
  });

  it("returns schema-mismatch errors for non-JSON-RPC envelopes", () => {
    const parsed = parseAppServerIncomingLine('{"id":1}');
    expect(parsed.kind).toBe("error");
    if (parsed.kind !== "error") {
      return;
    }

    expect(parsed.errorKind).toBe("schema-mismatch");
    if (parsed.errorKind !== "schema-mismatch") {
      return;
    }

    expect(parsed.errorMessage.length).toBeGreaterThan(0);
  });

  it("returns parsed response messages for valid JSON-RPC responses", () => {
    const parsed = parseAppServerIncomingLine('{"jsonrpc":"2.0","id":1,"result":{}}');
    expect(parsed.kind).toBe("message");
    if (parsed.kind !== "message") {
      return;
    }

    expect(parsed.message.kind).toBe("response");
    if (parsed.message.kind !== "response") {
      return;
    }

    expect(parsed.message.value.id).toBe(1);
    expect(parsed.message.value.result).toEqual({});
  });
});
