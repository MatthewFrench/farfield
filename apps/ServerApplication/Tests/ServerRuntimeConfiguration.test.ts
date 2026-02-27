import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readServerRuntimeConfiguration } from "../Source/Application/Configuration/ServerRuntimeConfiguration.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "farfield-runtime-configuration-"),
  );
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

function buildBaseEnvironment(temporaryDirectoryPath: string): NodeJS.ProcessEnv {
  return {
    HOST: "127.0.0.1",
    PORT: "4311",
    PUSH_ENABLED: "false",
    PUSH_STATE_PATH: path.join(temporaryDirectoryPath, "push-state.json"),
    PUSH_RECEIPTS_PATH: path.join(temporaryDirectoryPath, "push-receipts.json"),
    PUSH_SENDS_PATH: path.join(temporaryDirectoryPath, "push-sends.json"),
    DEBUG_CLIENT_ERROR_LOG_PATH: path.join(temporaryDirectoryPath, "client-errors.ndjson"),
    PUSH_LOCAL_CA_PATH: path.join(temporaryDirectoryPath, "local-root.crt"),
  };
}

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

describe("readServerRuntimeConfiguration", () => {
  it("parses configuration with deterministic defaults and paths", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration(
      buildBaseEnvironment(temporaryDirectoryPath),
    );

    expect(configuration.logLevel).toBe("info");
    expect(configuration.host).toBe("127.0.0.1");
    expect(configuration.port).toBe(4311);
    expect(configuration.pushEnabled).toBe(false);
    expect(configuration.runtimeStateSnapshotCacheTimeToLiveMs).toBe(250);
    expect(configuration.historyPayloadSummaryMaximumBytes).toBe(131_072);
    expect(configuration.capabilityListTimeoutMs).toBe(8_000);
    expect(configuration.threadListAdapterTimeoutMs).toBe(7_500);
    expect(configuration.pushTestSendTimeoutMs).toBe(7_500);
    expect(configuration.pushStatePathResolution.filePath).toBe(
      path.join(temporaryDirectoryPath, "push-state.json"),
    );
    expect(configuration.pushReceiptsPath).toBe(
      path.join(temporaryDirectoryPath, "push-receipts.json"),
    );
    expect(configuration.pushSendsPath).toBe(path.join(temporaryDirectoryPath, "push-sends.json"));
    expect(configuration.clientErrorLogPath).toBe(
      path.join(temporaryDirectoryPath, "client-errors.ndjson"),
    );
    expect(configuration.apiAuthRequired).toBe(false);
    expect(configuration.apiSessionCookieName).toBe("farfield_session");
    expect(configuration.apiSessionTimeToLiveMs).toBe(28_800_000);
    expect(configuration.apiSessionSecureCookie).toBe(false);
    expect(configuration.ntfyConfiguration.enabled).toBe(false);
    expect(configuration.invalidThreadStreamEventsLogPath).toBe(
      path.resolve(
        process.cwd(),
        ".runtime",
        "logs",
        "threads",
        "invalid-thread-stream-events.ndjson",
      ),
    );
  });

  it("requires VAPID settings when push is enabled", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const environment: NodeJS.ProcessEnv = {
      ...buildBaseEnvironment(temporaryDirectoryPath),
      PUSH_ENABLED: "true",
    };

    expect(() => {
      readServerRuntimeConfiguration(environment);
    }).toThrow(
      "PUSH_ENABLED=true requires PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY, and PUSH_VAPID_SUBJECT",
    );
  });

  it("uses API token precedence and normalizes invalid port values", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      PORT: "not-a-number",
      PUSH_API_TOKEN: "push_token",
    });

    expect(configuration.port).toBe(4311);
    expect(configuration.apiToken).toBe("push_token");
    expect(configuration.apiAuthRequired).toBe(true);
    expect(configuration.apiSessionSigningSecret).toBe("push_token");
  });

  it("prefers API_TOKEN when set, even when PUSH_API_TOKEN is also set", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      API_TOKEN: "primary_token",
      PUSH_API_TOKEN: "secondary_token",
    });

    expect(configuration.apiToken).toBe("primary_token");
    expect(configuration.apiAuthRequired).toBe(true);
  });

  it("treats an explicitly empty API_TOKEN as authoritative over PUSH_API_TOKEN", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      API_TOKEN: "   ",
      PUSH_API_TOKEN: "secondary_token",
    });

    expect(configuration.apiToken).toBe("");
    expect(configuration.apiAuthRequired).toBe(false);
  });

  it("uses WEB_BUILD_ID nullish precedence before VITE_APP_BUILD_ID", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      WEB_BUILD_ID: "  ",
      VITE_APP_BUILD_ID: "vite-build-id",
    });

    expect(configuration.webHealthBuildId).toBe("dev");
  });

  it("accepts timeout overrides from environment", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      THREAD_LIST_ADAPTER_TIMEOUT_MS: "12000",
      PUSH_TEST_SEND_TIMEOUT_MS: "3000",
    });

    expect(configuration.threadListAdapterTimeoutMs).toBe(12_000);
    expect(configuration.pushTestSendTimeoutMs).toBe(3_000);
  });

  it("parses strict boolean tokens for secure cookie configuration", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const secureCookieEnabledConfiguration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      API_SESSION_SECURE_COOKIE: "1",
    });
    const secureCookieDisabledConfiguration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      API_SESSION_SECURE_COOKIE: "0",
    });
    const invalidSecureCookieTokenConfiguration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      API_SESSION_SECURE_COOKIE: "TRUE",
    });

    expect(secureCookieEnabledConfiguration.apiSessionSecureCookie).toBe(true);
    expect(secureCookieDisabledConfiguration.apiSessionSecureCookie).toBe(false);
    expect(invalidSecureCookieTokenConfiguration.apiSessionSecureCookie).toBe(false);
  });

  it("uses default client error maximum entries when configured value is not a positive integer", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      DEBUG_CLIENT_ERROR_MAX_ENTRIES: "not-an-integer",
    });

    expect(configuration.clientErrorMaxEntries).toBe(2_000);
  });

  it("fails for empty optional path environment values with a clear variable error", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    expect(() => {
      readServerRuntimeConfiguration({
        ...buildBaseEnvironment(temporaryDirectoryPath),
        DEBUG_CLIENT_ERROR_LOG_PATH: "   ",
      });
    }).toThrow("DEBUG_CLIENT_ERROR_LOG_PATH must be a non-empty path when set");
  });

  it("validates logger level and optional invalid stream log path", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuredInvalidStreamLogPath = path.join(
      temporaryDirectoryPath,
      "invalid-stream-events.ndjson",
    );
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      LOG_LEVEL: "debug",
      FARFIELD_INVALID_STREAM_LOG_PATH: configuredInvalidStreamLogPath,
    });

    expect(configuration.logLevel).toBe("debug");
    expect(configuration.invalidThreadStreamEventsLogPath).toBe(configuredInvalidStreamLogPath);
  });

  it("fails fast for unsupported logger levels", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    expect(() => {
      readServerRuntimeConfiguration({
        ...buildBaseEnvironment(temporaryDirectoryPath),
        LOG_LEVEL: "verbose",
      });
    }).toThrow();
  });
});
