import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type CommandExecutionResult,
  createTemporaryRepository,
  type RepositoryFileInput,
  removeDirectoryIfPresent,
  runNodeScript,
} from "./GovernanceScriptTestUtilities";

const ValidateAppServerMethodDriftGovernanceScriptPath = path.resolve(
  process.cwd(),
  "scripts/tooling/validate-app-server-method-drift-governance.mjs",
);
const UpstreamCommonSourcePathEnvironmentVariableName =
  "APP_SERVER_METHOD_DRIFT_UPSTREAM_COMMON_RS_PATH";

const temporaryRepositoryPaths: string[] = [];

function createRepositoryWithCleanup(files: readonly RepositoryFileInput[]): string {
  const repositoryPath = createTemporaryRepository(files);
  temporaryRepositoryPaths.push(repositoryPath);
  return repositoryPath;
}

afterEach(() => {
  for (const repositoryPath of temporaryRepositoryPaths.splice(0)) {
    removeDirectoryIfPresent(repositoryPath);
  }
});

function createRepositoryFiles(input: {
  upstreamClientRequestSnapshotText: string;
  farfieldClientRequestSnapshotText: string;
  upstreamServerNotificationSnapshotText: string;
  upstreamServerRequestSnapshotText: string;
  farfieldServerRequestSnapshotText: string;
}) {
  return [
    {
      relativePath: "docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt",
      content: input.upstreamClientRequestSnapshotText,
    },
    {
      relativePath: "docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt",
      content: input.farfieldClientRequestSnapshotText,
    },
    {
      relativePath: "docs/debug/AppServerUpstreamServerNotificationMethods.snapshot.txt",
      content: input.upstreamServerNotificationSnapshotText,
    },
    {
      relativePath: "docs/debug/AppServerUpstreamServerRequestMethods.snapshot.txt",
      content: input.upstreamServerRequestSnapshotText,
    },
    {
      relativePath: "docs/debug/AppServerFarfieldServerRequestMethods.snapshot.txt",
      content: input.farfieldServerRequestSnapshotText,
    },
    {
      relativePath: "packages/CodexInterfaceAdapter/Source/AppServerClientMethodConstants.ts",
      content: [
        "export const APP_SERVER_CLIENT_METHODS = {",
        '  listThreads: "thread/list",',
        '  startTurn: "turn/start",',
        "} as const;",
        "",
      ].join("\n"),
    },
    {
      relativePath: "packages/CodexInterfaceAdapter/Source/AppServerServerRequestMethodConstants.ts",
      content: [
        "export const APP_SERVER_HANDLED_SERVER_REQUEST_METHODS = {",
        '  toolRequestUserInput: "item/tool/requestUserInput",',
        "} as const;",
        "",
      ].join("\n"),
    },
    {
      relativePath: "packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts",
      content: 'export const APP_SERVER_INITIALIZE_METHOD = "initialize";\n',
    },
    {
      relativePath: "fixtures/upstream-common.rs",
      content: [
        "client_request_definitions! {",
        "    Initialize {",
        "        params: v1::InitializeParams,",
        "        response: v1::InitializeResponse,",
        "    },",
        '    ThreadList => "thread/list" {',
        "        params: v2::ThreadListParams,",
        "        response: v2::ThreadListResponse,",
        "    },",
        '    TurnStart => "turn/start" {',
        "        params: v2::TurnStartParams,",
        "        response: v2::TurnStartResponse,",
        "    },",
        "}",
        "",
        "server_request_definitions! {",
        '    ToolRequestUserInput => "item/tool/requestUserInput" {',
        "        params: v2::ToolRequestUserInputParams,",
        "        response: v2::ToolRequestUserInputResponse,",
        "    },",
        "}",
        "",
        "server_notification_definitions! {",
        '    ThreadStarted => "thread/started" (v2::ThreadStartedNotification),',
        '    TurnStarted => "turn/started" (v2::TurnStartedNotification),',
        "    #[serde(rename = \"account/login/completed\")]",
        "    #[ts(rename = \"account/login/completed\")]",
        "    #[strum(serialize = \"account/login/completed\")]",
        "    AccountLoginCompleted(v2::AccountLoginCompletedNotification),",
        "}",
        "",
      ].join("\n"),
    },
  ] satisfies RepositoryFileInput[];
}

function runGovernanceScript(
  repositoryPath: string,
  upstreamCommonSourcePath: string,
): CommandExecutionResult {
  return runNodeScript(ValidateAppServerMethodDriftGovernanceScriptPath, repositoryPath, {
    [UpstreamCommonSourcePathEnvironmentVariableName]: upstreamCommonSourcePath,
  });
}

describe("validate-app-server-method-drift-governance", { timeout: 15_000 }, () => {
  it("succeeds when snapshots match extracted upstream and Farfield methods", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamClientRequestSnapshotText: "initialize\nthread/list\nturn/start\n",
        farfieldClientRequestSnapshotText: "initialize\nthread/list\nturn/start\n",
        upstreamServerNotificationSnapshotText:
          "account/login/completed\nthread/started\nturn/started\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\n",
      }),
    );
    const upstreamCommonSourcePath = path.join(repositoryPath, "fixtures/upstream-common.rs");

    const result = runGovernanceScript(repositoryPath, upstreamCommonSourcePath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Method snapshots verified");
    expect(result.stderr).toBe("");
  });

  it("fails when upstream client-request snapshot drifts from extracted methods", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamClientRequestSnapshotText: "initialize\nthread/list\n",
        farfieldClientRequestSnapshotText: "initialize\nthread/list\nturn/start\n",
        upstreamServerNotificationSnapshotText:
          "account/login/completed\nthread/started\nturn/started\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\n",
      }),
    );
    const upstreamCommonSourcePath = path.join(repositoryPath, "fixtures/upstream-common.rs");

    const result = runGovernanceScript(repositoryPath, upstreamCommonSourcePath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Upstream app-server client-request method snapshot drift mismatch");
    expect(result.stderr).toContain("+ turn/start");
  });

  it("fails when upstream server-notification snapshot drifts from extracted methods", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamClientRequestSnapshotText: "initialize\nthread/list\nturn/start\n",
        farfieldClientRequestSnapshotText: "initialize\nthread/list\nturn/start\n",
        upstreamServerNotificationSnapshotText: "thread/started\nturn/started\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\n",
      }),
    );
    const upstreamCommonSourcePath = path.join(repositoryPath, "fixtures/upstream-common.rs");

    const result = runGovernanceScript(repositoryPath, upstreamCommonSourcePath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Upstream app-server server-notification method snapshot drift mismatch",
    );
    expect(result.stderr).toContain("+ account/login/completed");
  });

  it("fails when Farfield server-request snapshot drifts from extracted methods", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamClientRequestSnapshotText: "initialize\nthread/list\nturn/start\n",
        farfieldClientRequestSnapshotText: "initialize\nthread/list\nturn/start\n",
        upstreamServerNotificationSnapshotText:
          "account/login/completed\nthread/started\nturn/started\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\nitem/tool/call\n",
      }),
    );
    const upstreamCommonSourcePath = path.join(repositoryPath, "fixtures/upstream-common.rs");

    const result = runGovernanceScript(repositoryPath, upstreamCommonSourcePath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Farfield app-server server-request method snapshot drift mismatch");
    expect(result.stderr).toContain("- item/tool/call");
  });
});
