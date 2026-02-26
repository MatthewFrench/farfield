const QUERY_SEPARATOR = "?";
const HASH_SEPARATOR = "#";
const ABSOLUTE_URL_PROTOCOL_SEPARATOR = "://";

/**
 * Owns request method/path literals and path normalization used by request-routing and
 * request-observability owners so both layers classify paths with the same contract.
 */
export const REQUEST_PATH_SEGMENT_SEPARATOR = "/";

export const RequestMethodByName = {
  get: "GET",
  post: "POST",
  options: "OPTIONS",
  unknown: "UNKNOWN"
} as const;

export const RequestPathnameByName = {
  root: "/",
  missingRequestUrl: "/missing-url",
  malformedRequestUrl: "/malformed-request-url",
  healthCheck: "/healthz",
  events: "/events",
  apiPrefix: "/api/",
  apiHealth: "/api/health",
  apiEventsSession: "/api/events/session"
} as const;

export const RequestPathSegmentByName = {
  api: "api",
  threads: "threads",
  debug: "debug",
  history: "history",
  clientErrors: "client-errors",
  sessionLog: "session-log",
  trace: "trace",
  download: "download"
} as const;

/**
 * Request method normalization is owned here so handlers and observability use the same method label policy.
 */
export function normalizeRequestMethodForRequestMetrics(method: string | undefined): string {
  if (method === undefined) {
    return RequestMethodByName.unknown;
  }

  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod.length === 0) {
    return RequestMethodByName.unknown;
  }

  return normalizedMethod;
}

export function normalizePathnameForRequestMetrics(pathnameOrRequestUrl: string): string {
  const trimmedValue = pathnameOrRequestUrl.trim();
  if (trimmedValue.length === 0) {
    return RequestPathnameByName.root;
  }

  const absoluteUrlPathnameResolution = readPathnameFromAbsoluteUrl(trimmedValue);
  if (
    absoluteUrlPathnameResolution.isAbsoluteUrl
    && absoluteUrlPathnameResolution.pathname === null
  ) {
    return RequestPathnameByName.malformedRequestUrl;
  }
  const pathnameCandidate = absoluteUrlPathnameResolution.pathname ?? trimmedValue;
  const pathnameWithoutSuffix = stripPathnameSuffix(pathnameCandidate);
  if (pathnameWithoutSuffix.length === 0) {
    return RequestPathnameByName.root;
  }

  if (pathnameWithoutSuffix.startsWith(REQUEST_PATH_SEGMENT_SEPARATOR)) {
    return pathnameWithoutSuffix;
  }

  return `${REQUEST_PATH_SEGMENT_SEPARATOR}${pathnameWithoutSuffix}`;
}

export function readPathnameForRequestMetricsFromRequestUrl(
  requestUrl: string | undefined
): string {
  if (typeof requestUrl !== "string") {
    return RequestPathnameByName.missingRequestUrl;
  }
  return normalizePathnameForRequestMetrics(requestUrl);
}

export function readPathSegmentsFromPathname(pathname: string): string[] {
  const normalizedPathname = normalizePathnameForRequestMetrics(pathname);
  if (normalizedPathname === RequestPathnameByName.root) {
    return [];
  }

  return normalizedPathname
    .split(REQUEST_PATH_SEGMENT_SEPARATOR)
    .filter((segment) => segment.length > 0);
}

function stripPathnameSuffix(pathname: string): string {
  const querySeparatorIndex = pathname.indexOf(QUERY_SEPARATOR);
  const hashSeparatorIndex = pathname.indexOf(HASH_SEPARATOR);

  let suffixStartIndex = pathname.length;
  if (querySeparatorIndex >= 0) {
    suffixStartIndex = Math.min(suffixStartIndex, querySeparatorIndex);
  }
  if (hashSeparatorIndex >= 0) {
    suffixStartIndex = Math.min(suffixStartIndex, hashSeparatorIndex);
  }

  return pathname.slice(0, suffixStartIndex).trim();
}

interface AbsoluteUrlPathnameResolution {
  isAbsoluteUrl: boolean;
  pathname: string | null;
}

function readPathnameFromAbsoluteUrl(urlValue: string): AbsoluteUrlPathnameResolution {
  if (!urlValue.includes(ABSOLUTE_URL_PROTOCOL_SEPARATOR)) {
    return {
      isAbsoluteUrl: false,
      pathname: null
    };
  }

  try {
    return {
      isAbsoluteUrl: true,
      pathname: new URL(urlValue).pathname
    };
  } catch {
    return {
      isAbsoluteUrl: true,
      pathname: null
    };
  }
}
