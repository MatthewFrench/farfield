import http from "node:http";

/**
 * Owns the separate stable-development live-reload surface.
 * The web server serves the validated snapshot, while this port exposes only
 * build-version state so pages can poll and reload when a new validated build is promoted.
 */
export class StableDevelopmentLiveReloadServer {
  server = null;

  state = {
    buildVersion: null,
    status: "starting",
    runtimeState: "starting",
    message: "Waiting for the first validated build.",
    updatedAt: new Date().toISOString(),
    crashSummary: null,
  };

  constructor({ host, port }) {
    this.host = host;
    this.port = port;
  }

  setState({ buildVersion, status, runtimeState, message, crashSummary }) {
    this.state = {
      buildVersion,
      status,
      runtimeState,
      message,
      updatedAt: new Date().toISOString(),
      crashSummary,
    };
  }

  async start() {
    if (this.server !== null) {
      return;
    }

    this.server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Cache-Control", "no-store");

      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }

      if (requestUrl.pathname !== "/stable-dev/version") {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(this.state));
    });

    await new Promise((resolve, reject) => {
      const server = this.server;
      if (server === null) {
        reject(new Error("Live-reload server did not initialize"));
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
}
