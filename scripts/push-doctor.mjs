import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const host = process.env["HOST"] ?? "127.0.0.1";
const port = Number(process.env["PORT"] ?? "4311");
const pushEnabled = (process.env["PUSH_ENABLED"] ?? "false").toLowerCase() === "true";
const vapidPublicKey = (process.env["PUSH_VAPID_PUBLIC_KEY"] ?? "").trim();
const vapidPrivateKey = (process.env["PUSH_VAPID_PRIVATE_KEY"] ?? "").trim();
const vapidSubject = (process.env["PUSH_VAPID_SUBJECT"] ?? "").trim();
const apiToken = (
  process.env["PUSH_DOCTOR_TOKEN"] ??
  process.env["API_TOKEN"] ??
  process.env["PUSH_API_TOKEN"] ??
  ""
).trim();
const baseUrl = (process.env["PUSH_DOCTOR_URL"] ?? `http://${host}:${String(port)}`).trim();
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

let hasFailure = false;

function check(label, pass, detail) {
  const marker = pass ? "PASS" : "FAIL";
  process.stdout.write(`${marker}  ${label}: ${detail}\n`);
  if (!pass) {
    hasFailure = true;
  }
}

check(
  "Push enabled flag",
  pushEnabled,
  pushEnabled ? "PUSH_ENABLED=true" : "PUSH_ENABLED=false (set PUSH_ENABLED=true to enable push delivery)"
);

if (pushEnabled) {
  check(
    "VAPID public key",
    vapidPublicKey.length > 0,
    vapidPublicKey.length > 0 ? "present" : "missing"
  );
  check(
    "VAPID private key",
    vapidPrivateKey.length > 0,
    vapidPrivateKey.length > 0 ? "present" : "missing"
  );
  check(
    "VAPID subject",
    vapidSubject.length > 0,
    vapidSubject.length > 0 ? `present (${vapidSubject})` : "missing"
  );
}

if (!loopbackHosts.has(host)) {
  check(
    "API token",
    true,
    apiToken.length > 0
      ? "present"
      : "missing (recommended for non-loopback HOST; set API_TOKEN to enforce /api auth)"
  );
}

const localCaddyTemplate = path.join(cwd, "ops", "caddy", "Caddyfile.local.template");
const domainCaddyTemplate = path.join(cwd, "ops", "caddy", "Caddyfile.domain.template");
const localCaddy = path.join(cwd, "ops", "caddy", "Caddyfile.local");
const domainCaddy = path.join(cwd, "ops", "caddy", "Caddyfile.domain");
check("Caddy local template", fs.existsSync(localCaddyTemplate), localCaddyTemplate);
check("Caddy domain template", fs.existsSync(domainCaddyTemplate), domainCaddyTemplate);
check(
  "Caddy local runtime config",
  true,
  fs.existsSync(localCaddy)
    ? `present (${localCaddy})`
    : `missing (${localCaddy}); run pnpm setup:ios-push`
);
check(
  "Caddy domain runtime config",
  true,
  fs.existsSync(domainCaddy)
    ? `present (${domainCaddy})`
    : `missing (${domainCaddy}); run pnpm setup:domain-https when using a real domain`
);

async function checkEndpoint(pathname, expectedLabel) {
  const headers = new Headers();
  if (apiToken.length > 0) {
    headers.set("X-Farfield-Token", apiToken);
  }
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, 4000);

  try {
    const response = await fetch(new URL(pathname, baseUrl), {
      method: "GET",
      headers,
      signal: controller.signal
    });
    if (!response.ok) {
      check(expectedLabel, false, `HTTP ${String(response.status)} from ${baseUrl}${pathname}`);
      return null;
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      check(expectedLabel, false, `non-JSON response from ${baseUrl}${pathname}`);
      return null;
    }

    const ok = !!parsed && typeof parsed === "object" && parsed.ok === true;
    check(expectedLabel, ok, ok ? `ok from ${baseUrl}${pathname}` : `unexpected body from ${baseUrl}${pathname}`);
    if (!ok) {
      return null;
    }
    return parsed;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    check(expectedLabel, false, `${detail} (${baseUrl}${pathname})`);
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function readIsoTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const timestampMs = Date.parse(value);
  if (Number.isNaN(timestampMs)) {
    return null;
  }
  return timestampMs;
}

async function main() {
  await checkEndpoint("/api/health", "Runtime /api/health");
  await checkEndpoint("/api/push/status", "Runtime /api/push/status");
  const latestSendResponse = await checkEndpoint("/api/push/sends/latest", "Runtime /api/push/sends/latest");
  const latestReceiptResponse = await checkEndpoint("/api/push/receipts/latest", "Runtime /api/push/receipts/latest");

  const latestSend =
    latestSendResponse && typeof latestSendResponse === "object" && "latest" in latestSendResponse
      ? latestSendResponse.latest
      : null;
  const latestReceipt =
    latestReceiptResponse && typeof latestReceiptResponse === "object" && "latest" in latestReceiptResponse
      ? latestReceiptResponse.latest
      : null;

  if (!latestSend && !latestReceipt) {
    check("Push timeline correlation", true, "No send/receipt records yet");
  } else if (latestSend && !latestReceipt) {
    check("Push timeline correlation", true, "Latest send recorded; waiting for receipt");
  } else if (!latestSend && latestReceipt) {
    check("Push timeline correlation", true, "Latest receipt recorded without send history");
  } else {
    const sendNotificationId =
      latestSend && typeof latestSend === "object" && "notificationId" in latestSend
        ? latestSend.notificationId
        : null;
    const receiptNotificationId =
      latestReceipt && typeof latestReceipt === "object" && "notificationId" in latestReceipt
        ? latestReceipt.notificationId
        : null;
    const sendAt =
      latestSend && typeof latestSend === "object" && "sentAt" in latestSend
        ? latestSend.sentAt
        : null;
    const receiptAt =
      latestReceipt && typeof latestReceipt === "object" && "createdAt" in latestReceipt
        ? latestReceipt.createdAt
        : null;

    if (
      typeof sendNotificationId !== "string" ||
      typeof receiptNotificationId !== "string" ||
      typeof sendAt !== "string" ||
      typeof receiptAt !== "string"
    ) {
      check("Push timeline correlation", false, "Latest send/receipt payload shape is invalid");
    } else if (sendNotificationId !== receiptNotificationId) {
      check(
        "Push timeline correlation",
        true,
        `Latest send (${sendNotificationId}) is waiting for matching receipt; latest receipt is ${receiptNotificationId}`
      );
    } else {
      const sendMs = readIsoTimestamp(sendAt);
      const receiptMs = readIsoTimestamp(receiptAt);
      if (sendMs === null || receiptMs === null) {
        check("Push timeline correlation", false, "Could not parse send/receipt timestamps");
      } else if (receiptMs < sendMs) {
        check(
          "Push timeline correlation",
          false,
          `Receipt timestamp is earlier than send timestamp (${sendAt} -> ${receiptAt})`
        );
      } else {
        const lagMs = receiptMs - sendMs;
        check(
          "Push timeline correlation",
          true,
          `notificationId ${sendNotificationId} lag ${String(lagMs)}ms`
        );
      }
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
    process.stdout.write("\nPush doctor found blocking issues.\n");
  } else {
    process.stdout.write("\nPush doctor checks passed.\n");
  }
}

void main();
