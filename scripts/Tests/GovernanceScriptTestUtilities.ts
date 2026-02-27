import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TemporaryRepositoryPrefix = "farfield-governance-tests-";
const GitAddCommandArgumentsPrefix = Object.freeze(["add", "--"]);

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RepositoryFileInput {
  relativePath: string;
  content: string;
  tracked?: boolean;
}

function executeProcess(
  command: string,
  commandArguments: readonly string[],
  workingDirectoryPath: string,
  environmentVariables: NodeJS.ProcessEnv,
): CommandExecutionResult {
  const executionResult = childProcess.spawnSync(command, commandArguments, {
    cwd: workingDirectoryPath,
    env: environmentVariables,
    encoding: "utf8",
  });

  if (executionResult.error) {
    throw executionResult.error;
  }

  return {
    exitCode: executionResult.status ?? -1,
    stdout: executionResult.stdout ?? "",
    stderr: executionResult.stderr ?? "",
  };
}

function executeProcessOrThrow(
  command: string,
  commandArguments: readonly string[],
  workingDirectoryPath: string,
  environmentVariables: NodeJS.ProcessEnv,
): void {
  const result = executeProcess(
    command,
    commandArguments,
    workingDirectoryPath,
    environmentVariables,
  );

  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${commandArguments.join(" ")}\n` +
        `exitCode=${String(result.exitCode)}\nstdout=${result.stdout}\nstderr=${result.stderr}`,
    );
  }
}

export function writeRepositoryFile(
  repositoryPath: string,
  relativeFilePath: string,
  fileContent: string,
): void {
  const absoluteFilePath = path.join(repositoryPath, relativeFilePath);
  fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
  fs.writeFileSync(absoluteFilePath, fileContent, "utf8");
}

export function stageRepositoryFiles(
  repositoryPath: string,
  relativeFilePaths: readonly string[],
): void {
  if (relativeFilePaths.length === 0) {
    return;
  }

  executeProcessOrThrow(
    "git",
    [...GitAddCommandArgumentsPrefix, ...relativeFilePaths],
    repositoryPath,
    process.env,
  );
}

export function createTemporaryRepository(files: readonly RepositoryFileInput[]): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), TemporaryRepositoryPrefix));
  executeProcessOrThrow("git", ["init", "--quiet"], repositoryPath, process.env);

  const trackedFilePaths: string[] = [];
  for (const file of files) {
    writeRepositoryFile(repositoryPath, file.relativePath, file.content);
    if (file.tracked !== false) {
      trackedFilePaths.push(file.relativePath);
    }
  }

  stageRepositoryFiles(repositoryPath, trackedFilePaths);
  return repositoryPath;
}

export function createExecutableRepositoryFile(
  repositoryPath: string,
  relativeFilePath: string,
  fileContent: string,
): void {
  writeRepositoryFile(repositoryPath, relativeFilePath, fileContent);
  executeProcessOrThrow("chmod", ["+x", relativeFilePath], repositoryPath, process.env);
}

export function runNodeScript(
  scriptPath: string,
  repositoryPath: string,
  environmentOverrides: NodeJS.ProcessEnv = {},
): CommandExecutionResult {
  return executeProcess("node", [scriptPath], repositoryPath, {
    ...process.env,
    ...environmentOverrides,
  });
}

export function removeDirectoryIfPresent(directoryPath: string): void {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  fs.rmSync(directoryPath, { recursive: true, force: true });
}
