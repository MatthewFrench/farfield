const host = process.env["HOST"] ?? "127.0.0.1";
const port = Number(process.env["PORT"] ?? "4311");
const baseUrl = (process.env["APP_SMOKE_URL"] ?? `http://${host}:${String(port)}`).trim();
const apiToken = (
  process.env["APP_SMOKE_TOKEN"] ??
  process.env["API_TOKEN"] ??
  process.env["PUSH_API_TOKEN"] ??
  ""
).trim();

let hasFailure = false;

function check(label, pass, detail) {
  const marker = pass ? "PASS" : "FAIL";
  process.stdout.write(`${marker}  ${label}: ${detail}\n`);
  if (!pass) {
    hasFailure = true;
  }
}

async function getJson(pathname, label) {
  const headers = new Headers();
  if (apiToken.length > 0) {
    headers.set("X-Farfield-Token", apiToken);
  }
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, 6000);

  try {
    const url = new URL(pathname, baseUrl);
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    if (!response.ok) {
      check(label, false, `HTTP ${String(response.status)} ${url.toString()}`);
      return null;
    }
    const parsed = await response.json();
    if (!parsed || typeof parsed !== "object" || parsed.ok !== true) {
      check(label, false, `Unexpected JSON shape from ${url.toString()}`);
      return null;
    }
    check(label, true, url.toString());
    return parsed;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    check(label, false, `${detail} (${pathname})`);
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function main() {
  const health = await getJson("/api/health", "Runtime /api/health");
  const threads = await getJson(
    "/api/threads?limit=80&archived=0&all=0&maxPages=1",
    "Runtime /api/threads"
  );
  await getJson("/api/models?limit=200", "Runtime /api/models");
  await getJson("/api/collaboration-modes", "Runtime /api/collaboration-modes");
  await getJson("/api/debug/history?limit=20", "Runtime /api/debug/history");
  await getJson("/api/debug/client-errors?limit=20", "Runtime /api/debug/client-errors");

  const threadId =
    threads &&
    typeof threads === "object" &&
    Array.isArray(threads.data) &&
    threads.data.length > 0 &&
    threads.data[0] &&
    typeof threads.data[0] === "object" &&
    typeof threads.data[0].id === "string"
      ? threads.data[0].id
      : null;

  if (threadId) {
    await getJson(
      `/api/threads/${encodeURIComponent(threadId)}/live-state`,
      "Runtime /api/threads/:id/live-state"
    );
    await getJson(
      `/api/threads/${encodeURIComponent(threadId)}/stream-events?limit=20`,
      "Runtime /api/threads/:id/stream-events"
    );
  } else {
    check("Runtime thread detail checks", true, "Skipped (no threads returned)");
  }

  if (health && typeof health === "object" && "state" in health) {
    check("Health state shape", true, "state present");
  } else {
    check("Health state shape", false, "state missing");
  }

  if (hasFailure) {
    process.exitCode = 1;
    process.stdout.write("\nApp smoke check found failures.\n");
    return;
  }
  process.stdout.write("\nApp smoke check passed.\n");
}

void main();
