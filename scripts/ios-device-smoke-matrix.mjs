import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { z } from "zod";

const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

const MatrixLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9._ -]+$/, "Matrix labels can only contain letters, numbers, spaces, dot, underscore, and dash");

const MatrixLabelsSchema = z
  .array(MatrixLabelSchema)
  .min(2, "Define at least two iOS targets for matrix smoke runs");

const InheritedSmokeEnvironmentSchema = z
  .object({
    PATH: z.string().optional(),
    HOME: z.string().optional(),
    TMPDIR: z.string().optional(),
    TMP: z.string().optional(),
    TEMP: z.string().optional(),
    USER: z.string().optional(),
    LOGNAME: z.string().optional(),
    SHELL: z.string().optional(),
    TERM: z.string().optional(),
    NO_COLOR: z.string().optional(),
    FORCE_COLOR: z.string().optional(),
    HOST: z.string().optional(),
    PORT: z.string().optional(),
    IOS_DEVICE_SMOKE_API_URL: z.string().optional(),
    IOS_DEVICE_SMOKE_TOKEN: z.string().optional(),
    API_TOKEN: z.string().optional(),
    PUSH_API_TOKEN: z.string().optional(),
    IOS_DEVICE_SMOKE_PUSH_SHOWN_TIMEOUT_MS: z.string().optional(),
    IOS_DEVICE_SMOKE_PUSH_CLICKED_TIMEOUT_MS: z.string().optional(),
    IOS_DEVICE_SMOKE_POLL_INTERVAL_MS: z.string().optional()
  })
  .strict();

function parseMatrixLabels(rawValue) {
  const labels = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return MatrixLabelsSchema.parse(labels);
}

function buildInheritedSmokeEnvironment(sourceEnvironment) {
  return InheritedSmokeEnvironmentSchema.parse({
    PATH: sourceEnvironment["PATH"],
    HOME: sourceEnvironment["HOME"],
    TMPDIR: sourceEnvironment["TMPDIR"],
    TMP: sourceEnvironment["TMP"],
    TEMP: sourceEnvironment["TEMP"],
    USER: sourceEnvironment["USER"],
    LOGNAME: sourceEnvironment["LOGNAME"],
    SHELL: sourceEnvironment["SHELL"],
    TERM: sourceEnvironment["TERM"],
    NO_COLOR: sourceEnvironment["NO_COLOR"],
    FORCE_COLOR: sourceEnvironment["FORCE_COLOR"],
    HOST: sourceEnvironment["HOST"],
    PORT: sourceEnvironment["PORT"],
    IOS_DEVICE_SMOKE_API_URL: sourceEnvironment["IOS_DEVICE_SMOKE_API_URL"],
    IOS_DEVICE_SMOKE_TOKEN: sourceEnvironment["IOS_DEVICE_SMOKE_TOKEN"],
    API_TOKEN: sourceEnvironment["API_TOKEN"],
    PUSH_API_TOKEN: sourceEnvironment["PUSH_API_TOKEN"],
    IOS_DEVICE_SMOKE_PUSH_SHOWN_TIMEOUT_MS: sourceEnvironment["IOS_DEVICE_SMOKE_PUSH_SHOWN_TIMEOUT_MS"],
    IOS_DEVICE_SMOKE_PUSH_CLICKED_TIMEOUT_MS: sourceEnvironment["IOS_DEVICE_SMOKE_PUSH_CLICKED_TIMEOUT_MS"],
    IOS_DEVICE_SMOKE_POLL_INTERVAL_MS: sourceEnvironment["IOS_DEVICE_SMOKE_POLL_INTERVAL_MS"]
  });
}

function runSingleSmoke(label, inheritedEnvironment) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(process.cwd(), "scripts", "ios-device-smoke.mjs");
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: {
        ...inheritedEnvironment,
        IOS_DEVICE_SMOKE_LABEL: label
      }
    });

    child.once("exit", (code, signal) => {
      const exitCode = typeof code === "number" ? code : 1;
      if (signal) {
        resolve({ ok: false, label, detail: `terminated by ${signal}` });
        return;
      }
      if (exitCode === 0) {
        resolve({ ok: true, label, detail: "passed" });
        return;
      }
      resolve({ ok: false, label, detail: `exit code ${String(exitCode)}` });
    });
  });
}

async function main() {
  if (!interactive) {
    throw new Error("ios-device-smoke-matrix requires an interactive terminal");
  }

  const rawMatrix = (process.env["IOS_DEVICE_SMOKE_MATRIX"] ?? "iOS-17,iOS-18").trim();
  const matrixLabels = parseMatrixLabels(rawMatrix);
  const inheritedEnvironment = buildInheritedSmokeEnvironment(process.env);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const results = [];
  try {
    process.stdout.write("iOS real-device smoke matrix\n");
    process.stdout.write(`Targets: ${matrixLabels.join(", ")}\n`);
    process.stdout.write(
      "For each target, run the full interactive smoke flow on the matching real iOS device/version.\n"
    );

    for (const label of matrixLabels) {
      await rl.question(`\nPrepare target "${label}" and press Enter to start: `);
      const result = await runSingleSmoke(label, inheritedEnvironment);
      results.push(result);
      process.stdout.write(
        `${result.ok ? "PASS" : "FAIL"}  [${label}] ${result.detail}\n`
      );
    }
  } finally {
    rl.close();
  }

  const failed = results.filter((result) => result.ok === false);
  process.stdout.write(
    `\nMatrix summary: ${String(results.length - failed.length)} passed, ${String(failed.length)} failed.\n`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
