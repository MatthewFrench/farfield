import path from "node:path";
import type { IncomingMessage } from "node:http";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { ProxyOptions } from "vite";

process.env["VITE_APP_BUILD_ID"] ??= "dev";
process.env["VITE_GIT_COMMIT"] ??= "dev";

const apiToken = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();

function normalizeOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
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

function parseTrustedDevProxyOrigins(rawOrigins: string | undefined): Set<string> {
  const builtIn = [
    "http://localhost:4312",
    "http://127.0.0.1:4312",
    "http://[::1]:4312"
  ];
  if (!rawOrigins || rawOrigins.trim().length === 0) {
    return new Set(builtIn.map((origin) => normalizeOrigin(origin)));
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

const trustedDevProxyOrigins = parseTrustedDevProxyOrigins(
  process.env["VITE_DEV_PROXY_TRUSTED_ORIGINS"]
);

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function shouldInjectApiToken(req: IncomingMessage): boolean {
  if (apiToken.length === 0) {
    return false;
  }

  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return false;
  }

  const originHeader = req.headers.origin;
  if (typeof originHeader !== "string") {
    return true;
  }

  const normalizedOrigin = normalizeOriginHeader(originHeader);
  if (!normalizedOrigin) {
    return false;
  }
  return trustedDevProxyOrigins.has(normalizedOrigin);
}

function createTokenAwareProxyTarget(): string | ProxyOptions {
  if (apiToken.length === 0) {
    return "http://127.0.0.1:4311";
  }

  return {
    target: "http://127.0.0.1:4311",
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq, req) => {
        if (!shouldInjectApiToken(req)) {
          return;
        }
        proxyReq.setHeader("X-Farfield-Token", apiToken);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: true,
    allowedHosts: true,
    port: 4312,
    strictPort: true,
    proxy: {
      "/api": createTokenAwareProxyTarget(),
      "/events": createTokenAwareProxyTarget(),
      "/healthz": "http://127.0.0.1:4311"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: []
  }
});
