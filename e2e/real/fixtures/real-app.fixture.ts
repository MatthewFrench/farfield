import { test as base, expect } from "@playwright/test";
import {
  createErrorSentinel,
  type ErrorSentinel
} from "../helpers/error-sentinel";

export type RealAppFixtures = {
  sentinel: ErrorSentinel;
};

export const test = base.extend<RealAppFixtures>({
  sentinel: async ({ page, playwright }, use, testInfo) => {
    const scenarioId = testInfo.titlePath.join(" :: ");
    const apiBaseUrl = (process.env["E2E_REAL_API_URL"] ?? "http://127.0.0.1:4311").trim();
    const apiToken = (
      process.env["E2E_REAL_API_TOKEN"] ??
      process.env["API_TOKEN"] ??
      process.env["APP_SMOKE_TOKEN"] ??
      process.env["PUSH_API_TOKEN"] ??
      ""
    ).trim();
    const requestHeaders = apiToken.length > 0 ? { "X-Farfield-Token": apiToken } : {};
    const request = await playwright.request.newContext({
      baseURL: apiBaseUrl,
      extraHTTPHeaders: requestHeaders
    });
    const sentinel = await createErrorSentinel({
      page,
      request,
      testInfo,
      scenarioId
    });

    try {
      await use(sentinel);
    } finally {
      await sentinel.writeSummary();
      await sentinel.dispose();
      await request.dispose();
    }
  }
});

export { expect };
