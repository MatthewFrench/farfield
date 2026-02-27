import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

interface BootstrapPersistencePaths {
  pushStatePath: string;
  pushReceiptsPath: string;
  pushSendsPath: string;
  clientErrorLogPath: string;
  pushLocalCaPath: string;
}

interface BootstrapEnvironmentSetup {
  environment: NodeJS.ProcessEnv;
  paths: BootstrapPersistencePaths;
}

interface BootstrapExecutionResult {
  statusCode: number | null;
  standardOutput: string;
  standardError: string;
}

const temporaryDirectoryPaths: string[] = [];
const ServerApplicationDirectoryPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const ServerBootstrapEntryPath = path.join(
  ServerApplicationDirectoryPath,
  "Source",
  "Application",
  "ServerBootstrap.ts",
);
const ServerBootstrapExecutionTimeoutMilliseconds = 10_000;

function createTemporaryDirectory(): string {
  const temporaryDirectoryPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "farfield-server-bootstrap-"),
  );
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

function createBootstrapEnvironmentSetup(): BootstrapEnvironmentSetup {
  const temporaryDirectoryPath = createTemporaryDirectory();
  const pushLocalCaPath = path.join(temporaryDirectoryPath, "local-root.crt");
  fs.writeFileSync(
    pushLocalCaPath,
    "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n",
    "utf8",
  );

  const paths: BootstrapPersistencePaths = {
    pushStatePath: path.join(temporaryDirectoryPath, "push-state.json"),
    pushReceiptsPath: path.join(temporaryDirectoryPath, "push-receipts.json"),
    pushSendsPath: path.join(temporaryDirectoryPath, "push-sends.json"),
    clientErrorLogPath: path.join(temporaryDirectoryPath, "client-errors.ndjson"),
    pushLocalCaPath,
  };

  return {
    environment: {
      HOST: "127.0.0.1",
      PORT: "4311",
      PUSH_ENABLED: "false",
      PUSH_STATE_PATH: paths.pushStatePath,
      PUSH_RECEIPTS_PATH: paths.pushReceiptsPath,
      PUSH_SENDS_PATH: paths.pushSendsPath,
      DEBUG_CLIENT_ERROR_LOG_PATH: paths.clientErrorLogPath,
      PUSH_LOCAL_CA_PATH: paths.pushLocalCaPath,
    },
    paths,
  };
}

function runBootstrapProcess(
  argumentsList: string[],
  environment: NodeJS.ProcessEnv,
): BootstrapExecutionResult {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", ServerBootstrapEntryPath, ...argumentsList],
    {
      cwd: ServerApplicationDirectoryPath,
      env: environment,
      encoding: "utf8",
      timeout: ServerBootstrapExecutionTimeoutMilliseconds,
    },
  );

  if (result.error) {
    throw result.error;
  }

  return {
    statusCode: result.status,
    standardOutput: result.stdout,
    standardError: result.stderr,
  };
}

function expectNoPersistenceFilesCreated(paths: BootstrapPersistencePaths): void {
  expect(fs.existsSync(paths.pushStatePath)).toBe(false);
  expect(fs.existsSync(paths.pushReceiptsPath)).toBe(false);
  expect(fs.existsSync(paths.pushSendsPath)).toBe(false);
  expect(fs.existsSync(paths.clientErrorLogPath)).toBe(false);
}

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    if (fs.existsSync(temporaryDirectoryPath)) {
      fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
    }
  }
});

describe("ServerBootstrap", () => {
  it("prints help and exits before persistence owners initialize", () => {
    const environmentSetup = createBootstrapEnvironmentSetup();

    const result = runBootstrapProcess(["--help"], environmentSetup.environment);

    expect(result.statusCode).toBe(0);
    expect(result.standardOutput).toContain("Farfield server");
    expect(result.standardOutput).toContain(
      "Usage: tsx watch Source/Application/ServerBootstrap.ts",
    );
    expectNoPersistenceFilesCreated(environmentSetup.paths);
  });

  it("fails invalid arguments before persistence owners initialize", () => {
    const environmentSetup = createBootstrapEnvironmentSetup();

    const result = runBootstrapProcess(
      ["--definitely-invalid-option"],
      environmentSetup.environment,
    );

    expect(result.statusCode).toBe(1);
    expect(result.standardError).toContain("Unknown argument: --definitely-invalid-option");
    expect(result.standardError).toContain("Run with --help to see valid arguments.");
    expectNoPersistenceFilesCreated(environmentSetup.paths);
  });
});
