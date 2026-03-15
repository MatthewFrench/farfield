import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type CommandExecutionResult,
  createTemporaryRepository,
  type RepositoryFileInput,
  removeDirectoryIfPresent,
} from "./GovernanceScriptTestUtilities";

const SyncAppServerCoverageMetricsScriptPath = path.resolve(
  process.cwd(),
  "scripts/tooling/sync-app-server-coverage-metrics.mjs",
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

function runSyncScript(
  repositoryPath: string,
  scriptArguments: readonly string[] = [],
): CommandExecutionResult {
  const result = childProcess.spawnSync(
    "node",
    [SyncAppServerCoverageMetricsScriptPath, ...scriptArguments],
    {
      cwd: repositoryPath,
      env: process.env,
      encoding: "utf8",
    },
  );
  if (result.error) {
    throw result.error;
  }

  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function createRepositoryFiles(): RepositoryFileInput[] {
  return [
    {
      relativePath: "scripts/tooling/validate-app-server-method-drift-governance.mjs",
      content: [
        "#!/usr/bin/env node",
        "process.stdout.write([",
        '  "[app-server-method-drift] Method snapshots verified",',
        '  "- keep methods: 3",',
        '  "- do-not-adopt methods: 2",',
        '  "- completion score: 5 / 5",',
        '  "- anti-completion methods used: 0",',
        '].join("\\n") + "\\n");',
        "",
      ].join("\n"),
    },
    {
      relativePath: "scripts/tooling/validate-app-server-event-surface-governance.mjs",
      content: [
        "#!/usr/bin/env node",
        "process.stdout.write([",
        '  "[app-server-event-surface-governance] Event-surface ledger verified",',
        '  "- upstream server-notification methods: 2",',
        '  "- upstream server-request methods: 2",',
        '  "- client-notification methods: 1",',
        '  "- keep methods: 4",',
        '  "- do-not-adopt methods: 1",',
        '  "- keep methods actively consumed or used: 4",',
        '  "- do-not-adopt methods avoided: 1",',
        '  "- anti-completion methods consumed or used: 0",',
        '  "- completion score: 5 / 5",',
        '  "- legacy raw usage metric: 4 / 5",',
        '].join("\\n") + "\\n");',
        "",
      ].join("\n"),
    },
    {
      relativePath: "docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt",
      content: [
        "initialize",
        "thread/list",
        "turn/start",
        "skills/list",
        "skills/config/write",
      ].join("\n"),
    },
    {
      relativePath: "docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt",
      content: ["initialize", "thread/list", "turn/start"].join("\n"),
    },
    {
      relativePath: "docs/debug/AppServerRequestMethodDecisionLedger.md",
      content: [
        "# App-Server Request Method Decision Ledger",
        "",
        "<!-- APP_SERVER_REQUEST_METRICS_START -->",
        "stale request metrics",
        "<!-- APP_SERVER_REQUEST_METRICS_END -->",
        "",
      ].join("\n"),
    },
    {
      relativePath: "docs/debug/AppServerEventSurfaceDecisionLedger.md",
      content: [
        "# App-Server Event Surface Decision Ledger",
        "",
        "<!-- APP_SERVER_EVENT_METRICS_START -->",
        "stale event metrics",
        "<!-- APP_SERVER_EVENT_METRICS_END -->",
        "",
      ].join("\n"),
    },
    {
      relativePath: "docs/debug/AppServerFeatureCoverageTracker.md",
      content: [
        "# App-Server Feature Coverage Tracker",
        "",
        "<!-- APP_SERVER_FEATURE_TRACKER_METRICS_START -->",
        "stale feature metrics",
        "<!-- APP_SERVER_FEATURE_TRACKER_METRICS_END -->",
        "",
      ].join("\n"),
    },
  ] satisfies RepositoryFileInput[];
}

describe("sync-app-server-coverage-metrics", { timeout: 15_000 }, () => {
  it("updates all marked metric blocks in write mode", () => {
    const repositoryPath = createRepositoryWithCleanup(createRepositoryFiles());

    const result = runSyncScript(repositoryPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("changed files: 3");

    const requestLedgerText = fs.readFileSync(
      path.join(repositoryPath, "docs/debug/AppServerRequestMethodDecisionLedger.md"),
      "utf8",
    );
    const eventLedgerText = fs.readFileSync(
      path.join(repositoryPath, "docs/debug/AppServerEventSurfaceDecisionLedger.md"),
      "utf8",
    );
    const featureTrackerText = fs.readFileSync(
      path.join(repositoryPath, "docs/debug/AppServerFeatureCoverageTracker.md"),
      "utf8",
    );

    expect(requestLedgerText).toContain("Total methods: 5");
    expect(requestLedgerText).toContain(
      "Policy completion score (`keep used + do-not-adopt avoided - do-not-adopt used`): 5 / 5",
    );
    expect(eventLedgerText).toContain("Server notifications: 2");
    expect(eventLedgerText).toContain(
      "Policy completion score (`keep active + do-not-adopt avoided - do-not-adopt active`): 5 / 5",
    );
    expect(featureTrackerText).toContain(
      "Keep-recommendation coverage at request-owner layer: `2 / 2` (`100.0%`).",
    );
    expect(featureTrackerText).toContain(
      "Event-surface policy completion score (`keep active + do-not-adopt avoided - do-not-adopt active`): `5 / 5` (`100.0%`); anti-completion events used: `0`.",
    );
  });

  it("fails in check mode when marked blocks are out of sync", () => {
    const repositoryPath = createRepositoryWithCleanup(createRepositoryFiles());

    const result = runSyncScript(repositoryPath, ["--check"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Coverage docs are out of date");
    expect(result.stderr).toContain("docs/debug/AppServerFeatureCoverageTracker.md");
  });
});
