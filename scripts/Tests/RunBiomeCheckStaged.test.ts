import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createExecutableRepositoryFile,
  createTemporaryRepository,
  type RepositoryFileInput,
  removeDirectoryIfPresent,
  runNodeScript,
} from "./GovernanceScriptTestUtilities";

const RunBiomeCheckStagedScriptPath = path.resolve(
  process.cwd(),
  "scripts/tooling/run-biome-check-staged.mjs",
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

describe("run-biome-check-staged", () => {
  it("skips when staged files are outside Biome-managed source/test scope", () => {
    const repositoryPath = createRepositoryWithCleanup([
      { relativePath: "README.md", content: "# test" },
    ]);

    const result = runNodeScript(RunBiomeCheckStagedScriptPath, repositoryPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No staged files in Biome-managed source/test scope");
  });

  it("runs bunx check when staged files include Biome-managed source scope", () => {
    const repositoryPath = createRepositoryWithCleanup([
      {
        relativePath: "apps/WebApplication/Source/SampleOwner.ts",
        content: "export const value = 1;\n",
      },
    ]);

    createExecutableRepositoryFile(
      repositoryPath,
      "fake-bin/bunx",
      '#!/usr/bin/env sh\nprintf \'%s\\n\' "$@" > "$PWD/bunx-args.txt"\nexit 0\n',
    );

    const result = runNodeScript(RunBiomeCheckStagedScriptPath, repositoryPath, {
      PATH: `${path.join(repositoryPath, "fake-bin")}:${process.env.PATH ?? ""}`,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Running Biome check on 1 staged file(s)");
    const bunxArgumentsFilePath = path.join(repositoryPath, "bunx-args.txt");
    const bunxArguments = fs.readFileSync(bunxArgumentsFilePath, "utf8");
    expect(bunxArguments).toContain("@biomejs/biome");
    expect(bunxArguments).toContain("check");
    expect(bunxArguments).toContain("--error-on-warnings");
    expect(bunxArguments).toContain("apps/WebApplication/Source/SampleOwner.ts");
  });
});
