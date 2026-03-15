const LOCAL_IMAGE_ROUTE_PATH = "/api/files/local-image";
const FILE_PROTOCOL_PREFIX = "file://";
const HTTP_PROTOCOL_PREFIX = "http://";
const HTTPS_PROTOCOL_PREFIX = "https://";
const DATA_PROTOCOL_PREFIX = "data:";
const BLOB_PROTOCOL_PREFIX = "blob:";
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_FILE_URL_PATH_PATTERN = /^\/[A-Za-z]:\//;

function buildLocalImageRoutePath(localImagePath: string): string {
  const queryParameters = new URLSearchParams({
    path: localImagePath,
  });
  return `${LOCAL_IMAGE_ROUTE_PATH}?${queryParameters.toString()}`;
}

function isAbsoluteLocalImagePath(path: string): boolean {
  return path.startsWith("/") || WINDOWS_ABSOLUTE_PATH_PATTERN.test(path);
}

function isDirectBrowserImageSource(path: string): boolean {
  return (
    path.startsWith(HTTP_PROTOCOL_PREFIX) ||
    path.startsWith(HTTPS_PROTOCOL_PREFIX) ||
    path.startsWith(DATA_PROTOCOL_PREFIX) ||
    path.startsWith(BLOB_PROTOCOL_PREFIX)
  );
}

function normalizeFileUrlPathname(pathname: string): string {
  const decodedPathname = decodeURIComponent(pathname);
  if (WINDOWS_FILE_URL_PATH_PATTERN.test(decodedPathname)) {
    return decodedPathname.slice(1);
  }
  return decodedPathname;
}

function parseLocalPathFromFileUrl(path: string): string | null {
  try {
    const parsedFileUrl = new URL(path);
    if (parsedFileUrl.protocol !== "file:") {
      return null;
    }
    const normalizedPathname = normalizeFileUrlPathname(parsedFileUrl.pathname);
    if (!isAbsoluteLocalImagePath(normalizedPathname)) {
      return null;
    }
    return normalizedPathname;
  } catch {
    return null;
  }
}

/**
 * Converts local filesystem image paths from thread content into explicit API URLs.
 * Browser-owned image elements can only fetch HTTP(S)/data/blob sources directly.
 */
export function resolveLocalImageSourceForRender(path: string): string {
  if (path.length === 0) {
    return path;
  }

  if (isDirectBrowserImageSource(path)) {
    return path;
  }

  if (path.startsWith(FILE_PROTOCOL_PREFIX)) {
    const localPath = parseLocalPathFromFileUrl(path);
    if (localPath !== null) {
      return buildLocalImageRoutePath(localPath);
    }
    return path;
  }

  if (isAbsoluteLocalImagePath(path)) {
    return buildLocalImageRoutePath(path);
  }

  return path;
}
