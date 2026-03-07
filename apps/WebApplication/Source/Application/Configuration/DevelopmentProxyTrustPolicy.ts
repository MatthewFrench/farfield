import { z } from "zod";

/**
 * Owns trusted-origin decisions for Vite dev-proxy API token injection.
 * Browser requests from the same served host are trusted, while originless requests remain
 * loopback-only so command-line traffic does not inherit protected API access by accident.
 */
const HTTP_PROTOCOL = "http:";
const HTTPS_PROTOCOL = "https:";
const DEVELOPMENT_PROXY_DEFAULT_TRUSTED_ORIGIN_VALUES = [
  "http://localhost:4312",
  "http://127.0.0.1:4312",
  "http://[::1]:4312",
] as const;
const LOOPBACK_REMOTE_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export interface DevelopmentProxyTrustDecisionInput {
  apiToken: string;
  originHeader: string | undefined;
  hostHeader: string | undefined;
  remoteAddress: string | undefined;
  trustedOrigins: ReadonlySet<string>;
}

function normalizeOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (parsed.protocol !== HTTP_PROTOCOL && parsed.protocol !== HTTPS_PROTOCOL) {
    throw new Error(`Unsupported origin protocol in VITE_DEV_PROXY_TRUSTED_ORIGINS: ${origin}`);
  }
  return `${parsed.protocol}//${parsed.host}`.toLowerCase();
}

function normalizeOriginHeader(origin: string): string | null {
  try {
    return normalizeOrigin(origin);
  } catch {
    return null;
  }
}

function buildSameHostTrustedOrigins(hostHeader: string | undefined): Set<string> {
  if (typeof hostHeader !== "string" || hostHeader.trim().length === 0) {
    return new Set<string>();
  }

  const normalizedHostHeader = hostHeader.trim();
  const sameHostOrigins = new Set<string>();
  for (const protocol of [HTTP_PROTOCOL, HTTPS_PROTOCOL]) {
    const normalizedOrigin = normalizeOriginHeader(`${protocol}//${normalizedHostHeader}`);
    if (normalizedOrigin !== null) {
      sameHostOrigins.add(normalizedOrigin);
    }
  }
  return sameHostOrigins;
}

export function parseTrustedDevelopmentProxyOrigins(
  rawOrigins: string | undefined,
): ReadonlySet<string> {
  if (!rawOrigins || rawOrigins.trim().length === 0) {
    return new Set(
      DEVELOPMENT_PROXY_DEFAULT_TRUSTED_ORIGIN_VALUES.map((origin) => normalizeOrigin(origin)),
    );
  }

  const parsedOrigins = rawOrigins
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => normalizeOrigin(value));

  if (parsedOrigins.length === 0) {
    throw new Error("VITE_DEV_PROXY_TRUSTED_ORIGINS must contain at least one origin when set");
  }
  return new Set(parsedOrigins);
}

export function shouldInjectApiTokenForDevelopmentProxy(
  input: DevelopmentProxyTrustDecisionInput,
): boolean {
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

  return buildSameHostTrustedOrigins(input.hostHeader).has(normalizedOrigin);
}

const DevelopmentProxyTrustedOriginSchema = z.string().trim().min(1);
export const DEFAULT_TRUSTED_DEVELOPMENT_PROXY_ORIGINS = new Set(
  DEVELOPMENT_PROXY_DEFAULT_TRUSTED_ORIGIN_VALUES.map((origin) =>
    DevelopmentProxyTrustedOriginSchema.parse(normalizeOrigin(origin)),
  ),
);
