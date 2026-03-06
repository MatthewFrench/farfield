import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env["E2E_REAL_BASE_URL"] ?? "http://127.0.0.1:4312").trim();

export default defineConfig({
  testDir: "./end-to-end/real/scenarios",
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  outputDir: "test-results/real-app-webkit",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/real-app-webkit", open: "never" }],
  ],
  use: {
    ...devices["iPhone 13"],
    browserName: "webkit",
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
