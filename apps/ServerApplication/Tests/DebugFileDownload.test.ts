import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import {
  DebugFileDownloadError,
  DebugFileDownloadErrorCodeByName,
  streamDebugFileDownload
} from "../Source/Network/Routes/DebugFileDownload.js";

function createMockResponse(): ServerResponse {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  return new ServerResponse(request);
}

describe("streamDebugFileDownload", () => {
  it("returns a typed not-found error for missing files", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-missing-"));
    try {
      const response = createMockResponse();
      const missingFilePath = path.join(temporaryDirectory, "missing.ndjson");

      await expect(
        streamDebugFileDownload(response, missingFilePath, "missing.ndjson")
      ).rejects.toBeInstanceOf(DebugFileDownloadError);
      await expect(
        streamDebugFileDownload(response, missingFilePath, "missing.ndjson")
      ).rejects.toMatchObject({
        code: DebugFileDownloadErrorCodeByName.notFound
      });
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true
      });
    }
  });

  it("returns a typed not-file error when the download path is a directory", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-not-file-"));
    try {
      const response = createMockResponse();

      await expect(
        streamDebugFileDownload(response, temporaryDirectory, "directory.ndjson")
      ).rejects.toBeInstanceOf(DebugFileDownloadError);
      await expect(
        streamDebugFileDownload(response, temporaryDirectory, "directory.ndjson")
      ).rejects.toMatchObject({
        code: DebugFileDownloadErrorCodeByName.notFile
      });
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true
      });
    }
  });
});
