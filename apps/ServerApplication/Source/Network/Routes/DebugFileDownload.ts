import fs from "node:fs";
import type { ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";

const DEBUG_DOWNLOAD_CONTENT_TYPE = "application/x-ndjson";
const DEBUG_DOWNLOAD_ACCESS_CONTROL_ALLOW_ORIGIN = "*";

export const DebugFileDownloadErrorCodeByName = {
  notFound: "not-found",
  notFile: "not-file",
  streamFailed: "stream-failed"
} as const;

export type DebugFileDownloadErrorCode =
  typeof DebugFileDownloadErrorCodeByName[keyof typeof DebugFileDownloadErrorCodeByName];

/**
 * Download errors are normalized here so route owners can map response status deterministically
 * without inspecting transport-specific error strings.
 */
export class DebugFileDownloadError extends Error {
  public readonly code: DebugFileDownloadErrorCode;

  public constructor(code: DebugFileDownloadErrorCode, message: string) {
    super(message);
    this.name = "DebugFileDownloadError";
    this.code = code;
  }
}

export async function streamDebugFileDownload(
  res: ServerResponse,
  filePath: string,
  downloadFileName: string
): Promise<void> {
  let fileStats: fs.Stats;
  try {
    fileStats = await fs.promises.stat(filePath);
  } catch {
    throw new DebugFileDownloadError(
      DebugFileDownloadErrorCodeByName.notFound,
      "Requested download file was not found"
    );
  }

  if (!fileStats.isFile()) {
    throw new DebugFileDownloadError(
      DebugFileDownloadErrorCodeByName.notFile,
      "Requested download path is not a file"
    );
  }

  res.writeHead(200, {
    "Content-Type": DEBUG_DOWNLOAD_CONTENT_TYPE,
    "Content-Length": fileStats.size,
    "Content-Disposition": `attachment; filename=\"${downloadFileName}\"`,
    "Access-Control-Allow-Origin": DEBUG_DOWNLOAD_ACCESS_CONTROL_ALLOW_ORIGIN
  });

  try {
    await pipeline(fs.createReadStream(filePath), res);
  } catch {
    throw new DebugFileDownloadError(
      DebugFileDownloadErrorCodeByName.streamFailed,
      "Failed to stream debug download file"
    );
  }
}
