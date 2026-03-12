import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import {
  parseStableDevelopmentTrustedOrigins,
  shouldInjectApiTokenForStableDevelopmentProxy,
} from "./StableDevelopmentProxyTrustPolicy.mjs";

const FileContentTypeByExtension = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);
const FileSystemErrorSchema = z
  .object({
    code: z.string().optional(),
  })
  .passthrough();

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildLiveReloadScript({ buildVersion, liveReloadPort }) {
  const serializedBuildVersion = buildVersion === null ? "null" : JSON.stringify(buildVersion);
  return [
    "<script>",
    `window.__farfieldStableBuildVersion = ${serializedBuildVersion};`,
    "(function(){",
    "  const buildVersionPathname = '/stable-dev/version';",
    `  const liveReloadPort = '${String(liveReloadPort)}';`,
    "  function buildLiveReloadUrl(){",
    "    const url = new URL(window.location.href);",
    "    url.port = liveReloadPort;",
    "    url.pathname = buildVersionPathname;",
    "    url.search = '';",
    "    url.hash = '';",
    "    return url.toString();",
    "  }",
    "  async function poll(){",
    "    try {",
    "      const response = await fetch(buildLiveReloadUrl(), { cache: 'no-store' });",
    "      if (!response.ok) {",
    "        return;",
    "      }",
    "      const payload = await response.json();",
    "      const nextBuildVersion = typeof payload.buildVersion === 'string' ? payload.buildVersion : null;",
    "      const currentBuildVersion = typeof window.__farfieldStableBuildVersion === 'string' ? window.__farfieldStableBuildVersion : null;",
    "      if (nextBuildVersion !== null && nextBuildVersion !== currentBuildVersion) {",
    "        window.location.reload();",
    "      }",
    "      if (currentBuildVersion === null && nextBuildVersion !== null) {",
    "        window.location.reload();",
    "      }",
    "    } catch {",
    "      return;",
    "    }",
    "  }",
    "  window.setInterval(function(){ void poll(); }, 2000);",
    "})();",
    "</script>",
  ].join("");
}

function injectLiveReloadScript(html, script) {
  const bodyCloseTag = "</body>";
  if (html.includes(bodyCloseTag)) {
    return html.replace(bodyCloseTag, `${script}${bodyCloseTag}`);
  }
  return `${html}${script}`;
}

function buildPendingPage({ message, status, liveReloadPort }) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <title>Farfield Stable Dev</title>",
    "  <style>",
    "    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
    "    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #1d293d, #0b1020 60%); color: #e6edf7; }",
    "    main { width: min(720px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,0.12); background: rgba(11,16,32,0.88); border-radius: 18px; padding: 28px; box-shadow: 0 24px 90px rgba(0,0,0,0.32); }",
    "    h1 { margin: 0 0 12px; font-size: 20px; }",
    "    p { margin: 0; line-height: 1.6; color: rgba(230,237,247,0.84); }",
    "    .status { display: inline-block; margin-top: 16px; padding: 6px 10px; border-radius: 999px; background: rgba(105, 179, 255, 0.14); color: #9cc8ff; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <h1>Farfield stable development mode</h1>",
    `    <p>${escapeHtml(message)}</p>`,
    `    <div class="status">${escapeHtml(status)}</div>`,
    "  </main>",
    injectLiveReloadScript("", buildLiveReloadScript({ buildVersion: null, liveReloadPort })),
    "</body>",
    "</html>",
  ].join("");
}

