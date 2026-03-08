import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StableDevelopmentStatusArtifactOwner } from "../development/StableDevelopmentStatusArtifactOwner.mjs";

const temporaryDirectoryPaths = [];

function createTemporaryDirectoryPath() {
  const temporaryDirectoryPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "farfield-stable-status-owner-"),
  );
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

afterEach(() => {
  for (const temporaryDirectoryPath of temporaryDirectoryPaths.splice(
    0,
    temporaryDirectoryPaths.length,
  )) {
    fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true });
  }
});

describe("StableDevelopmentStatusArtifactOwner", () => {
  it("writes latest status and crash artifacts with stderr tails", () => {
    const runtimeRootPath = createTemporaryDirectoryPath();
    const owner = new StableDevelopmentStatusArtifactOwner({
      runtimeRootPath,
    });

    owner.writeStatus({
      buildVersion: "build-1",
      status: "ready",
      runtimeState: "ready",
      message: "Serving validated build build-1.",
      crashSummary: null,
    });
    owner.recordServerOutputLine({
      stream: "stdout",
      line: "server started",
    });
    owner.recordServerOutputLine({
      stream: "stderr",
      line: "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
    });

    const crashSummary = owner.recordApiChildCrash({
      buildVersion: "build-1",
      pid: 12345,
      exitCode: null,
      signal: "SIGABRT",
    });
    owner.writeStatus({
      buildVersion: "build-1",
      status: "api_crashed",
      runtimeState: "api_crashed",
      message: "Stable API child crashed.",
      crashSummary,
    });

    const artifactPaths = owner.getArtifactPaths();
    const statusRecord = JSON.parse(fs.readFileSync(artifactPaths.latestStatusPath, "utf8"));
    const crashRecord = JSON.parse(fs.readFileSync(artifactPaths.latestCrashJsonPath, "utf8"));
    const crashNdjsonRecord = JSON.parse(
      fs.readFileSync(artifactPaths.latestCrashNdjsonPath, "utf8"),
    );

    expect(statusRecord.runtimeState).toBe("api_crashed");
    expect(statusRecord.crashSummary.crashCategory).toBe("heap_out_of_memory");
    expect(statusRecord.crashSummary.stderrTailLines).toEqual([
      "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
    ]);
    expect(crashRecord.outputTail).toHaveLength(2);
    expect(crashRecord.signal).toBe("SIGABRT");
    expect(crashNdjsonRecord.crashCategory).toBe("heap_out_of_memory");
  });
});
