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

function parseMatrixLabels(rawValue) {
  const labels = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return MatrixLabelsSchema.parse(labels);
}

function runSingleSmoke(label) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(process.cwd(), "scripts", "ios-device-smoke.mjs");
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: {
        ...process.env,
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
      const result = await runSingleSmoke(label);
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
