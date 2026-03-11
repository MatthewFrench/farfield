import { z } from "zod";

const HTTP_PROTOCOL = "http:";
const HTTPS_PROTOCOL = "https:";
const LOOPBACK_REMOTE_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const TrustedOriginSchema = z.string().trim().min(1);

function normalizeOrigin(origin) {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== HTTP_PROTOCOL && parsedOrigin.protocol !== HTTPS_PROTOCOL) {
    throw new Error(`Unsupported origin protocol in VITE_DEV_PROXY_TRUSTED_ORIGINS: ${origin}`);
  }
  return `${parsedOrigin.protocol}//${parsedOrigin.host}`.toLowerCase();
}

function normalizeOriginHeader(origin) {
  try {
    return normalizeOrigin(origin);
  } catch {
    return null;
  }
}

export function buildStableDevelopmentDefaultTrustedOrigins(webPort) {
  return new Set(
    [
      `http://localhost:${String(webPort)}`,
      `http://127.0.0.1:${String(webPort)}`,
      `http://[::1]:${String(webPort)}`,
    ].map((origin) => TrustedOriginSchema.parse(normalizeOrigin(origin))),
  );
}

export function parseStableDevelopmentTrustedOrigins(rawOrigins, webPort) {
  if (typeof rawOrigins !== "string" || rawOrigins.trim().length === 0) {
    return buildStableDevelopmentDefaultTrustedOrigins(webPort);
  }

  const parsedOrigins = rawOrigins
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => TrustedOriginSchema.parse(normalizeOrigin(value)));

  if (parsedOrigins.length === 0) {
    throw new Error("VITE_DEV_PROXY_TRUSTED_ORIGINS must contain at least one origin when set");
  }

  return new Set(parsedOrigins);
}

export function shouldInjectApiTokenForStableDevelopmentProxy(input) {
  if (input.apiToken.trim().length === 0) {
    return false;
  }

  if (typeof input.originHeader !== "string") {
    return LOOPBACK_REMOTE_ADDRESSES.has(input.remoteAddress ?? "");
  }

  const normalizedOrigin = normalizeOriginHeader(input.originHeader);
  if (normalizedOrigin === null) {
    return false;
  }

  if (input.trustedOrigins.has(normalizedOrigin)) {
    return true;
  }

  return false;
}
