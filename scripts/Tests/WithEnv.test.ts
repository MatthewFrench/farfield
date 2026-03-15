import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WithEnvScriptPath = path.resolve(process.cwd(), "scripts/tooling/with-env.mjs");
const temporaryDirectoryPaths: string[] = [];

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(0)) {
    fs.rmSync(temporaryDirectoryPath, {
      recursive: true,
      force: true,
    });
  }
});

describe("with-env", () => {
  it("inherits the Windows Path key for child commands", () => {
    const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-with-env-"));
    temporaryDirectoryPaths.push(temporaryDirectoryPath);

    const commandText = `${JSON.stringify(process.execPath)} -e "process.stdout.write(process.env.Path ?? '')"`;
    const executionResult = childProcess.spawnSync(
      process.execPath,
      [WithEnvScriptPath, commandText],
      {
        cwd: temporaryDirectoryPath,
        env: {
          Path: "C:\\Tools",
        },
        encoding: "utf8",
      },
    );

    expect(executionResult.status).toBe(0);
    expect(executionResult.stdout).toBe("C:\\Tools");
  });
});
