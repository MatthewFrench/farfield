import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readServerRuntimeConfiguration } from "../Source/Application/Configuration/ServerRuntimeConfiguration.js";

const temporaryDirectoryPaths: string[] = [];

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-runtime-configuration-"));
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
    PUSH_LOCAL_CA_PATH: path.join(temporaryDirectoryPath, "local-root.crt")
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
    const configuration = readServerRuntimeConfiguration(buildBaseEnvironment(temporaryDirectoryPath));

    expect(configuration.host).toBe("127.0.0.1");
    expect(configuration.port).toBe(4311);
    expect(configuration.pushEnabled).toBe(false);
    expect(configuration.pushStatePathResolution.filePath).toBe(
      path.join(temporaryDirectoryPath, "push-state.json")
    );
    expect(configuration.pushReceiptsPath).toBe(path.join(temporaryDirectoryPath, "push-receipts.json"));
    expect(configuration.pushSendsPath).toBe(path.join(temporaryDirectoryPath, "push-sends.json"));
    expect(configuration.clientErrorLogPath).toBe(path.join(temporaryDirectoryPath, "client-errors.ndjson"));
    expect(configuration.apiAuthRequired).toBe(false);
    expect(configuration.apiSessionCookieName).toBe("farfield_session");
    expect(configuration.apiSessionTimeToLiveMs).toBe(28_800_000);
    expect(configuration.apiSessionSecureCookie).toBe(false);
  });

  it("requires VAPID settings when push is enabled", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const environment: NodeJS.ProcessEnv = {
      ...buildBaseEnvironment(temporaryDirectoryPath),
      PUSH_ENABLED: "true"
    };

    expect(() => {
      readServerRuntimeConfiguration(environment);
    }).toThrow("PUSH_ENABLED=true requires PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY, and PUSH_VAPID_SUBJECT");
  });

  it("uses API token precedence and normalizes invalid port values", () => {
    const temporaryDirectoryPath = createTemporaryDirectory();
    const configuration = readServerRuntimeConfiguration({
      ...buildBaseEnvironment(temporaryDirectoryPath),
      PORT: "not-a-number",
      PUSH_API_TOKEN: "push_token"
    });

    expect(configuration.port).toBe(4311);
    expect(configuration.apiToken).toBe("push_token");
    expect(configuration.apiAuthRequired).toBe(true);
    expect(configuration.apiSessionSigningSecret).toBe("push_token");
  });
});
