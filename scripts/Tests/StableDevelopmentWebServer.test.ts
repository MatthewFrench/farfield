import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StableDevelopmentWebServer } from "../development/StableDevelopmentWebServer.mjs";

const temporaryDirectoryPaths: string[] = [];
const startedServerInstances: StableDevelopmentWebServer[] = [];
const startedHttpServers: http.Server[] = [];

interface ListeningAddress {
  port: number;
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (startedServerInstances.length > 0) {
    const server = startedServerInstances.pop();
    if (server === undefined) {
      continue;
    }
    await server.stop();
  }
  while (startedHttpServers.length > 0) {
    const server = startedHttpServers.pop();
    if (server === undefined) {
      continue;
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
  while (temporaryDirectoryPaths.length > 0) {
    const temporaryDirectoryPath = temporaryDirectoryPaths.pop();
    if (temporaryDirectoryPath === undefined) {
      continue;
    }
    await fs.promises.rm(temporaryDirectoryPath, {
      recursive: true,
      force: true,
    });
  }
});

describe("StableDevelopmentWebServer", () => {
  it("returns a controlled not-found response when an asset disappears before streaming opens", async () => {
    const buildDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "farfield-stable-dev-build-"));
    temporaryDirectoryPaths.push(buildDirectoryPath);
    const assetPath = path.join(buildDirectoryPath, "asset.js");
    await fs.promises.writeFile(assetPath, 'console.log("ok");', "utf8");
    const missingFileError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    });
    const openSpy = vi.spyOn(fs.promises, "open").mockRejectedValueOnce(missingFileError);

    const upstreamServer = await startUpstreamServer((_request, response) => {
      response.statusCode = 200;
      response.end("ok");
    });
    const stableServer = await startStableDevelopmentWebServer(upstreamServer.port);
    stableServer.setServedBuild({
      buildDirectoryPath,
      buildVersion: "build-1",
    });

    const response = await fetch(`${readStableDevelopmentServerBaseUrl(stableServer)}/asset.js`);

    expect(openSpy).toHaveBeenCalledWith(assetPath, "r");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("settles proxied requests when the upstream response aborts before completion", async () => {
    const upstreamServer = await startUpstreamServer((request, response) => {
      if (request.url === "/healthz") {
        response.statusCode = 200;
        response.end("ok");
        return;
      }

      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.write("partial");
      response.socket?.destroy();
    });
    const stableServer = await startStableDevelopmentWebServer(upstreamServer.port);

    const proxiedRequestOutcome = await Promise.race([
      performHttpRequest(`${readStableDevelopmentServerBaseUrl(stableServer)}/api/threads`),
      new Promise((resolve) => {
        setTimeout(() => resolve("timed-out"), 2_000);
      }),
    ]);
    expect(proxiedRequestOutcome).not.toBe("timed-out");

    const healthResponse = await fetch(
      `${readStableDevelopmentServerBaseUrl(stableServer)}/healthz`,
    );
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.text()).toBe("ok");
  });
});

async function startStableDevelopmentWebServer(
  apiPort: number,
): Promise<StableDevelopmentWebServer> {
  const stableServer = new StableDevelopmentWebServer({
    host: "127.0.0.1",
    port: 0,
    apiHost: "127.0.0.1",
    apiPort,
    apiToken: "token",
    liveReloadPort: 4455,
    rawTrustedOrigins: undefined,
  });
  startedServerInstances.push(stableServer);
  await stableServer.start();
  return stableServer;
}

async function startUpstreamServer(
  requestHandler: (request: http.IncomingMessage, response: http.ServerResponse) => void,
): Promise<ListeningAddress> {
  const server = http.createServer(requestHandler);
  startedHttpServers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  return readListeningAddress(server);
}

function readListeningAddress(server: http.Server): ListeningAddress {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a listening TCP address");
  }
  return {
    port: address.port,
  };
}

function readStableDevelopmentServerBaseUrl(server: StableDevelopmentWebServer): string {
  if (server.server === null) {
    throw new Error("Expected stable development server to be listening");
  }
  const address = readListeningAddress(server.server);
  return `http://127.0.0.1:${String(address.port)}`;
}

async function performHttpRequest(url: string): Promise<string> {
  return await new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.once("end", () => {
        resolve("ended");
      });
      response.once("close", () => {
        resolve("closed");
      });
      response.once("error", () => {
        resolve("errored");
      });
    });
    request.once("error", () => {
      resolve("request-error");
    });
  });
}
