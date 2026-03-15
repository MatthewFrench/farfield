import { defineConfig, devices } from "@playwright/test";
import { resolveRealEndToEndPlaywrightOutputDirectory } from "./end-to-end/real/helpers/output-profile";

const baseURL = (process.env["E2E_REAL_BASE_URL"] ?? "http://127.0.0.1:4322").trim();
const outputDirectory = resolveRealEndToEndPlaywrightOutputDirectory(
  "test-results",
  "real-app-webkit",
);
const reportDirectory = resolveRealEndToEndPlaywrightOutputDirectory(
  "playwright-report",
  "real-app-webkit",
);

export default defineConfig({
  testDir: "./end-to-end/real/scenarios",
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  outputDir: outputDirectory,
  reporter: [["list"], ["html", { outputFolder: reportDirectory, open: "never" }]],
  use: {
    ...devices["iPhone 13"],
    browserName: "webkit",
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
