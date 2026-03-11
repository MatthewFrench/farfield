import * as fileSystemPromises from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handleLocalImageRoutes } from "../Source/Network/Routes/LocalImageRoutes.js";

const RESPONSE_STATUS_CODE_NOT_FOUND = 404;
const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6f6QAAAABJRU5ErkJggg==";
const ServerAddressSchema = z.object({
  port: z.number().int().positive(),
});

const temporaryDirectoryPaths: string[] = [];

interface RouteTestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (temporaryDirectoryPaths.length > 0) {
    const temporaryDirectoryPath = temporaryDirectoryPaths.pop();
    if (temporaryDirectoryPath === undefined) {
      continue;
    }
    await rm(temporaryDirectoryPath, {
      recursive: true,
      force: true,
    });
  }
});

describe("handleLocalImageRoutes", () => {
  it("serves local image bytes for an absolute path", async () => {
    const temporaryDirectoryPath = await createTemporaryDirectory();
    const imagePath = join(temporaryDirectoryPath, "sample.png");
    const imageBytes = Buffer.from(TEST_IMAGE_BASE64, "base64");
    await writeFile(imagePath, imageBytes);

    const server = await startRouteTestServer();
    try {
      const response = await fetch(
        `${server.baseUrl}/api/files/local-image?path=${encodeURIComponent(imagePath)}`,
      );
      const responseBytes = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(responseBytes.equals(imageBytes)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("returns a bad-request error when image path is relative", async () => {
    const server = await startRouteTestServer();
    try {
      const response = await fetch(
        `${server.baseUrl}/api/files/local-image?path=${encodeURIComponent("relative/image.png")}`,
      );
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody).toMatchObject({
        ok: false,
        error: "Image path must be absolute",
      });
    } finally {
      await server.close();
    }
  });

  it("returns unsupported-media-type for non-image extensions", async () => {
    const temporaryDirectoryPath = await createTemporaryDirectory();
    const textPath = join(temporaryDirectoryPath, "sample.txt");
    await writeFile(textPath, "not-an-image", "utf8");

    const server = await startRouteTestServer();
    try {
      const response = await fetch(
        `${server.baseUrl}/api/files/local-image?path=${encodeURIComponent(textPath)}`,
      );
      const responseBody = await response.json();

      expect(response.status).toBe(415);
      expect(responseBody).toMatchObject({
        ok: false,
        error: "Unsupported image type",
      });
    } finally {
      await server.close();
    }
  });

  it("returns not-found when the image file does not exist", async () => {
    const server = await startRouteTestServer();
    try {
      const response = await fetch(
        `${server.baseUrl}/api/files/local-image?path=${encodeURIComponent("/tmp/farfield-missing.png")}`,
      );
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(responseBody).toMatchObject({
        ok: false,
        error: "Image file not found",
      });
    } finally {
      await server.close();
    }
  });

  it("returns a controlled not-found response when the image disappears before streaming opens", async () => {
    const temporaryDirectoryPath = await createTemporaryDirectory();
    const imagePath = join(temporaryDirectoryPath, "sample.png");
    await writeFile(imagePath, Buffer.from(TEST_IMAGE_BASE64, "base64"));
    const missingFileError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    });
    const openFile = vi.fn<typeof fileSystemPromises.open>().mockRejectedValue(missingFileError);

    const server = await startRouteTestServer({
      openFile,
    });
    try {
      const response = await fetch(
        `${server.baseUrl}/api/files/local-image?path=${encodeURIComponent(imagePath)}`,
      );
      const responseBody = await response.json();

      expect(response.status).toBe(404);
      expect(openFile).toHaveBeenCalledWith(imagePath, "r");
      expect(responseBody).toMatchObject({
        ok: false,
        error: "Image file not found",
      });
    } finally {
      await server.close();
    }
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const temporaryDirectoryPath = await mkdtemp(join(tmpdir(), "farfield-local-image-route-"));
  temporaryDirectoryPaths.push(temporaryDirectoryPath);
  return temporaryDirectoryPath;
}

async function startRouteTestServer(input?: {
  openFile?: typeof fileSystemPromises.open;
}): Promise<RouteTestServer> {
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const handled = await handleLocalImageRoutes({
      req: request,
      res: response,
      pathname: requestUrl.pathname,
      url: requestUrl,
      openFile: input?.openFile,
      jsonResponse: (nextResponse, statusCode, payload) => {
        nextResponse.statusCode = statusCode;
        nextResponse.setHeader("Content-Type", "application/json");
        nextResponse.end(JSON.stringify(payload));
      },
    });

    if (!handled) {
      response.statusCode = RESPONSE_STATUS_CODE_NOT_FOUND;
      response.end();
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const parsedAddress = ServerAddressSchema.parse(server.address());
  return {
    baseUrl: `http://127.0.0.1:${String(parsedAddress.port)}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
