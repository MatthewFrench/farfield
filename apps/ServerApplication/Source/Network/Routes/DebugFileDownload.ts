import fs from "node:fs";
import type { ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

const DEBUG_DOWNLOAD_CONTENT_TYPE = "application/x-ndjson";
const DEBUG_DOWNLOAD_ACCESS_CONTROL_ALLOW_ORIGIN = "*";
const DEBUG_DOWNLOAD_FILE_SYSTEM_ERROR_CODE_BY_NAME = {
  missingPath: "ENOENT",
  missingPathSegment: "ENOTDIR",
  pathIsDirectory: "EISDIR",
} as const;
const DebugFileDownloadMessageByName = {
  invalidDownloadInput: "Debug download input contract is invalid",
  invalidFilePath: "Debug download file path must contain at least one non-whitespace character",
  invalidFilePathNulCharacter: "Debug download file path must not contain NUL characters",
  invalidFileName: "Debug download file name must contain at least one non-whitespace character",
  invalidFileNamePathSeparator: "Debug download file name must not contain path separators",
  invalidFileNameHeaderUnsafeCharacter:
    "Debug download file name contains header-unsafe characters",
  fileNotFound: "Requested download file was not found",
  notFile: "Requested download path is not a file",
  statFailed: "Failed to read debug download file metadata",
  streamFailed: "Failed to stream debug download file",
} as const;
const HEADER_UNSAFE_FILENAME_CHARACTER_PATTERN = /[\u0000-\u001F\u007F"\\]/u;
const DebugFileDownloadInputSchema = z
  .object({
    filePath: z
      .string()
      .min(1, {
        message: DebugFileDownloadMessageByName.invalidFilePath,
      })
      .refine((value) => value.trim().length > 0, {
        message: DebugFileDownloadMessageByName.invalidFilePath,
      })
      .refine((value) => !value.includes("\0"), {
        message: DebugFileDownloadMessageByName.invalidFilePathNulCharacter,
      }),
    downloadFileName: z
      .string()
      .min(1, {
        message: DebugFileDownloadMessageByName.invalidFileName,
      })
      .max(255, {
        message: DebugFileDownloadMessageByName.invalidFileName,
      })
      .refine((value) => value.trim().length > 0, {
        message: DebugFileDownloadMessageByName.invalidFileName,
      })
      .refine((value) => !(value.includes("/") || value.includes("\\")), {
        message: DebugFileDownloadMessageByName.invalidFileNamePathSeparator,
      })
      .refine((value) => !HEADER_UNSAFE_FILENAME_CHARACTER_PATTERN.test(value), {
        message: DebugFileDownloadMessageByName.invalidFileNameHeaderUnsafeCharacter,
      }),
  })
  .strict();
const DebugFileSystemErrorSchema = z.object({
  code: z.string().optional(),
});

interface DebugFileDownloadInput {
  filePath: string;
  downloadFileName: string;
}

export const DebugFileDownloadErrorCodeByName = {
  invalidRequest: "invalid-request",
  notFound: "not-found",
  notFile: "not-file",
  streamFailed: "stream-failed",
} as const;

export type DebugFileDownloadErrorCode =
  (typeof DebugFileDownloadErrorCodeByName)[keyof typeof DebugFileDownloadErrorCodeByName];

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

function parseDebugFileDownloadInput(
  filePath: string,
  downloadFileName: string,
): DebugFileDownloadInput {
  const parsedInput = DebugFileDownloadInputSchema.safeParse({
    filePath,
    downloadFileName,
  });
  if (parsedInput.success) {
    return parsedInput.data;
  }

  const firstIssue = parsedInput.error.issues[0];
  const message = firstIssue
    ? firstIssue.message
    : DebugFileDownloadMessageByName.invalidDownloadInput;
  throw new DebugFileDownloadError(DebugFileDownloadErrorCodeByName.invalidRequest, message);
}

function mapFileSystemErrorToDownloadError(
  fileSystemErrorCode: string | null,
  defaultMessage: string,
): DebugFileDownloadError {
  if (
    fileSystemErrorCode === DEBUG_DOWNLOAD_FILE_SYSTEM_ERROR_CODE_BY_NAME.missingPath ||
    fileSystemErrorCode === DEBUG_DOWNLOAD_FILE_SYSTEM_ERROR_CODE_BY_NAME.missingPathSegment
  ) {
    return new DebugFileDownloadError(
      DebugFileDownloadErrorCodeByName.notFound,
      DebugFileDownloadMessageByName.fileNotFound,
    );
  }

  if (fileSystemErrorCode === DEBUG_DOWNLOAD_FILE_SYSTEM_ERROR_CODE_BY_NAME.pathIsDirectory) {
    return new DebugFileDownloadError(
      DebugFileDownloadErrorCodeByName.notFile,
      DebugFileDownloadMessageByName.notFile,
    );
  }

  return new DebugFileDownloadError(DebugFileDownloadErrorCodeByName.streamFailed, defaultMessage);
}

export async function streamDebugFileDownload(
  res: ServerResponse,
  filePath: string,
  downloadFileName: string,
): Promise<void> {
  const parsedInput = parseDebugFileDownloadInput(filePath, downloadFileName);

  let fileStats: fs.Stats;
  try {
    fileStats = await fs.promises.stat(parsedInput.filePath);
  } catch (error) {
    const parsedFileSystemError = DebugFileSystemErrorSchema.safeParse(error);
    const fileSystemErrorCode = parsedFileSystemError.success
      ? (parsedFileSystemError.data.code ?? null)
      : null;
    throw mapFileSystemErrorToDownloadError(
      fileSystemErrorCode,
      DebugFileDownloadMessageByName.statFailed,
    );
  }

  if (!fileStats.isFile()) {
    throw new DebugFileDownloadError(
      DebugFileDownloadErrorCodeByName.notFile,
      DebugFileDownloadMessageByName.notFile,
    );
  }

  res.writeHead(200, {
    "Content-Type": DEBUG_DOWNLOAD_CONTENT_TYPE,
    "Content-Length": fileStats.size,
    "Content-Disposition": `attachment; filename=\"${parsedInput.downloadFileName}\"`,
    "Access-Control-Allow-Origin": DEBUG_DOWNLOAD_ACCESS_CONTROL_ALLOW_ORIGIN,
  });

  try {
    // File-system state can change between stat and stream open; map the stream error code
    // so callers keep deterministic status behavior for not-found/non-file conditions.
    await pipeline(fs.createReadStream(parsedInput.filePath), res);
  } catch (error) {
    const parsedFileSystemError = DebugFileSystemErrorSchema.safeParse(error);
    const fileSystemErrorCode = parsedFileSystemError.success
      ? (parsedFileSystemError.data.code ?? null)
      : null;
    throw mapFileSystemErrorToDownloadError(
      fileSystemErrorCode,
      DebugFileDownloadMessageByName.streamFailed,
    );
  }
}
