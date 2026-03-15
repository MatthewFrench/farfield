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

const apiPort = (process.env["FARFIELD_API_PORT"] ?? "4311").trim();
const webPort = Number(process.env["FARFIELD_WEB_PORT"] ?? "4312");
const apiToken = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();
const trustedDevProxyOrigins = parseTrustedDevelopmentProxyOrigins(
  process.env["VITE_DEV_PROXY_TRUSTED_ORIGINS"],
  webPort,
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
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  if (apiToken.length === 0) {
    return apiBaseUrl;
  }

  return {
    target: apiBaseUrl,
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
    conditions: ["farfield-source"],
  },
  server: {
    host: true,
    allowedHosts: true,
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": createTokenAwareProxyTarget(),
      "/events": createTokenAwareProxyTarget(),
      "/healthz": `http://127.0.0.1:${apiPort}`,
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
