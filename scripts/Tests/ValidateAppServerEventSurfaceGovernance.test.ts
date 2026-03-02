import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type CommandExecutionResult,
  createTemporaryRepository,
  type RepositoryFileInput,
  removeDirectoryIfPresent,
  runNodeScript,
} from "./GovernanceScriptTestUtilities";

const ValidateAppServerEventSurfaceGovernanceScriptPath = path.resolve(
  process.cwd(),
  "scripts/tooling/validate-app-server-event-surface-governance.mjs",
);

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
  upstreamServerNotificationSnapshotText: string;
  upstreamServerRequestSnapshotText: string;
  farfieldServerRequestSnapshotText: string;
  eventSurfaceDecisionLedgerText: string;
}) {
  return [
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
      relativePath: "docs/debug/AppServerEventSurfaceDecisionLedger.md",
      content: input.eventSurfaceDecisionLedgerText,
    },
    {
      relativePath: "packages/CodexInterfaceAdapter/Source/AppServerTransportConstants.ts",
      content: 'export const APP_SERVER_INITIALIZED_NOTIFICATION_METHOD = "initialized";\n',
    },
  ] satisfies RepositoryFileInput[];
}

function createDecisionLedgerText(rows: readonly string[]) {
  return [
    "# App-Server Event Surface Decision Ledger",
    "",
    "| Method | Surface Type | Current Farfield State | Recommendation | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function runGovernanceScript(repositoryPath: string): CommandExecutionResult {
  return runNodeScript(ValidateAppServerEventSurfaceGovernanceScriptPath, repositoryPath);
}

describe("validate-app-server-event-surface-governance", { timeout: 15_000 }, () => {
  it("succeeds when event-surface ledger matches snapshots and anti-completion is zero", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamServerNotificationSnapshotText: "thread/started\nturn/started\nauthStatusChange\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\n",
        eventSurfaceDecisionLedgerText: createDecisionLedgerText([
          "| `authStatusChange` | server-to-client notification | Not consumed | Do not adopt | Deprecated surface |",
          "| `thread/started` | server-to-client notification | Consumed in diagnostics | Keep for diagnostics | Active surface |",
          "| `turn/started` | server-to-client notification | Consumed in diagnostics | Keep for diagnostics | Active surface |",
          "| `item/tool/requestUserInput` | server-to-client request | Used now | Keep | Active server-request surface |",
          "| `initialized` | client-to-server notification | Used now | Keep | Required handshake acknowledgement |",
        ]),
      }),
    );

    const result = runGovernanceScript(repositoryPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Event-surface ledger verified");
    expect(result.stdout).toContain("completion score: 5 / 5");
  });

  it("fails when event-surface ledger method list drifts from upstream snapshots", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamServerNotificationSnapshotText: "thread/started\nturn/started\nauthStatusChange\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\n",
        eventSurfaceDecisionLedgerText: createDecisionLedgerText([
          "| `authStatusChange` | server-to-client notification | Not consumed | Do not adopt | Deprecated surface |",
          "| `thread/started` | server-to-client notification | Consumed in diagnostics | Keep for diagnostics | Active surface |",
          "| `item/tool/requestUserInput` | server-to-client request | Used now | Keep | Active server-request surface |",
          "| `initialized` | client-to-server notification | Used now | Keep | Required handshake acknowledgement |",
        ]),
      }),
    );

    const result = runGovernanceScript(repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("method list drift mismatch");
    expect(result.stderr).toContain("- turn/started");
  });

  it("fails when decision-ledger used server-request methods drift from Farfield snapshot", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamServerNotificationSnapshotText: "thread/started\nturn/started\nauthStatusChange\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\nitem/tool/call\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\nitem/tool/call\n",
        eventSurfaceDecisionLedgerText: createDecisionLedgerText([
          "| `authStatusChange` | server-to-client notification | Not consumed | Do not adopt | Deprecated surface |",
          "| `thread/started` | server-to-client notification | Consumed in diagnostics | Keep for diagnostics | Active surface |",
          "| `turn/started` | server-to-client notification | Consumed in diagnostics | Keep for diagnostics | Active surface |",
          "| `item/tool/requestUserInput` | server-to-client request | Used now | Keep | Active server-request surface |",
          "| `item/tool/call` | server-to-client request | Not used | Keep | Active server-request surface |",
          "| `initialized` | client-to-server notification | Used now | Keep | Required handshake acknowledgement |",
        ]),
      }),
    );

    const result = runGovernanceScript(repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("used server-request rows drift mismatch");
    expect(result.stderr).toContain("- item/tool/call");
  });

  it("fails when methods marked do-not-adopt are consumed or used", () => {
    const repositoryPath = createRepositoryWithCleanup(
      createRepositoryFiles({
        upstreamServerNotificationSnapshotText: "thread/started\nturn/started\nauthStatusChange\n",
        upstreamServerRequestSnapshotText: "item/tool/requestUserInput\n",
        farfieldServerRequestSnapshotText: "item/tool/requestUserInput\n",
        eventSurfaceDecisionLedgerText: createDecisionLedgerText([
          "| `authStatusChange` | server-to-client notification | Consumed in diagnostics | Do not adopt | Deprecated surface |",
          "| `thread/started` | server-to-client notification | Consumed in diagnostics | Keep for diagnostics | Active surface |",
          "| `turn/started` | server-to-client notification | Consumed in diagnostics | Keep for diagnostics | Active surface |",
          "| `item/tool/requestUserInput` | server-to-client request | Used now | Keep | Active server-request surface |",
          "| `initialized` | client-to-server notification | Used now | Keep | Required handshake acknowledgement |",
        ]),
      }),
    );

    const result = runGovernanceScript(repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Anti-completion event methods detected");
    expect(result.stderr).toContain("- authStatusChange");
  });
});
