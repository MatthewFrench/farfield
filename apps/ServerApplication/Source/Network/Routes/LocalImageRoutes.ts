import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, isAbsolute } from "node:path";
import { z } from "zod";
import type { ThreadRouteDependencies } from "./ThreadRoutes.js";

const LOCAL_IMAGE_ROUTE_PATH = "/api/files/local-image";
const LOCAL_IMAGE_QUERY_PATH_KEY = "path";
const MAXIMUM_LOCAL_IMAGE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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
  imageFileNotFound: "Image file not found",
  imageFileAccessDenied: "Image file access denied",
  unsupportedImageType: "Unsupported image type",
  imageFileTooLarge: "Image file is too large",
  imageFileStatFailed: "Failed to read image file metadata",
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

interface LocalImageRouteDependencies {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  url: URL;
  jsonResponse: ThreadRouteDependencies["jsonResponse"];
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

  const contentType = readImageContentType(imagePath);
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

  const fileMetadata = await readImageFileMetadata(imagePath, dependencies);
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
  response.statusCode = LocalImageRouteStatusCodeByName.successOk;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "private, max-age=60");
  response.setHeader("X-Content-Type-Options", "nosniff");
  createReadStream(imagePath).pipe(response);
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

async function readImageFileMetadata(
  imagePath: string,
  dependencies: LocalImageRouteDependencies,
): Promise<{ size: number } | null> {
  try {
    const fileMetadata = await stat(imagePath);
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
    if (parsedFileSystemError.success) {
      const errorCode = parsedFileSystemError.data.code;
      if (errorCode === "ENOENT" || errorCode === "ENOTDIR") {
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
      if (errorCode === "EACCES" || errorCode === "EPERM") {
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