function buildApiCrashPage({ crashSummary, liveReloadPort, message }) {
  const stderrTailMarkup =
    crashSummary !== null && crashSummary.stderrTailLines.length > 0
      ? [
          '<div class="details">',
          "  <h2>Last stderr lines</h2>",
          `  <pre>${escapeHtml(crashSummary.stderrTailLines.join("\n"))}</pre>`,
          "</div>",
        ].join("")
      : "";

  const crashDetailsMarkup =
    crashSummary === null
      ? ""
      : [
          '<div class="details">',
          "  <h2>Crash summary</h2>",
          "  <dl>",
          `    <dt>Occurred</dt><dd>${escapeHtml(crashSummary.occurredAt)}</dd>`,
          `    <dt>Build</dt><dd>${escapeHtml(crashSummary.buildVersion ?? "unknown")}</dd>`,
          `    <dt>Signal</dt><dd>${escapeHtml(crashSummary.signal ?? "none")}</dd>`,
          `    <dt>Exit code</dt><dd>${escapeHtml(crashSummary.exitCode === null ? "none" : String(crashSummary.exitCode))}</dd>`,
          `    <dt>Category</dt><dd>${escapeHtml(crashSummary.crashCategory)}</dd>`,
          `    <dt>Status file</dt><dd>${escapeHtml(crashSummary.latestStatusPath)}</dd>`,
          `    <dt>Crash JSON</dt><dd>${escapeHtml(crashSummary.latestCrashJsonPath)}</dd>`,
          `    <dt>Crash NDJSON</dt><dd>${escapeHtml(crashSummary.latestCrashNdjsonPath)}</dd>`,
          "  </dl>",
          "</div>",
        ].join("");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <title>Farfield Stable Dev Crash</title>",
    "  <style>",
    "    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
    "    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #3d1717, #12090a 60%); color: #f9e8e8; }",
    "    main { width: min(860px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,0.12); background: rgba(24,8,10,0.92); border-radius: 18px; padding: 28px; box-shadow: 0 24px 90px rgba(0,0,0,0.4); }",
    "    h1 { margin: 0 0 12px; font-size: 24px; color: #ffb4b4; }",
    "    p { margin: 0; line-height: 1.6; color: rgba(249,232,232,0.88); }",
    "    .status { display: inline-block; margin-top: 16px; padding: 6px 10px; border-radius: 999px; background: rgba(255,120,120,0.18); color: #ffb4b4; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }",
    "    .details { margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; }",
    "    .details h2 { margin: 0 0 12px; font-size: 14px; color: #ffd6d6; }",
    "    dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; }",
    "    dt { color: rgba(255,214,214,0.72); }",
    "    dd { margin: 0; word-break: break-word; }",
    "    pre { margin: 0; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.05); overflow: auto; white-space: pre-wrap; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <h1>Stable API crashed</h1>",
    `    <p>${escapeHtml(message)}</p>`,
    '    <div class="status">API CRASHED</div>',
    crashDetailsMarkup,
    stderrTailMarkup,
    "  </main>",
    injectLiveReloadScript("", buildLiveReloadScript({ buildVersion: null, liveReloadPort })),
    "</body>",
    "</html>",
  ].join("");
}

function getContentType(filePath) {
  return (
    FileContentTypeByExtension.get(path.extname(filePath).toLowerCase()) ??
    "application/octet-stream"
  );
}

function resolveRequestedFilePath(buildDirectoryPath, pathnameValue) {
  const pathnameWithoutLeadingSlash = pathnameValue.replace(/^\/+/, "");
  const relativePath =
    pathnameWithoutLeadingSlash.length === 0 ? "index.html" : pathnameWithoutLeadingSlash;
  const resolvedPath = path.resolve(buildDirectoryPath, relativePath);
  const normalizedBuildDirectoryPath = path.resolve(buildDirectoryPath);

  if (
    resolvedPath !== normalizedBuildDirectoryPath &&
    !resolvedPath.startsWith(`${normalizedBuildDirectoryPath}${path.sep}`)
  ) {
    return null;
  }

  return resolvedPath;
}

function isSinglePageApplicationPath(pathnameValue) {
  const basename = path.posix.basename(pathnameValue);
  return !basename.includes(".");
}

function writeBuildAssetErrorResponse(response, statusCode, message) {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.end(message);
}

function isMissingFileSystemError(error) {
  const parsedError = FileSystemErrorSchema.safeParse(error);
  return (
    parsedError.success &&
    (parsedError.data.code === "ENOENT" || parsedError.data.code === "ENOTDIR")
  );
}

