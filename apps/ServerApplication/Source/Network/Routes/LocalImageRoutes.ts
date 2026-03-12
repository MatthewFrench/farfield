import * as fileSystemPromises from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path, { extname, isAbsolute } from "node:path";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import type { ThreadRouteDependencies } from "./ThreadRoutes.js";

const LOCAL_IMAGE_ROUTE_PATH = "/api/files/local-image";
const LOCAL_IMAGE_QUERY_PATH_KEY = "path";
const MAXIMUM_LOCAL_IMAGE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_ALLOWED_LOCAL_IMAGE_ROOTS = [path.resolve(process.cwd()), path.resolve(tmpdir())];

const LocalImageRouteStatusCodeByName = {
  successOk: 200,
  clientErrorBadRequest: 400,
  clientErrorForbidden: 403,
  clientErrorNotFound: 404,
  clientErrorPayloadTooLarge: 413,
  clientErrorUnsupportedMediaType: 415,
  serverErrorInternal: 500,
} as const;

const LocalImageRouteErrorByName = {
  invalidImagePath: "Invalid image path",
  imagePathMustBeAbsolute: "Image path must be absolute",
  imagePathOutsideAllowedRoots: "Image path is outside the allowed roots",
  imageFileNotFound: "Image file not found",
  imageFileAccessDenied: "Image file access denied",
  unsupportedImageType: "Unsupported image type",
  imageFileTooLarge: "Image file is too large",
  imageFileStatFailed: "Failed to read image file metadata",
  imageFileReadFailed: "Failed to read image file",
} as const;

const MIME_TYPE_BY_FILE_EXTENSION = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
} as const;

const LocalImageQuerySchema = z
  .object({
    path: z.string().min(1),
  })
  .strict();
const FileSystemErrorSchema = z
  .object({
    code: z.string(),
  })
  .passthrough();
type ParsedFileSystemError = z.SafeParseReturnType<
  { code: string },
  z.infer<typeof FileSystemErrorSchema>
>;

interface LocalImageRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  jsonResponse: ThreadRouteDependencies["jsonResponse"];
  allowedRoots?: readonly string[];
  openFile?: typeof fileSystemPromises.open;
  readRealPath?: typeof fileSystemPromises.realpath;
}

interface LocalImageQuery {
  path: string;
}

/**
 * Serves local image files through an explicit API boundary so browser surfaces
 * can render image paths emitted by thread items and markdown content.
 */
export async function handleLocalImageRoutes(
  dependencies: LocalImageRouteDependencies,
): Promise<boolean> {
  const { req, pathname } = dependencies;
  if (!(req.method === "GET" && pathname === LOCAL_IMAGE_ROUTE_PATH)) {
    return false;
  }

  const parsedQuery = parseLocalImageQuery(dependencies.url);
  if (!parsedQuery.success) {
    dependencies.jsonResponse(
      dependencies.res,
      LocalImageRouteStatusCodeByName.clientErrorBadRequest,
      {
        ok: false,
        error: LocalImageRouteErrorByName.invalidImagePath,
        details: parsedQuery.error.issues,
      },
    );
    return true;
  }

  const imagePath = parsedQuery.data.path;
  if (!isAbsolute(imagePath)) {
    dependencies.jsonResponse(
      dependencies.res,
      LocalImageRouteStatusCodeByName.clientErrorBadRequest,
      {
        ok: false,
        error: LocalImageRouteErrorByName.imagePathMustBeAbsolute,
      },
    );
    return true;
  }
  const canonicalImagePath = await readCanonicalImagePath(imagePath, dependencies);
  if (canonicalImagePath === null) {
    return true;
  }

  const allowedRootsContainImagePath = await isPathWithinAllowedRoots(
    canonicalImagePath,
    dependencies,
  );
  if (!allowedRootsContainImagePath) {
    dependencies.jsonResponse(
      dependencies.res,
      LocalImageRouteStatusCodeByName.clientErrorForbidden,
      {
        ok: false,
        error: LocalImageRouteErrorByName.imagePathOutsideAllowedRoots,
      },
    );
    return true;
  }

  const contentType = readImageContentType(canonicalImagePath);
  if (contentType === null) {
    dependencies.jsonResponse(
      dependencies.res,
      LocalImageRouteStatusCodeByName.clientErrorUnsupportedMediaType,
      {
        ok: false,
        error: LocalImageRouteErrorByName.unsupportedImageType,
      },
    );
    return true;
  }

  const fileMetadata = await readImageFileMetadata(canonicalImagePath, dependencies);
  if (fileMetadata === null) {
    return true;
  }

  if (fileMetadata.size > MAXIMUM_LOCAL_IMAGE_FILE_SIZE_BYTES) {
    dependencies.jsonResponse(
      dependencies.res,
      LocalImageRouteStatusCodeByName.clientErrorPayloadTooLarge,
      {
        ok: false,
        error: LocalImageRouteErrorByName.imageFileTooLarge,
      },
    );
    return true;
  }

  const response = dependencies.res;
  await streamImageFile(response, canonicalImagePath, contentType, dependencies);
  return true;
}

