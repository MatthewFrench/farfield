import fs from "node:fs";
import type { ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  DebugFileDownloadError,
  DebugFileDownloadErrorCodeByName,
  streamDebugFileDownload,
} from "../Source/Network/Routes/DebugFileDownload.js";

class DownloadResponseRecorder extends Writable {
  public statusCode: number | null = null;
  public headers: Record<string, number | string | readonly string[]> | null = null;
  private readonly chunks: Buffer[] = [];

  public writeHead(
    statusCode: number,
    headers: Record<string, number | string | readonly string[]>,
  ): void {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  protected _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk, encoding) : Buffer.from(chunk));
    callback();
  }

  public readBody(): Buffer {
    return Buffer.concat(this.chunks);
  }

  public asServerResponse(): ServerResponse {
    return this as ServerResponse;
  }
}

async function readRejectedDownloadError(
  response: ServerResponse,
  filePath: string,
  downloadFileName: string,
): Promise<DebugFileDownloadError> {
  try {
    await streamDebugFileDownload(response, filePath, downloadFileName);
  } catch (error) {
    if (error instanceof DebugFileDownloadError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected streamDebugFileDownload to reject");
}

function createFailingReadStream(fileSystemErrorCode: string): fs.ReadStream {
  const failingStream = new Readable({
    read() {
      const streamError: NodeJS.ErrnoException = new Error(
        `Simulated stream failure with code ${fileSystemErrorCode}`,
      );
      streamError.code = fileSystemErrorCode;
      this.destroy(streamError);
    },
  });
  return failingStream as fs.ReadStream;
}

describe("streamDebugFileDownload", () => {
  it("returns a typed not-found error for missing files", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-missing-"));
    try {
      const response = new DownloadResponseRecorder();
      const missingFilePath = path.join(temporaryDirectory, "missing.ndjson");
      const error = await readRejectedDownloadError(
        response.asServerResponse(),
        missingFilePath,
        "missing.ndjson",
      );
      expect(error.code).toBe(DebugFileDownloadErrorCodeByName.notFound);
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("returns a typed not-file error when the download path is a directory", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-not-file-"));
    try {
      const response = new DownloadResponseRecorder();
      const error = await readRejectedDownloadError(
        response.asServerResponse(),
        temporaryDirectory,
        "directory.ndjson",
      );
      expect(error.code).toBe(DebugFileDownloadErrorCodeByName.notFile);
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("rejects invalid file path and file name contracts before file-system operations", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-contracts-"));
    const filePath = path.join(temporaryDirectory, "trace.ndjson");
    fs.writeFileSync(filePath, '{"ok":true}\n', "utf8");
    try {
      const invalidPathResponse = new DownloadResponseRecorder();
      const invalidPathError = await readRejectedDownloadError(
        invalidPathResponse.asServerResponse(),
        "   ",
        "trace.ndjson",
      );
      expect(invalidPathError.code).toBe(DebugFileDownloadErrorCodeByName.invalidRequest);
      expect(invalidPathError.message).toBe(
        "Debug download file path must contain at least one non-whitespace character",
      );

      const invalidFileNameResponse = new DownloadResponseRecorder();
      const invalidFileNameError = await readRejectedDownloadError(
        invalidFileNameResponse.asServerResponse(),
        filePath,
        "nested/trace.ndjson",
      );
      expect(invalidFileNameError.code).toBe(DebugFileDownloadErrorCodeByName.invalidRequest);
      expect(invalidFileNameError.message).toBe(
        "Debug download file name must not contain path separators",
      );
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("writes deterministic download headers and streams the expected body", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-headers-"));
    const filePath = path.join(temporaryDirectory, "trace.ndjson");
    const fileBody = '{"event":"trace-start"}\n{"event":"trace-stop"}\n';
    fs.writeFileSync(filePath, fileBody, "utf8");
    try {
      const response = new DownloadResponseRecorder();
      await streamDebugFileDownload(response.asServerResponse(), filePath, "trace.ndjson");

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/x-ndjson",
        "Content-Length": Buffer.byteLength(fileBody, "utf8"),
        "Content-Disposition": 'attachment; filename="trace.ndjson"',
        "Access-Control-Allow-Origin": "*",
      });
      expect(response.readBody().toString("utf8")).toBe(fileBody);
    } finally {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("maps create-read-stream missing-path failures to typed not-found errors", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-stream-404-"));
    const filePath = path.join(temporaryDirectory, "trace.ndjson");
    fs.writeFileSync(filePath, '{"ok":true}\n', "utf8");
    const streamSpy = vi
      .spyOn(fs, "createReadStream")
      .mockImplementation((): fs.ReadStream => createFailingReadStream("ENOENT"));

    try {
      const response = new DownloadResponseRecorder();
      const error = await readRejectedDownloadError(
        response.asServerResponse(),
        filePath,
        "trace.ndjson",
      );

      expect(error.code).toBe(DebugFileDownloadErrorCodeByName.notFound);
      expect(response.statusCode).toBe(200);
      expect(response.headers?.["Content-Disposition"]).toBe('attachment; filename="trace.ndjson"');
    } finally {
      streamSpy.mockRestore();
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("maps non-recoverable create-read-stream failures to typed stream-failed errors", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "debug-download-stream-500-"));
    const filePath = path.join(temporaryDirectory, "trace.ndjson");
    fs.writeFileSync(filePath, '{"ok":true}\n', "utf8");
    const streamSpy = vi
      .spyOn(fs, "createReadStream")
      .mockImplementation((): fs.ReadStream => createFailingReadStream("EACCES"));

    try {
      const response = new DownloadResponseRecorder();
      const error = await readRejectedDownloadError(
        response.asServerResponse(),
        filePath,
        "trace.ndjson",
      );
      expect(error.code).toBe(DebugFileDownloadErrorCodeByName.streamFailed);
      expect(error.message).toBe("Failed to stream debug download file");
    } finally {
      streamSpy.mockRestore();
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  });
});
