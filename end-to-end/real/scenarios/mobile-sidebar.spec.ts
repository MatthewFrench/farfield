import { type Page } from "@playwright/test";
import { openAppHome } from "../helpers/app-actions";
import {
  expectChatSurfaceSettled,
  expectNoFailedApiResponses,
  expectNoUnexpectedClientErrors,
  expectNoUnexpectedWarningsOrErrors,
  expectThreadListSettled,
} from "../helpers/app-assertions";
import { expect, test } from "../fixtures/real-app.fixture";

async function dispatchSidebarTouchEvent(
  page: Page,
  type: "touchstart" | "touchmove" | "touchend",
  touches: Array<{ clientX: number; clientY: number }>,
): Promise<void> {
  await page.evaluate(
    ({ eventType, nextTouches }) => {
      const applicationShellElement = document.querySelector("[data-testid='app-shell']");
      if (!(applicationShellElement instanceof HTMLElement)) {
        throw new Error("App shell element not found");
      }

      const event = new Event(eventType, {
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(event, "touches", {
        configurable: true,
        value: nextTouches,
      });
      Object.defineProperty(event, "targetTouches", {
        configurable: true,
        value: nextTouches,
      });
      Object.defineProperty(event, "changedTouches", {
        configurable: true,
        value: nextTouches,
      });

      applicationShellElement.dispatchEvent(event);
    },
    { eventType: type, nextTouches: touches },
  );
}

test("mobile sidebar open and close behavior", async ({ page, sentinel }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await openAppHome(page);
  await expectChatSurfaceSettled(page, sentinel);
  const initialUrl = page.url();

  const openButton = page.getByTestId("sidebar-toggle-open").first();
  await expect(openButton).toBeVisible();

  await dispatchSidebarTouchEvent(page, "touchstart", [{ clientX: 8, clientY: 120 }]);
  await dispatchSidebarTouchEvent(page, "touchmove", [{ clientX: 92, clientY: 124 }]);
  await dispatchSidebarTouchEvent(page, "touchend", []);
  await expect(page).toHaveURL(initialUrl);
  await expect(page.getByTestId("sidebar-mobile")).toBeVisible();
  await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();
  await expectThreadListSettled(page, sentinel);

  await page.getByTestId("sidebar-backdrop").click({
    position: { x: 360, y: 120 },
  });
  await expect(page.getByTestId("sidebar-mobile")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("sidebar-backdrop")).toHaveClass(/opacity-0/);

  await openButton.click();
  await expect(page.getByTestId("sidebar-mobile")).toBeVisible();
  await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();
  await expectThreadListSettled(page, sentinel);

  const sidebarMobile = page.getByTestId("sidebar-mobile");
  await sidebarMobile.getByTestId("sidebar-toggle-close").click();
  await expect(sidebarMobile).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("sidebar-backdrop")).toHaveClass(/opacity-0/);

  await openButton.click();
  await expect(sidebarMobile).toBeVisible();
  await page.getByTestId("sidebar-backdrop").click({
    position: { x: 360, y: 120 },
  });
  await expect(sidebarMobile).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("sidebar-backdrop")).toHaveClass(/opacity-0/);

  await expectNoUnexpectedClientErrors(sentinel);
  await expectNoFailedApiResponses(sentinel);
  await expectNoUnexpectedWarningsOrErrors(sentinel);
});