function parseLocalImageQuery(url: URL) {
  const query: LocalImageQuery = {
    path: url.searchParams.get(LOCAL_IMAGE_QUERY_PATH_KEY) ?? "",
  };
  return LocalImageQuerySchema.safeParse(query);
}

function readImageContentType(imagePath: string): string | null {
  const extension = extname(imagePath).toLowerCase() as keyof typeof MIME_TYPE_BY_FILE_EXTENSION;
  return MIME_TYPE_BY_FILE_EXTENSION[extension] ?? null;
}

async function readCanonicalImagePath(
  imagePath: string,
  dependencies: LocalImageRouteDependencies,
): Promise<string | null> {
  const readRealPath = dependencies.readRealPath ?? fileSystemPromises.realpath;
  try {
    return await readRealPath(imagePath);
  } catch (error) {
    const parsedFileSystemError = FileSystemErrorSchema.safeParse(error);
    if (isMissingFileSystemError(parsedFileSystemError)) {
      dependencies.jsonResponse(
        dependencies.res,
        LocalImageRouteStatusCodeByName.clientErrorNotFound,
        {
          ok: false,
          error: LocalImageRouteErrorByName.imageFileNotFound,
        },
      );
      return null;
    }
    if (isForbiddenFileSystemError(parsedFileSystemError)) {
      dependencies.jsonResponse(
        dependencies.res,
        LocalImageRouteStatusCodeByName.clientErrorForbidden,
        {
          ok: false,
          error: LocalImageRouteErrorByName.imageFileAccessDenied,
        },
      );
      return null;
    }

    dependencies.jsonResponse(
      dependencies.res,
      LocalImageRouteStatusCodeByName.serverErrorInternal,
      {
        ok: false,
        error: LocalImageRouteErrorByName.imageFileStatFailed,
      },
    );
    return null;
  }
}

async function isPathWithinAllowedRoots(
  canonicalImagePath: string,
  dependencies: LocalImageRouteDependencies,
): Promise<boolean> {
  const readRealPath = dependencies.readRealPath ?? fileSystemPromises.realpath;
  const allowedRootPaths = dependencies.allowedRoots ?? DEFAULT_ALLOWED_LOCAL_IMAGE_ROOTS;
  const canonicalAllowedRoots: string[] = [];

  for (const allowedRootPath of allowedRootPaths) {
    try {
      canonicalAllowedRoots.push(await readRealPath(path.resolve(allowedRootPath)));
    } catch (error) {
      const parsedFileSystemError = FileSystemErrorSchema.safeParse(error);
      if (
        isMissingFileSystemError(parsedFileSystemError) ||
        isForbiddenFileSystemError(parsedFileSystemError)
      ) {
        continue;
      }
      throw error;
    }
  }

  return canonicalAllowedRoots.some((canonicalAllowedRoot) => {
    return (
      canonicalImagePath === canonicalAllowedRoot ||
      canonicalImagePath.startsWith(`${canonicalAllowedRoot}${path.sep}`)
    );
  });
}

