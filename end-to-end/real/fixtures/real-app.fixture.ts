import { test as base, expect } from "@playwright/test";
import { createErrorSentinel, type ErrorSentinel } from "../helpers/error-sentinel";
import { RealAppStateIsolationGuard } from "../helpers/state-isolation";

export type RealAppFixtures = {
  sentinel: ErrorSentinel;
  stateGuard: RealAppStateIsolationGuard;
  enforceStateIsolation: boolean;
  enforceRuntimeAvailabilityCheck: boolean;
  enforceDebugErrorEndpointReads: boolean;
  enforceUnexpectedSignals: boolean;
};

const DEFAULT_REAL_API_URL = "http://127.0.0.1:4321";
const DEFAULT_REAL_BASE_URL = "http://127.0.0.1:4322";
const STABLE_REAL_API_URL = "http://127.0.0.1:4311";
const STABLE_REAL_BASE_URL = "http://127.0.0.1:4312";

function readRealApiBaseUrl(): string {
  const explicitApiBaseUrl = (process.env["E2E_REAL_API_URL"] ?? "").trim();
  if (explicitApiBaseUrl.length > 0) {
    return explicitApiBaseUrl;
  }

  const realBaseUrl = (process.env["E2E_REAL_BASE_URL"] ?? DEFAULT_REAL_BASE_URL).trim();
  if (realBaseUrl === STABLE_REAL_BASE_URL) {
    return STABLE_REAL_API_URL;
  }

  return DEFAULT_REAL_API_URL;
}

export const test = base.extend<RealAppFixtures>({
  enforceStateIsolation: [true, { option: true }],
  enforceRuntimeAvailabilityCheck: [true, { option: true }],
  enforceDebugErrorEndpointReads: [true, { option: true }],
  enforceUnexpectedSignals: [true, { option: true }],
  stateGuard: [
    async ({ page, playwright, enforceStateIsolation }, use) => {
      const apiBaseUrl = readRealApiBaseUrl();
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
        extraHTTPHeaders: requestHeaders,
      });
      const stateGuard = new RealAppStateIsolationGuard({
        page,
        request,
      });
      if (enforceStateIsolation) {
        await stateGuard.initialize();
      }

      try {
        await use(stateGuard);
      } finally {
        if (enforceStateIsolation) {
          await stateGuard.dispose();
          stateGuard.assertNoViolations();
        }
        await request.dispose();
      }
    },
    { auto: true },
  ],
  sentinel: async (
    {
      page,
      playwright,
      enforceRuntimeAvailabilityCheck,
      enforceDebugErrorEndpointReads,
      enforceUnexpectedSignals,
    },
    use,
    testInfo,
  ) => {
    const scenarioId = testInfo.titlePath.join(" :: ");
    const apiBaseUrl = readRealApiBaseUrl();
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
      extraHTTPHeaders: requestHeaders,
    });
    const sentinel = await createErrorSentinel({
      page,
      request,
      testInfo,
      scenarioId,
      enforceRuntimeAvailabilityCheck,
      enforceDebugErrorEndpointReads,
    });

    let runtimeError: Error | null = null;
    try {
      await use(sentinel);

      const shouldAssertUnexpectedSignals =
        enforceUnexpectedSignals && testInfo.status === "passed";
      if (shouldAssertUnexpectedSignals) {
        await sentinel.assertNoUnexpectedSignals();
      }
    } catch (error) {
      runtimeError = error instanceof Error ? error : new Error(String(error));
    } finally {
      await sentinel.writeSummary();
      await sentinel.dispose();
      await request.dispose();
    }

    if (runtimeError !== null) {
      throw runtimeError;
    }
  },
});

export { expect };
