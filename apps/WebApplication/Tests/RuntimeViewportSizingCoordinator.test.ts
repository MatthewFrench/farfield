import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeViewportSizingCoordinator } from "../Source/Application/StateManagement/RuntimeViewportSizingCoordinator";

const originalMatchMedia = window.matchMedia;
const originalVisualViewport = window.visualViewport;
const originalInnerHeight = window.innerHeight;

function installOrientation(landscape: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(orientation: landscape)" ? landscape : false,
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

function installVisualViewportHeight(height: number): void {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value: {
      height
    }
  });
}

function installInnerHeight(height: number): void {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height
  });
}

describe("RuntimeViewportSizingCoordinator", () => {
  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: originalVisualViewport
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: originalInnerHeight
    });
    document.documentElement.style.removeProperty("--app-height");
    document.documentElement.style.removeProperty("--composer-safe-bottom-inset");
    document.documentElement.style.removeProperty("--safe-area-inset-bottom-clamped");
    document.documentElement.style.removeProperty("--safe-area-inset-left");
  });

  it("applies runtime viewport metrics and css variables", () => {
    installOrientation(false);
    installInnerHeight(900);
    installVisualViewportHeight(900);
    document.documentElement.style.setProperty("--safe-area-inset-bottom-clamped", "16px");
    const coordinator = new RuntimeViewportSizingCoordinator(120);

    const metrics = coordinator.applyViewportSizingVariables();

    expect(metrics.orientation).toBe("portrait");
    expect(metrics.appHeight).toBe(900);
    expect(metrics.visualViewportHeight).toBe(900);
    expect(metrics.keyboardOpen).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--app-height")).toBe("900px");
    expect(document.documentElement.style.getPropertyValue("--composer-safe-bottom-inset")).toBe("16px");
  });

  it("uses baseline height to classify keyboard-open transitions", () => {
    installOrientation(false);
    installInnerHeight(900);
    installVisualViewportHeight(900);
    document.documentElement.style.setProperty("--safe-area-inset-bottom-clamped", "20px");
    const coordinator = new RuntimeViewportSizingCoordinator(120);

    const initialMetrics = coordinator.applyViewportSizingVariables();
    installVisualViewportHeight(730);
    const nextMetrics = coordinator.applyViewportSizingVariables();

    expect(initialMetrics.keyboardOpen).toBe(false);
    expect(nextMetrics.keyboardOpen).toBe(true);
    expect(nextMetrics.keyboardDelta).toBe(170);
    expect(document.documentElement.style.getPropertyValue("--composer-safe-bottom-inset")).toBe("0px");
  });

  it("reads safe area inset left and clears runtime css variables", () => {
    installOrientation(false);
    installInnerHeight(600);
    installVisualViewportHeight(600);
    document.documentElement.style.setProperty("--safe-area-inset-left", "18px");
    const coordinator = new RuntimeViewportSizingCoordinator(120);

    coordinator.applyViewportSizingVariables();
    expect(coordinator.readSafeAreaInsetLeftPx()).toBe(18);

    coordinator.clearViewportSizingVariables();
    expect(document.documentElement.style.getPropertyValue("--app-height")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--composer-safe-bottom-inset")).toBe("");
  });

  it("uses layout viewport height when visual viewport metrics are not finite", () => {
    installOrientation(false);
    installInnerHeight(640);
    installVisualViewportHeight(Number.NaN);
    const coordinator = new RuntimeViewportSizingCoordinator(120);

    const metrics = coordinator.applyViewportSizingVariables();

    expect(metrics.visualViewportHeight).toBe(640);
    expect(metrics.layoutViewportHeight).toBe(640);
    expect(metrics.appHeight).toBe(640);
    expect(metrics.keyboardOpen).toBe(false);
  });
});
