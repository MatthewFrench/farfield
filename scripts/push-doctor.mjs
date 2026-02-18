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

check("Push enabled flag", true, `PUSH_ENABLED=${String(pushEnabled)}`);

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
      return;
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      check(expectedLabel, false, `non-JSON response from ${baseUrl}${pathname}`);
      return;
    }

    const ok = !!parsed && typeof parsed === "object" && parsed.ok === true;
    check(expectedLabel, ok, ok ? `ok from ${baseUrl}${pathname}` : `unexpected body from ${baseUrl}${pathname}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    check(expectedLabel, false, `${detail} (${baseUrl}${pathname})`);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function main() {
  await checkEndpoint("/api/health", "Runtime /api/health");
  await checkEndpoint("/api/push/status", "Runtime /api/push/status");

  if (hasFailure) {
    process.exitCode = 1;
    process.stdout.write("\nPush doctor found blocking issues.\n");
  } else {
    process.stdout.write("\nPush doctor checks passed.\n");
  }
}

void main();
