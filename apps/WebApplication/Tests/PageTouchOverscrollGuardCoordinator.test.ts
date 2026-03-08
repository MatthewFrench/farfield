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
      dispatchEvent: vi.fn(),
    })),
  });
}

function createTouchEvent(
  eventName: string,
  coordinates: { clientX: number; clientY: number },
): Event {
  const event = new Event(eventName, {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "touches", {
    configurable: true,
    value: [coordinates],
  });
  return event;
}

describe("PageTouchOverscrollGuardCoordinator", () => {
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    document.body.innerHTML = "";
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

    const cleanup = coordinator.install(applicationShellElement);

    const touchStartEvent = createTouchEvent("touchstart", {
      clientX: 12,
      clientY: 12,
    });
    applicationShellElement.dispatchEvent(touchStartEvent);

    const touchMoveEvent = createTouchEvent("touchmove", {
      clientX: 12,
      clientY: 44,
    });
    const preventDefaultSpy = vi.spyOn(touchMoveEvent, "preventDefault");
    applicationShellElement.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);

    cleanup();
  }, 15_000);

  it("allows vertical touch movement inside a scrollable ancestor away from edges", () => {
    installCoarsePointerSupport(true);
    const coordinator = new PageTouchOverscrollGuardCoordinator();
    const applicationShellElement = document.createElement("div");
    const scrollableElement = document.createElement("div");
    const innerElement = document.createElement("div");
    scrollableElement.style.overflowY = "auto";
    Object.defineProperty(scrollableElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(scrollableElement, "scrollHeight", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(scrollableElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 120,
    });
    scrollableElement.appendChild(innerElement);
    applicationShellElement.appendChild(scrollableElement);

    const cleanup = coordinator.install(applicationShellElement);

    innerElement.dispatchEvent(createTouchEvent("touchstart", { clientX: 16, clientY: 16 }));
    const touchMoveEvent = createTouchEvent("touchmove", {
      clientX: 16,
      clientY: 36,
    });
    const preventDefaultSpy = vi.spyOn(touchMoveEvent, "preventDefault");
    innerElement.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();

    cleanup();
  });

  it("preserves bottom-edge bounce inside a nested scrollable ancestor", () => {
    installCoarsePointerSupport(true);
    const coordinator = new PageTouchOverscrollGuardCoordinator();
    const applicationShellElement = document.createElement("div");
    const scrollableElement = document.createElement("div");
    const innerElement = document.createElement("div");
    scrollableElement.style.overflowY = "auto";
    Object.defineProperty(scrollableElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(scrollableElement, "scrollHeight", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(scrollableElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 200,
    });
    scrollableElement.appendChild(innerElement);
    applicationShellElement.appendChild(scrollableElement);

    const cleanup = coordinator.install(applicationShellElement);

    innerElement.dispatchEvent(createTouchEvent("touchstart", { clientX: 16, clientY: 48 }));
    const touchMoveEvent = createTouchEvent("touchmove", {
      clientX: 16,
      clientY: 20,
    });
    const preventDefaultSpy = vi.spyOn(touchMoveEvent, "preventDefault");
    innerElement.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();

    cleanup();
  });

  it("still blocks edge overscroll when the application shell is the active scroll container", () => {
    installCoarsePointerSupport(true);
    const coordinator = new PageTouchOverscrollGuardCoordinator();
    const applicationShellElement = document.createElement("div");
    applicationShellElement.style.overflowY = "auto";
    Object.defineProperty(applicationShellElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(applicationShellElement, "scrollHeight", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(applicationShellElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 200,
    });

    const cleanup = coordinator.install(applicationShellElement);

    applicationShellElement.dispatchEvent(
      createTouchEvent("touchstart", { clientX: 16, clientY: 48 }),
    );
    const touchMoveEvent = createTouchEvent("touchmove", {
      clientX: 16,
      clientY: 20,
    });
    const preventDefaultSpy = vi.spyOn(touchMoveEvent, "preventDefault");
    applicationShellElement.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
