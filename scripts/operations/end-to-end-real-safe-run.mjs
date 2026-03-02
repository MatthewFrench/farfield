#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { AppServerListThreadsResponseSchema } from "@farfield/protocol";

const ThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(AppServerListThreadsResponseSchema)
  .strict();

const ApiErrorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1)
  })
  .strict();
const THREAD_SNAPSHOT_REQUEST_TIMEOUT_MILLISECONDS = 30_000;
const FETCH_ABORT_ERROR_NAME = "AbortError";

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function saveJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readApiToken() {
  const token = (
    process.env["E2E_REAL_API_TOKEN"]
    ?? process.env["API_TOKEN"]
    ?? process.env["APP_SMOKE_TOKEN"]
    ?? process.env["PUSH_API_TOKEN"]
    ?? ""
  ).trim();
  return token;
}

function readApiBaseUrl() {
  return (process.env["E2E_REAL_API_URL"] ?? "http://127.0.0.1:4311").trim();
}

function readHeaders() {
  const token = readApiToken();
  if (token.length === 0) {
    return {};
  }

  return {
    "X-Farfield-Token": token
  };
}

async function fetchWithTimeout(input, init, timeoutMilliseconds) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMilliseconds);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === FETCH_ABORT_ERROR_NAME) {
      throw new Error(
        `Request timed out after ${String(timeoutMilliseconds)}ms for ${String(input)}`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function readThreadIdSnapshot(label, outputDirectoryPath) {
  const apiBaseUrl = readApiBaseUrl();
  const response = await fetchWithTimeout(
    `${apiBaseUrl}/api/threads?limit=200&archived=false&all=true&maxPages=20`,
    {
      headers: readHeaders()
    },
    THREAD_SNAPSHOT_REQUEST_TIMEOUT_MILLISECONDS
  );

  const payload = await response.json();
  if (!response.ok) {
    const parsedError = ApiErrorEnvelopeSchema.safeParse(payload);
    if (parsedError.success) {
      throw new Error(
        `Thread snapshot failed (${label}): HTTP ${String(response.status)} ${parsedError.data.error}`
      );
    }
    throw new Error(`Thread snapshot failed (${label}): HTTP ${String(response.status)}`);
  }

  const parsed = ThreadListEnvelopeSchema.parse(payload);
  const threadIds = parsed.data.map((thread) => thread.id).sort();
  const snapshot = {
    label,
    apiBaseUrl,
    recordedAt: new Date().toISOString(),
    count: threadIds.length,
    threadIds
  };
  saveJsonFile(path.join(outputDirectoryPath, `thread-snapshot-${label}.json`), snapshot);

  return threadIds;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });
  if (typeof result.status === "number") {
    return result.status;
  }
  if (result.error) {
    process.stderr.write(`${String(result.error)}\n`);
  }
  return 1;
}

function computeThreadDiff(beforeThreadIds, afterThreadIds) {
  const beforeThreadSet = new Set(beforeThreadIds);
  const afterThreadSet = new Set(afterThreadIds);

  const removedThreadIds = beforeThreadIds.filter((threadId) => !afterThreadSet.has(threadId));
  const addedThreadIds = afterThreadIds.filter((threadId) => !beforeThreadSet.has(threadId));

  return {
    beforeCount: beforeThreadIds.length,
    afterCount: afterThreadIds.length,
    removedCount: removedThreadIds.length,
    addedCount: addedThreadIds.length,
    removedThreadIds,
    addedThreadIds
  };
}

async function main() {
  const outputDirectoryPath = path.resolve(process.cwd(), ".runtime", "end-to-end-sentinel");
  ensureDirectory(outputDirectoryPath);
  const playwrightArguments = process.argv.slice(2);

  let beforeThreadIds;
  try {
    beforeThreadIds = await readThreadIdSnapshot("pre", outputDirectoryPath);
  } catch (error) {
    process.stderr.write(
      `Unable to read pre-run thread snapshot: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }

  const protocolBuildStatus = runCommand("bun", ["run", "--filter", "@farfield/protocol", "build"]);
  if (protocolBuildStatus !== 0) {
    process.exit(protocolBuildStatus);
  }

  const realPlaywrightStatus = runCommand("bunx", [
    "playwright",
    "test",
    "-c",
    "playwright.real.config.ts",
    ...playwrightArguments
  ]);

  let afterThreadIds;
  try {
    afterThreadIds = await readThreadIdSnapshot("post", outputDirectoryPath);
  } catch (error) {
    process.stderr.write(
      `Unable to read post-run thread snapshot: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  }

  const diff = computeThreadDiff(beforeThreadIds, afterThreadIds);
  saveJsonFile(path.join(outputDirectoryPath, "thread-snapshot-diff.json"), {
    recordedAt: new Date().toISOString(),
    ...diff
  });

  if (diff.removedCount > 0) {
    process.stderr.write(
      `Safety check failed: ${String(diff.removedCount)} pre-existing thread(s) disappeared during real end-to-end run.\n`
    );
    for (const threadId of diff.removedThreadIds) {
      process.stderr.write(`- ${threadId}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Safety check passed: before=${String(diff.beforeCount)} after=${String(diff.afterCount)} removed=0 added=${String(diff.addedCount)}\n`
  );

  process.exit(realPlaywrightStatus);
}

await main();