function isForbiddenFileSystemError(error) {
  const parsedError = FileSystemErrorSchema.safeParse(error);
  return (
    parsedError.success && (parsedError.data.code === "EACCES" || parsedError.data.code === "EPERM")
  );
}

async function streamBuildAssetFile(requestedFilePath, response) {
  const fileHandle = await fs.promises.open(requestedFilePath, "r");

  try {
    response.statusCode = 200;
    response.setHeader("Content-Type", getContentType(requestedFilePath));
    response.setHeader("Cache-Control", "no-store");
    await Promise.resolve();
    if (response.destroyed) {
      return;
    }

    const readStream = fileHandle.createReadStream({ autoClose: false });
    const closePromise = new Promise((resolve) => {
      response.once("close", () => {
        readStream.destroy();
        resolve("closed");
      });
    });
    const pipelinePromise = pipeline(readStream, response);
    const streamResult = await Promise.race([
      pipelinePromise.then(() => "completed"),
      closePromise,
    ]);
    if (streamResult === "closed") {
      await pipelinePromise.catch(() => undefined);
    }
  } finally {
    await fileHandle.close().catch(() => undefined);
  }
}

function writeProxyFailureResponse(response, error) {
  if (response.headersSent || response.destroyed) {
    response.destroy();
    return;
  }

  response.statusCode = 502;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      ok: false,
      error: `Stable API proxy request failed: ${String(error)}`,
    }),
  );
}

function writeUnhandledRequestErrorResponse(response, error) {
  if (response.headersSent || response.destroyed) {
    response.destroy();
    return;
  }

  response.statusCode = 500;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      ok: false,
      error: `Stable web server request failed: ${String(error)}`,
    }),
  );
}

/**
 * Owns the validated web surface for stable development mode, including static asset serving,
 * pending-state pages, and API proxying to the stable API server.
 */
export class StableDevelopmentWebServer {
  server = null;

  currentBuildDirectoryPath = null;

  currentBuildVersion = null;

  status = "starting";

  message = "Waiting for the first validated build.";

  runtimeState = "starting";

  crashSummary = null;

  constructor({ host, port, apiHost, apiPort, apiToken, liveReloadPort, rawTrustedOrigins }) {
    this.host = host;
    this.port = port;
    this.apiHost = apiHost;
    this.apiPort = apiPort;
    this.apiToken = apiToken;
    this.liveReloadPort = liveReloadPort;
    this.trustedOrigins = parseStableDevelopmentTrustedOrigins(rawTrustedOrigins, port);
  }

  setStatus({ status, runtimeState, message, crashSummary = null }) {
    this.status = status;
    this.runtimeState = runtimeState;
    this.message = message;
    this.crashSummary = crashSummary;
  }

  setServedBuild({ buildDirectoryPath, buildVersion }) {
    this.currentBuildDirectoryPath = buildDirectoryPath;
    this.currentBuildVersion = buildVersion;
  }