async function readImageFileMetadata(
  imagePath: string,
  dependencies: LocalImageRouteDependencies,
): Promise<{ size: number } | null> {
  try {
    const fileMetadata = await fileSystemPromises.stat(imagePath);
    if (!fileMetadata.isFile()) {
      dependencies.jsonResponse(
        dependencies.res,
        LocalImageRouteStatusCodeByName.clientErrorNotFound,
        {
          ok: false,
          error: LocalImageRouteErrorByName.imageFileNotFound,
        },
      );
      return null;
    }

    return {
      size: fileMetadata.size,
    };
  } catch (error) {
    const parsedFileSystemError = FileSystemErrorSchema.safeParse(error);
    if (isMissingFileSystemError(parsedFileSystemError)) {
      dependencies.jsonResponse(
        dependencies.res,
        LocalImageRouteStatusCodeByName.clientErrorNotFound,
        {
          ok: false,
          error: LocalImageRouteErrorByName.imageFileNotFound,
        },
      );
      return null;
    }
    if (isForbiddenFileSystemError(parsedFileSystemError)) {
      dependencies.jsonResponse(
        dependencies.res,
        LocalImageRouteStatusCodeByName.clientErrorForbidden,
        {
          ok: false,
          error: LocalImageRouteErrorByName.imageFileAccessDenied,
        },
      );
      return null;
    }

    dependencies.jsonResponse(
      dependencies.res,
      LocalImageRouteStatusCodeByName.serverErrorInternal,
      {
        ok: false,
        error: LocalImageRouteErrorByName.imageFileStatFailed,
      },
    );
    return null;
  }
}

async function streamImageFile(
  response: ServerResponse,
  imagePath: string,
  contentType: string,
  dependencies: LocalImageRouteDependencies,
): Promise<void> {
  let fileHandle: fileSystemPromises.FileHandle | null = null;

  try {
    const openFile = dependencies.openFile ?? fileSystemPromises.open;
    fileHandle = await openFile(imagePath, "r");
    response.writeHead(LocalImageRouteStatusCodeByName.successOk, {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    });
    const readStream = fileHandle.createReadStream({ autoClose: false });
    const closePromise = new Promise<"closed">((resolve) => {
      response.once("close", () => {
        readStream.destroy();
        resolve("closed");
      });
    });
    const pipelinePromise = pipeline(readStream, response);
    const streamResult = await Promise.race([
      pipelinePromise.then(() => "completed" as const),
      closePromise,
    ]);
    if (streamResult === "closed") {
      await pipelinePromise.catch(() => undefined);
      return;
    }
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }

    const parsedFileSystemError = FileSystemErrorSchema.safeParse(error);
    if (isMissingFileSystemError(parsedFileSystemError)) {
      dependencies.jsonResponse(response, LocalImageRouteStatusCodeByName.clientErrorNotFound, {
        ok: false,
        error: LocalImageRouteErrorByName.imageFileNotFound,
      });
      return;
    }

    if (isForbiddenFileSystemError(parsedFileSystemError)) {
      dependencies.jsonResponse(response, LocalImageRouteStatusCodeByName.clientErrorForbidden, {
        ok: false,
        error: LocalImageRouteErrorByName.imageFileAccessDenied,
      });
      return;
    }

    dependencies.jsonResponse(response, LocalImageRouteStatusCodeByName.serverErrorInternal, {
      ok: false,
      error: LocalImageRouteErrorByName.imageFileReadFailed,
    });
  } finally {
    if (fileHandle !== null) {
      await fileHandle.close().catch(() => undefined);
    }
  }
}

function isMissingFileSystemError(parsedFileSystemError: ParsedFileSystemError): boolean {
  return (
    parsedFileSystemError.success &&
    (parsedFileSystemError.data.code === "ENOENT" || parsedFileSystemError.data.code === "ENOTDIR")
  );
}

function isForbiddenFileSystemError(parsedFileSystemError: ParsedFileSystemError): boolean {
  return (
    parsedFileSystemError.success &&
    (parsedFileSystemError.data.code === "EACCES" || parsedFileSystemError.data.code === "EPERM")
  );
}
