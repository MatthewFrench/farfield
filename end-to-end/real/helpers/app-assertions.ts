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
  const readVisibleState = async (): Promise<string> => {
    const stateLocators = page.getByTestId(testId);
    const count = await stateLocators.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = stateLocators.nth(index);
      if (await candidate.isVisible()) {
        return (await candidate.getAttribute("data-state")) ?? "";
      }
    }
    return "__hidden__";
  };

  try {
    await expect
      .poll(readVisibleState, {
        timeout: timeoutMs,
        message: `${surface} did not become visible within ${String(timeoutMs)}ms`
      })
      .not.toBe("__hidden__");
    await expect
      .poll(readVisibleState, {
        timeout: timeoutMs,
        message: `${surface} did not settle within ${String(timeoutMs)}ms`
      })
      .not.toBe(disallowedState);
  } catch (error) {
    const observedState = await readVisibleState();
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
  const readVisibleState = async (): Promise<string> => {
    const stateLocators = page.getByTestId("chat-surface");
    const count = await stateLocators.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = stateLocators.nth(index);
      if (await candidate.isVisible()) {
        return (await candidate.getAttribute("data-state")) ?? "";
      }
    }
    return "__hidden__";
  };

  try {
    await expect
      .poll(readVisibleState, {
        timeout: timeoutMs,
        message: `chat-surface did not become visible within ${String(timeoutMs)}ms`
      })
      .not.toBe("__hidden__");
    await expect
      .poll(async () => {
        const state = await readVisibleState();
        return state === "loading-threads" || state === "loading-thread";
      }, {
        timeout: timeoutMs,
        message: `chat-surface did not settle within ${String(timeoutMs)}ms`
      })
      .toBe(false);
  } catch (error) {
    const observedState = await readVisibleState();
    sentinel.recordLoadingTimeoutBreach({
      surface: "chat-surface",
      timeoutMs,
      observedState
    });
    throw error;
  }
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