  async start() {
    if (this.server !== null) {
      return;
    }

    this.server = http.createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        writeUnhandledRequestErrorResponse(response, error);
      });
    });

    await new Promise((resolve, reject) => {
      const server = this.server;
      if (server === null) {
        reject(new Error("Stable web server did not initialize"));
        return;
      }

      server.once("error", reject);
      server.listen(this.port, this.host, () => {
        server.off("error", reject);
        resolve(undefined);
      });
    });
  }

  async stop() {
    if (this.server === null) {
      return;
    }

    const server = this.server;
    this.server = null;
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(undefined);
      });
    });
  }

  async handleRequest(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      requestUrl.pathname === "/healthz" ||
      requestUrl.pathname.startsWith("/api") ||
      requestUrl.pathname.startsWith("/events")
    ) {
      await this.proxyApiRequest(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.end("Method not allowed");
      return;
    }

    if (this.currentBuildDirectoryPath === null) {
      response.statusCode = 503;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(
        buildPendingPage({
          message: this.message,
          status: this.status,
          liveReloadPort: this.liveReloadPort,
        }),
      );
      return;
    }

    if (this.runtimeState === "api_crashed") {
      response.statusCode = 503;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(
        buildApiCrashPage({
          crashSummary: this.crashSummary,
          liveReloadPort: this.liveReloadPort,
          message: this.message,
        }),
      );
      return;
    }

    await this.serveBuildAsset(requestUrl.pathname, request, response);
  }

  async serveBuildAsset(pathnameValue, request, response) {
    const buildDirectoryPath = this.currentBuildDirectoryPath;
    if (buildDirectoryPath === null) {
      response.statusCode = 503;
      response.end("No validated build available");
      return;
    }

    let requestedFilePath = resolveRequestedFilePath(buildDirectoryPath, pathnameValue);
    if (requestedFilePath === null) {
      response.statusCode = 400;
      response.end("Invalid path");
      return;
    }

    const isSinglePageApplicationRequest = isSinglePageApplicationPath(pathnameValue);
    if (!fs.existsSync(requestedFilePath) || fs.statSync(requestedFilePath).isDirectory()) {
      if (!isSinglePageApplicationRequest) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      requestedFilePath = path.join(buildDirectoryPath, "index.html");
    }

    if (path.basename(requestedFilePath) === "index.html") {
      const indexHtml = await fs.promises.readFile(requestedFilePath, "utf8");
      const injectedHtml = injectLiveReloadScript(
        indexHtml,
        buildLiveReloadScript({
          buildVersion: this.currentBuildVersion,
          liveReloadPort: this.liveReloadPort,
        }),
      );

      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      response.end(injectedHtml);
      return;
    }

    if (request.method === "HEAD") {
      response.statusCode = 200;
      response.setHeader("Content-Type", getContentType(requestedFilePath));
      response.setHeader("Cache-Control", "no-store");
      response.end();
      return;
    }

    try {
      await streamBuildAssetFile(requestedFilePath, response);
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return;
      }

      if (isMissingFileSystemError(error)) {
        writeBuildAssetErrorResponse(response, 404, "Not found");
        return;
      }

      if (isForbiddenFileSystemError(error)) {
        writeBuildAssetErrorResponse(response, 403, "Forbidden");
        return;
      }

      writeBuildAssetErrorResponse(response, 500, "Failed to read build asset");
    }
  }

  async proxyApiRequest(request, response) {
    const requestHeaders = { ...request.headers };
    requestHeaders.host = `${this.apiHost}:${String(this.apiPort)}`;

    if (
      shouldInjectApiTokenForStableDevelopmentProxy({
        apiToken: this.apiToken,
        originHeader:
          typeof request.headers.origin === "string" ? request.headers.origin : undefined,
        hostHeader: typeof request.headers.host === "string" ? request.headers.host : undefined,
        remoteAddress: request.socket.remoteAddress,
        trustedOrigins: this.trustedOrigins,
      })
    ) {
      requestHeaders["x-farfield-token"] = this.apiToken;
    }

    await new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(undefined);
      };
      const proxyRequest = http.request(
        {
          hostname: this.apiHost,
          port: this.apiPort,
          path: request.url,
          method: request.method,
          headers: requestHeaders,
        },
        (proxyResponse) => {
          response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
          const closePromise = new Promise((closeResolve) => {
            response.once("close", () => {
              proxyResponse.destroy();
              closeResolve("closed");
            });
          });
          const pipelinePromise = pipeline(proxyResponse, response);
          void Promise.race([pipelinePromise.then(() => "completed"), closePromise])
            .then(async (result) => {
              if (result === "closed") {
                await pipelinePromise.catch(() => undefined);
              }
              settle();
            })
            .catch((error) => {
              writeProxyFailureResponse(response, error);
              settle();
            });
        },
      );

      proxyRequest.on("error", (error) => {
        writeProxyFailureResponse(response, error);
        settle();
      });

      response.once("close", () => {
        proxyRequest.destroy();
        settle();
      });
      response.once("error", () => {
        proxyRequest.destroy();
        settle();
      });
      request.once("aborted", () => {
        proxyRequest.destroy();
        settle();
      });
      request.pipe(proxyRequest);
    });
  }
}
