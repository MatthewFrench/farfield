import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTemporaryRepository,
  type RepositoryFileInput,
  removeDirectoryIfPresent,
  runNodeScript,
} from "./GovernanceScriptTestUtilities";

const ValidateLockfileGovernanceScriptPath = path.resolve(
  process.cwd(),
  "scripts/tooling/validate-lockfile-governance.mjs",
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

describe("validate-lockfile-governance", () => {
  it("succeeds when only bun.lock is tracked", () => {
    const repositoryPath = createRepositoryWithCleanup([
      { relativePath: "bun.lock", content: "lockfile-content" },
      { relativePath: "README.md", content: "# test" },
    ]);

    const result = runNodeScript(ValidateLockfileGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no disallowed lockfiles found");
    expect(result.stderr).toBe("");
  });

  it("fails when package-lock.json is tracked", () => {
    const repositoryPath = createRepositoryWithCleanup([
      { relativePath: "bun.lock", content: "lockfile-content" },
      { relativePath: "package-lock.json", content: "{}" },
    ]);

    const result = runNodeScript(ValidateLockfileGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Found disallowed lockfiles");
    expect(result.stderr).toContain("package-lock.json");
  });

  it("fails when yarn.lock is tracked in nested paths", () => {
    const repositoryPath = createRepositoryWithCleanup([
      { relativePath: "bun.lock", content: "lockfile-content" },
      { relativePath: "nested/yarn.lock", content: "lockfile-content" },
    ]);

    const result = runNodeScript(ValidateLockfileGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("nested/yarn.lock");
  });
});
