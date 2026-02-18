import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiToken = (process.env["API_TOKEN"] ?? process.env["PUSH_API_TOKEN"] ?? "").trim();

const apiProxyTarget =
  apiToken.length > 0
    ? {
        target: "http://127.0.0.1:4311",
        headers: {
          "X-Farfield-Token": apiToken
        }
      }
    : "http://127.0.0.1:4311";

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
    proxy: {
      "/api": apiProxyTarget,
      "/events": "http://127.0.0.1:4311"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: []
  }
});
