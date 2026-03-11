import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTemporaryRepository,
  type RepositoryFileInput,
  removeDirectoryIfPresent,
  runNodeScript,
} from "./GovernanceScriptTestUtilities";

const ValidateScriptPathGovernanceScriptPath = path.resolve(
  process.cwd(),
  "scripts/tooling/validate-script-path-governance.mjs",
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

describe("validate-script-path-governance", { timeout: 15_000 }, () => {
  it("ignores this validator's own legacy-path rule literals", () => {
    const repositoryPath = createRepositoryWithCleanup([
      {
        relativePath: "scripts/tooling/validate-script-path-governance.mjs",
        content: [
          "const legacyPathRules = [",
          '  { legacyPathFragment: "apps/web", canonicalPathFragment: "apps/WebApplication" },',
          "];",
        ].join("\n"),
      },
      {
        relativePath: "scripts/operations/no-legacy-paths.mjs",
        content: 'process.stdout.write("ok\\n");',
      },
    ]);

    const result = runNodeScript(ValidateScriptPathGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no legacy path references found");
    expect(result.stderr).toBe("");
  });

  it("fails when another script still contains a legacy path reference", () => {
    const repositoryPath = createRepositoryWithCleanup([
      {
        relativePath: "scripts/tooling/validate-script-path-governance.mjs",
        content: 'process.stdout.write("validator fixture\\n");',
      },
      {
        relativePath: "scripts/operations/uses-legacy-path.mjs",
        content: 'const legacyPath = "apps/web";\n',
      },
    ]);

    const result = runNodeScript(ValidateScriptPathGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("uses-legacy-path.mjs");
    expect(result.stderr).toContain('contains "apps/web"');
  });
});
