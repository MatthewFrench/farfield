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

function createRepositoryFiles(upstreamSnapshotText: string, farfieldSnapshotText: string) {
  return [
    {
      relativePath: "docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt",
      content: upstreamSnapshotText,
    },
    {
      relativePath: "docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt",
      content: farfieldSnapshotText,
    },
    {
      relativePath: "packages/CodexInterfaceAdapter/Source/AppServerClientMethodConstants.ts",
      content: [
        "export const APP_SERVER_CLIENT_METHODS = {",
        '  listThreads: "thread/list",',
        '  sendUserMessage: "sendUserMessage",',
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
        "    SendUserMessage {",
        "        params: v1::SendUserMessageParams,",
        "        response: v1::SendUserMessageResponse,",
        "    },",
        "}",
        "/// Generates an `enum ServerRequest`",
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

describe("validate-app-server-method-drift-governance", () => {
  it("succeeds when snapshots match extracted upstream and Farfield methods", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles(
        "initialize\nsendUserMessage\nthread/list\n",
        "initialize\nsendUserMessage\nthread/list\n",
      ),
    );
    const upstreamCommonSourcePath = path.join(repositoryPath, "fixtures/upstream-common.rs");

    const result = runGovernanceScript(repositoryPath, upstreamCommonSourcePath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Method snapshots verified");
    expect(result.stderr).toBe("");
  });

  it("fails when upstream snapshot drifts from extracted upstream methods", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles(
        "initialize\nthread/list\n",
        "initialize\nsendUserMessage\nthread/list\n",
      ),
    );
    const upstreamCommonSourcePath = path.join(repositoryPath, "fixtures/upstream-common.rs");

    const result = runGovernanceScript(repositoryPath, upstreamCommonSourcePath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Upstream app-server method snapshot drift mismatch");
    expect(result.stderr).toContain("+ sendUserMessage");
  });

  it("fails when Farfield snapshot drifts from extracted Farfield methods", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles(
        "initialize\nsendUserMessage\nthread/list\n",
        "initialize\nsendUserMessage\nthread/list\nthread/read\n",
      ),
    );
    const upstreamCommonSourcePath = path.join(repositoryPath, "fixtures/upstream-common.rs");

    const result = runGovernanceScript(repositoryPath, upstreamCommonSourcePath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Farfield app-server method snapshot drift mismatch");
    expect(result.stderr).toContain("- thread/read");
  });
});
