import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const StableDevelopmentOutputLineSchema = z
  .object({
    stream: z.enum(["stdout", "stderr"]),
    line: z.string(),
    recordedAt: z.string().datetime(),
  })
  .strict();

const StableDevelopmentCrashSummarySchema = z
  .object({
    buildVersion: z.string().min(1).nullable(),
    pid: z.number().int().positive().nullable(),
    exitCode: z.number().int().nullable(),
    signal: z.string().min(1).nullable(),
    crashCategory: z.string().min(1),
    occurredAt: z.string().datetime(),
    latestStatusPath: z.string().min(1),
    latestCrashJsonPath: z.string().min(1),
    latestCrashNdjsonPath: z.string().min(1),
    stderrTailLines: z.array(z.string()),
  })
  .strict();

const StableDevelopmentStatusRecordSchema = z
  .object({
    buildVersion: z.string().min(1).nullable(),
    status: z.string().min(1),
    runtimeState: z.string().min(1),
    message: z.string().min(1),
    updatedAt: z.string().datetime(),
    latestStatusPath: z.string().min(1),
    latestCrashJsonPath: z.string().min(1),
    latestCrashNdjsonPath: z.string().min(1),
    crashSummary: StableDevelopmentCrashSummarySchema.nullable(),
  })
  .strict();

const StableDevelopmentCrashRecordSchema = z
  .object({
    buildVersion: z.string().min(1).nullable(),
    pid: z.number().int().positive().nullable(),
    exitCode: z.number().int().nullable(),
    signal: z.string().min(1).nullable(),
    crashCategory: z.string().min(1),
    occurredAt: z.string().datetime(),
    latestStatusPath: z.string().min(1),
    latestCrashJsonPath: z.string().min(1),
    latestCrashNdjsonPath: z.string().min(1),
    outputTail: z.array(StableDevelopmentOutputLineSchema),
  })
  .strict();

const LatestStatusFileName = "latest-status.json";
const LatestCrashJsonFileName = "latest-crash.json";
const LatestCrashNdjsonFileName = "latest-crash.ndjson";
const MaximumRetainedOutputLines = 120;
const MaximumRetainedCrashStderrLines = 24;
const HeapOutOfMemoryPattern = /heap out of memory|reached heap limit/i;

function classifyCrashCategory(outputTail) {
  for (let index = outputTail.length - 1; index >= 0; index -= 1) {
    const outputLine = outputTail[index];
    if (HeapOutOfMemoryPattern.test(outputLine.line)) {
      return "heap_out_of_memory";
    }
  }

  return "unexpected_exit";
}

function readCrashStderrTailLines(outputTail) {
  return outputTail
    .filter((outputLine) => outputLine.stream === "stderr")
    .slice(-MaximumRetainedCrashStderrLines)
    .map((outputLine) => outputLine.line);
}

/**
 * Owns stable-development status and crash artifact files outside the server child process.
 * This keeps the latest crash evidence readable even when the API process aborts.
 */
export class StableDevelopmentStatusArtifactOwner {
  outputTail = [];

  constructor({ runtimeRootPath }) {
    this.runtimeRootPath = runtimeRootPath;
    this.latestStatusPath = path.join(runtimeRootPath, LatestStatusFileName);
    this.latestCrashJsonPath = path.join(runtimeRootPath, LatestCrashJsonFileName);
    this.latestCrashNdjsonPath = path.join(runtimeRootPath, LatestCrashNdjsonFileName);

    fs.mkdirSync(runtimeRootPath, { recursive: true });
  }

  getArtifactPaths() {
    return {
      latestStatusPath: this.latestStatusPath,
      latestCrashJsonPath: this.latestCrashJsonPath,
      latestCrashNdjsonPath: this.latestCrashNdjsonPath,
    };
  }

  resetOutputTail() {
    this.outputTail = [];
  }

  recordServerOutputLine({ stream, line }) {
    const nextOutputLine = StableDevelopmentOutputLineSchema.parse({
      stream,
      line,
      recordedAt: new Date().toISOString(),
    });
    this.outputTail.push(nextOutputLine);
    if (this.outputTail.length > MaximumRetainedOutputLines) {
      this.outputTail.splice(0, this.outputTail.length - MaximumRetainedOutputLines);
    }
  }

  writeStatus({ buildVersion, status, runtimeState, message, crashSummary }) {
    const statusRecord = StableDevelopmentStatusRecordSchema.parse({
      buildVersion,
      status,
      runtimeState,
      message,
      updatedAt: new Date().toISOString(),
      latestStatusPath: this.latestStatusPath,
      latestCrashJsonPath: this.latestCrashJsonPath,
      latestCrashNdjsonPath: this.latestCrashNdjsonPath,
      crashSummary,
    });

    fs.writeFileSync(this.latestStatusPath, `${JSON.stringify(statusRecord, null, 2)}\n`, "utf8");
  }

  recordApiChildCrash({ buildVersion, pid, exitCode, signal }) {
    const outputTail = [...this.outputTail];
    const crashRecord = StableDevelopmentCrashRecordSchema.parse({
      buildVersion,
      pid,
      exitCode,
      signal,
      crashCategory: classifyCrashCategory(outputTail),
      occurredAt: new Date().toISOString(),
      latestStatusPath: this.latestStatusPath,
      latestCrashJsonPath: this.latestCrashJsonPath,
      latestCrashNdjsonPath: this.latestCrashNdjsonPath,
      outputTail,
    });
    const crashSummary = StableDevelopmentCrashSummarySchema.parse({
      buildVersion: crashRecord.buildVersion,
      pid: crashRecord.pid,
      exitCode: crashRecord.exitCode,
      signal: crashRecord.signal,
      crashCategory: crashRecord.crashCategory,
      occurredAt: crashRecord.occurredAt,
      latestStatusPath: crashRecord.latestStatusPath,
      latestCrashJsonPath: crashRecord.latestCrashJsonPath,
      latestCrashNdjsonPath: crashRecord.latestCrashNdjsonPath,
      stderrTailLines: readCrashStderrTailLines(crashRecord.outputTail),
    });

    fs.writeFileSync(this.latestCrashJsonPath, `${JSON.stringify(crashRecord, null, 2)}\n`, "utf8");
    fs.writeFileSync(this.latestCrashNdjsonPath, `${JSON.stringify(crashRecord)}\n`, "utf8");

    return crashSummary;
  }
}
