import { createInterface } from "node:readline/promises";
import { z } from "zod";

const host = process.env["HOST"] ?? "127.0.0.1";
const port = Number(process.env["PORT"] ?? "4311");
const smokeLabelRaw = (process.env["IOS_DEVICE_SMOKE_LABEL"] ?? "").trim();
const smokeLabel = smokeLabelRaw.length > 0 ? smokeLabelRaw : "default";
const apiBaseUrl = (process.env["IOS_DEVICE_SMOKE_API_URL"] ?? `http://${host}:${String(port)}`).trim();
const apiToken = (
  process.env["IOS_DEVICE_SMOKE_TOKEN"] ??
  process.env["API_TOKEN"] ??
  process.env["PUSH_API_TOKEN"] ??
  ""
).trim();
const pushShownTimeoutMsRaw = Number(process.env["IOS_DEVICE_SMOKE_PUSH_SHOWN_TIMEOUT_MS"] ?? "90000");
const pushClickedTimeoutMsRaw = Number(process.env["IOS_DEVICE_SMOKE_PUSH_CLICKED_TIMEOUT_MS"] ?? "90000");
const pollIntervalMsRaw = Number(process.env["IOS_DEVICE_SMOKE_POLL_INTERVAL_MS"] ?? "1000");
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

const pushShownTimeoutMs =
  Number.isFinite(pushShownTimeoutMsRaw) && pushShownTimeoutMsRaw > 0 ? pushShownTimeoutMsRaw : 90000;
const pushClickedTimeoutMs =
  Number.isFinite(pushClickedTimeoutMsRaw) && pushClickedTimeoutMsRaw > 0 ? pushClickedTimeoutMsRaw : 90000;
const pollIntervalMs =
  Number.isFinite(pollIntervalMsRaw) && pollIntervalMsRaw > 0 ? pollIntervalMsRaw : 1000;

const ApiErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1)
  })
  .strict();

const HealthSchema = z
  .object({
    ok: z.literal(true),
    state: z
      .object({
        appReady: z.boolean(),
        ipcConnected: z.boolean(),
        ipcInitialized: z.boolean(),
        pushSubscriptionCount: z.number().int().nonnegative()
      })
      .passthrough()
  })
  .strict();

const CreateThreadSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
    agentId: z.enum(["codex", "opencode"])
  })
  .passthrough();

const ArchiveThreadSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1)
  })
  .strict();

const PushTestSchema = z
  .object({
    ok: z.literal(true),
    dryRun: z.boolean(),
    notificationId: z.string().nullable(),
    ready: z.boolean(),
    reason: z.string(),
    attempted: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative()
  })
  .strict();

const PushSendLatestSchema = z
  .object({
    ok: z.literal(true),
    latest: z
      .object({
        notificationId: z.string().min(1),
        threadId: z.string().min(1),
        turnId: z.string().min(1),
        sentAt: z.string().datetime(),
        attempted: z.number().int().nonnegative(),
        delivered: z.number().int().nonnegative(),
        failures: z.number().int().nonnegative()
      })
      .nullable()
  })
  .strict();

const PushReceiptLatestSchema = z
  .object({
    ok: z.literal(true),
    latest: z
      .object({
        notificationId: z.string().min(1),
        event: z.enum(["shown", "clicked", "error"]),
        url: z.string().min(1),
        threadId: z.string().nullable(),
        turnId: z.string().nullable(),
        message: z.string().nullable(),
        createdAt: z.string().datetime()
      })
      .nullable(),
    count: z.number().int().nonnegative()
  })
  .strict();

let hasFailure = false;

function report(level, label, detail) {
  process.stdout.write(`${level}  [${smokeLabel}] ${label}: ${detail}\n`);
}

function pass(label, detail) {
  report("PASS", label, detail);
}

