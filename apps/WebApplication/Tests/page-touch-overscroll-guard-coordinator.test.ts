import { afterEach, describe, expect, it, vi } from "vitest";
import { PageTouchOverscrollGuardCoordinator } from "../Source/Application/StateManagement/PageTouchOverscrollGuardCoordinator";

const originalMatchMedia = window.matchMedia;

function installCoarsePointerSupport(enabled: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(pointer: coarse)" ? enabled : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

function createTouchEvent(
  eventName: string,
  coordinates: { clientX: number; clientY: number }
): Event {
  const event = new Event(eventName, {
    bubbles: true,
    cancelable: true
  });
  Object.defineProperty(event, "touches", {
    configurable: true,
    value: [coordinates]
  });
  return event;
}

describe("PageTouchOverscrollGuardCoordinator", () => {
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    });
  });

  it("does not install touch listeners when pointer is not coarse", () => {
    installCoarsePointerSupport(false);
    const coordinator = new PageTouchOverscrollGuardCoordinator();
    const applicationShellElement = document.createElement("div");
    const addEventListenerSpy = vi.spyOn(applicationShellElement, "addEventListener");

    const cleanup = coordinator.install(applicationShellElement);

    expect(addEventListenerSpy).not.toHaveBeenCalled();
    cleanup();
  });

  it("prevents vertical overscroll when there is no scrollable ancestor", () => {
    installCoarsePointerSupport(true);
    const coordinator = new PageTouchOverscrollGuardCoordinator();
    const applicationShellElement = document.createElement("div");
    const innerElement = document.createElement("div");
    applicationShellElement.appendChild(innerElement);
    document.body.appendChild(applicationShellElement);

    const cleanup = coordinator.install(applicationShellElement);

    const touchStartEvent = createTouchEvent("touchstart", {
      clientX: 12,
      clientY: 12
    });
    innerElement.dispatchEvent(touchStartEvent);

    const touchMoveEvent = createTouchEvent("touchmove", {
      clientX: 12,
      clientY: 44
    });
    const preventDefaultSpy = vi.spyOn(touchMoveEvent, "preventDefault");
    innerElement.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);

    cleanup();
    applicationShellElement.remove();
  });
});
