import { expect, type Page } from "@playwright/test";
import type { ErrorSentinel } from "./error-sentinel";

interface SettleOptions {
  timeoutMs?: number;
}

const DEFAULT_SETTLE_TIMEOUT_MS = 90_000;

async function waitForState(
  page: Page,
  testId: string,
  disallowedState: string,
  surface: string,
  sentinel: ErrorSentinel,
  timeoutMs: number
): Promise<void> {
  const stateLocator = page.getByTestId(testId);
  await expect(stateLocator).toBeVisible({ timeout: timeoutMs });

  try {
    await expect
      .poll(async () => (await stateLocator.getAttribute("data-state")) ?? "", {
        timeout: timeoutMs,
        message: `${surface} did not settle within ${String(timeoutMs)}ms`
      })
      .not.toBe(disallowedState);
  } catch (error) {
    const observedState = (await stateLocator.getAttribute("data-state")) ?? "missing";
    sentinel.recordLoadingTimeoutBreach({
      surface,
      timeoutMs,
      observedState
    });
    throw error;
  }
}

export async function expectNoErrorBanner(page: Page): Promise<void> {
  await expect(page.getByTestId("error-banner")).toHaveCount(0);
}

export async function expectNoLoadFailedText(page: Page): Promise<void> {
  await expect(page.getByText("Load failed", { exact: false })).toHaveCount(0);
}

export async function expectThreadListSettled(
  page: Page,
  sentinel: ErrorSentinel,
  options?: SettleOptions
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
  await waitForState(page, "thread-list-status", "loading", "thread-list", sentinel, timeoutMs);
}

export async function expectChatSurfaceSettled(
  page: Page,
  sentinel: ErrorSentinel,
  options?: SettleOptions
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS;
  await waitForState(page, "chat-surface", "loading-threads", "chat-surface", sentinel, timeoutMs);
}

export async function expectNoUnexpectedClientErrors(sentinel: ErrorSentinel): Promise<void> {
  await sentinel.assertNoUnexpectedClientErrors();
}

export async function expectNoFailedApiResponses(sentinel: ErrorSentinel): Promise<void> {
  await sentinel.assertNoFailedApiResponses();
}

export async function expectNoUnexpectedWarningsOrErrors(sentinel: ErrorSentinel): Promise<void> {
  await sentinel.assertNoUnexpectedWarningsOrErrors();
}