function fail(label, detail) {
  hasFailure = true;
  report("FAIL", label, detail);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildHeaders(useAuth, includeJsonContentType) {
  const headers = new Headers();
  if (includeJsonContentType) {
    headers.set("Content-Type", "application/json");
  }
  if (useAuth && apiToken.length > 0) {
    headers.set("X-Farfield-Token", apiToken);
  }
  return headers;
}

async function requestJson(pathname, options) {
  const method = options?.method ?? "GET";
  const useAuth = options?.useAuth ?? true;
  const body = options?.body ? JSON.stringify(options.body) : null;
  const includeJsonContentType = body !== null;

  const response = await fetch(new URL(pathname, apiBaseUrl), {
    method,
    headers: buildHeaders(useAuth, includeJsonContentType),
    ...(body !== null ? { body } : {})
  });

  const raw = await response.text();
  let parsedBody = null;
  if (raw.trim().length > 0) {
    parsedBody = JSON.parse(raw);
  }

  return {
    status: response.status,
    body: parsedBody
  };
}

async function promptStep(rl, title, lines) {
  process.stdout.write(`\n${title}\n`);
  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
  await rl.question("Press Enter when complete: ");
}

async function waitForLatestSend(notificationId) {
  const deadline = Date.now() + pushShownTimeoutMs;
  while (Date.now() < deadline) {
    const response = await requestJson("/api/push/sends/latest", {
      method: "GET",
      useAuth: true
    });
    if (response.status === 200) {
      const parsed = PushSendLatestSchema.parse(response.body);
      if (parsed.latest?.notificationId === notificationId) {
        return parsed.latest;
      }
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`Timed out waiting for /api/push/sends/latest to report ${notificationId}`);
}

async function waitForReceiptEvent(notificationId, acceptedEvents, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await requestJson("/api/push/receipts/latest", {
      method: "GET",
      useAuth: true
    });
    if (response.status === 200) {
      const parsed = PushReceiptLatestSchema.parse(response.body);
      if (parsed.latest?.notificationId === notificationId && acceptedEvents.includes(parsed.latest.event)) {
        return parsed.latest;
      }
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(
    `Timed out waiting for /api/push/receipts/latest to report ${notificationId} with one of: ${acceptedEvents.join(", ")}`
  );
}

async function createIsolatedThread() {
  const response = await requestJson("/api/threads", {
    method: "POST",
    useAuth: true,
    body: {
      agentId: "codex",
      ephemeral: true
    }
  });

  if (response.status !== 200) {
    throw new Error(`Expected /api/threads to return 200, got ${String(response.status)}`);
  }

  return CreateThreadSchema.parse(response.body);
}

async function archiveThread(threadId) {
  const response = await requestJson(`/api/threads/${encodeURIComponent(threadId)}/archive`, {
    method: "POST",
    useAuth: true
  });
  if (response.status !== 200) {
    throw new Error(
      `Expected /api/threads/${threadId}/archive to return 200, got ${String(response.status)}`
    );
  }

  const parsed = ArchiveThreadSchema.parse(response.body);
  if (parsed.threadId !== threadId) {
    throw new Error(`Archive thread mismatch. expected=${threadId} actual=${parsed.threadId}`);
  }
}

async function main() {
  if (!interactive) {
    throw new Error("ios-device-smoke requires an interactive terminal");
  }

  if (apiToken.length === 0) {
    throw new Error(
      "Missing API token. Set IOS_DEVICE_SMOKE_TOKEN, API_TOKEN, or PUSH_API_TOKEN before running ios-device-smoke."
    );
  }

  let isolatedThreadId = null;
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    pass("iOS smoke config", `apiBaseUrl=${apiBaseUrl}`);

    const unauthorizedHealthResponse = await requestJson("/api/health", {
      method: "GET",
      useAuth: false
    });
    if (unauthorizedHealthResponse.status !== 401) {
      fail(
        "Auth enforcement",
        `Expected unauthenticated /api/health to return 401, got ${String(unauthorizedHealthResponse.status)}`
      );
    } else {
      ApiErrorSchema.parse(unauthorizedHealthResponse.body);
      pass("Auth enforcement", "Unauthenticated /api/health rejected with 401");
    }

    const authenticatedHealthResponse = await requestJson("/api/health", {
      method: "GET",
      useAuth: true
    });
    if (authenticatedHealthResponse.status !== 200) {
      fail(
        "Authenticated health",
        `Expected authenticated /api/health to return 200, got ${String(authenticatedHealthResponse.status)}`
      );
      process.exitCode = 1;
      return;
    }
    const health = HealthSchema.parse(authenticatedHealthResponse.body);
    pass(
      "Authenticated health",
      `appReady=${String(health.state.appReady)} ipcConnected=${String(health.state.ipcConnected)} ipcInitialized=${String(health.state.ipcInitialized)}`
    );

    const createdThread = await createIsolatedThread();
    isolatedThreadId = createdThread.threadId;
    const threadId = createdThread.threadId;
    pass(
      "Isolated smoke thread",
      `threadId=${threadId} agentId=${createdThread.agentId} ephemeral=true`
    );

    await promptStep(rl, "Step 1: Cold start + thread load", [
      "- On iPhone, force-close the Farfield Home Screen app.",
      "- Re-open the app from Home Screen.",
      `- Open thread ${threadId} in the app.`,
      "- Keep the app open on that thread, then continue here."
    ]);

    const liveStateResponse = await requestJson(
      `/api/threads/${encodeURIComponent(threadId)}/live-state`,
      {
        method: "GET",
        useAuth: true
      }
    );
    if (liveStateResponse.status !== 200) {
      fail("Thread live-state", `Expected live-state 200, got ${String(liveStateResponse.status)}`);
      process.exitCode = 1;
      return;
    }
    pass("Thread live-state", `Thread ${threadId} live-state endpoint reachable`);

    const dryRunResponse = await requestJson("/api/push/test", {
      method: "POST",
      useAuth: true,
      body: {
        threadId,
        turnId: `turn_ios_smoke_dryrun_${Date.now()}`,
        dryRun: true
      }
    });
    if (dryRunResponse.status !== 200) {
      fail("Push dry-run", `Expected push dry-run 200, got ${String(dryRunResponse.status)}`);
      process.exitCode = 1;
      return;
    }
    const dryRun = PushTestSchema.parse(dryRunResponse.body);
    if (!dryRun.ready || dryRun.attempted === 0) {
      fail("Push dry-run", `${dryRun.reason} (attempted=${String(dryRun.attempted)})`);
      process.exitCode = 1;
      return;
    }
    pass("Push dry-run", `${dryRun.reason} (attempted=${String(dryRun.attempted)})`);

    const turnId = `turn_ios_smoke_${Date.now()}`;
    const pushSendResponse = await requestJson("/api/push/test", {
      method: "POST",
      useAuth: true,
      body: {
        threadId,
        turnId,
        body: "iOS device smoke test notification"
      }
    });
    if (pushSendResponse.status !== 200) {
      fail("Push send", `Expected push send 200, got ${String(pushSendResponse.status)}`);
      process.exitCode = 1;
      return;
    }

    const pushSend = PushTestSchema.parse(pushSendResponse.body);
    if (!pushSend.notificationId) {
      fail("Push send", "Push test did not return notificationId");
      process.exitCode = 1;
      return;
    }
    pass("Push send", `notificationId=${pushSend.notificationId}`);

    const latestSend = await waitForLatestSend(pushSend.notificationId);
    pass(
      "Push send telemetry",
      `attempted=${String(latestSend.attempted)} delivered=${String(latestSend.delivered)} failures=${String(latestSend.failures)}`
    );

    await promptStep(rl, "Step 2: Background for shown receipt", [
      "- Move Farfield to background on iPhone.",
      "- Wait for the notification to appear.",
      "- Do not tap it yet.",
      "- Continue once it is visible."
    ]);

    const shownReceipt = await waitForReceiptEvent(
      pushSend.notificationId,
      ["shown", "clicked"],
      pushShownTimeoutMs
    );
    pass(
      "Push shown receipt",
      `event=${shownReceipt.event} at ${shownReceipt.createdAt} notificationId=${shownReceipt.notificationId}`
    );

    await promptStep(rl, "Step 3: Tap notification for clicked receipt", [
      "- Tap the smoke-test notification on iPhone.",
      "- Confirm Farfield opens to the target thread.",
      "- Continue after tap navigation is complete."
    ]);

    const clickedReceipt = await waitForReceiptEvent(
      pushSend.notificationId,
      ["clicked"],
      pushClickedTimeoutMs
    );
    pass(
      "Push clicked receipt",
      `event=${clickedReceipt.event} at ${clickedReceipt.createdAt} notificationId=${clickedReceipt.notificationId}`
    );

    await archiveThread(threadId);
    isolatedThreadId = null;
    pass("Isolated smoke thread cleanup", `Archived ${threadId}`);
  } finally {
    rl.close();

    if (isolatedThreadId) {
      try {
        await archiveThread(isolatedThreadId);
        pass("Isolated smoke thread cleanup", `Archived ${isolatedThreadId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail("Isolated smoke thread cleanup", message);
      }
    }
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail("iOS device smoke", message);
}

if (hasFailure) {
  process.exitCode = 1;
  process.stdout.write("\niOS device smoke found blocking issues.\n");
} else {
  process.stdout.write("\niOS device smoke completed successfully.\n");
}
