import type { IncomingMessage } from "node:http";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { ProxyOptions } from "vite";
import { defineConfig } from "vitest/config";
import {
  parseTrustedDevelopmentProxyOrigins,
  shouldInjectApiTokenForDevelopmentProxy,
} from "./Source/Application/Configuration/DevelopmentProxyTrustPolicy";

process.env["VITE_APP_BUILD_ID"] ??= "dev";
process.env["VITE_GIT_COMMIT"] ??= "dev";

const apiToken = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();
const trustedDevProxyOrigins = parseTrustedDevelopmentProxyOrigins(
  process.env["VITE_DEV_PROXY_TRUSTED_ORIGINS"],
);

function shouldInjectApiToken(req: IncomingMessage): boolean {
  return shouldInjectApiTokenForDevelopmentProxy({
    apiToken,
    originHeader: typeof req.headers.origin === "string" ? req.headers.origin : undefined,
    hostHeader: typeof req.headers.host === "string" ? req.headers.host : undefined,
    remoteAddress: req.socket.remoteAddress,
    trustedOrigins: trustedDevProxyOrigins,
  });
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
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./Source"),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    port: 4312,
    strictPort: true,
    proxy: {
      "/api": createTokenAwareProxyTarget(),
      "/events": createTokenAwareProxyTarget(),
      "/healthz": "http://127.0.0.1:4311",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/dist/**",
        "**/Tests/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "Source/Main.tsx",
        "vite.config.ts",
      ],
      thresholds: {
        branches: 75,
        functions: 65,
        lines: 70,
        statements: 70,
      },
    },
  },
});
