import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTemporaryRepository,
  type RepositoryFileInput,
  removeDirectoryIfPresent,
  runNodeScript,
} from "./GovernanceScriptTestUtilities";

const ValidateBiomeIgnoreGovernanceScriptPath = path.resolve(
  process.cwd(),
  "scripts/tooling/validate-biome-ignore-governance.mjs",
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

describe("validate-biome-ignore-governance", { timeout: 15_000 }, () => {
  it("accepts specific biome-ignore rationale text", () => {
    const repositoryPath = createRepositoryWithCleanup([
      {
        relativePath: "source.ts",
        content:
          "// biome-ignore lint/suspicious/noExplicitAny: temporary parser parity check for generated fixture shape\nconst value = 1;\n",
      },
    ]);

    const result = runNodeScript(ValidateBiomeIgnoreGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ignore directives are valid");
    expect(result.stderr).toBe("");
  });

  it("fails when biome-ignore does not include a rationale", () => {
    const repositoryPath = createRepositoryWithCleanup([
      {
        relativePath: "source.ts",
        content: "// biome-ignore lint/suspicious/noExplicitAny\nconst value = 1;\n",
      },
    ]);

    const result = runNodeScript(ValidateBiomeIgnoreGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing rationale after ':'");
  });

  it("fails when biome-ignore rationale is placeholder text", () => {
    const repositoryPath = createRepositoryWithCleanup([
      {
        relativePath: "source.ts",
        content: "// biome-ignore lint/suspicious/noExplicitAny: todo\nconst value = 1;\n",
      },
    ]);

    const result = runNodeScript(ValidateBiomeIgnoreGovernanceScriptPath, repositoryPath);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("placeholder text");
  });
});
