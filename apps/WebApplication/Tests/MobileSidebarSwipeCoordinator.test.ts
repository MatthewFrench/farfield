import { describe, expect, it } from "vitest";
import { MobileSidebarSwipeCoordinator } from "../Source/Application/StateManagement/MobileSidebarSwipeCoordinator";

function createCoordinator(): MobileSidebarSwipeCoordinator {
  return new MobileSidebarSwipeCoordinator({
    mobileLayoutMaximumWidthPx: 768,
    sidebarSwipeEdgePx: 32,
    sidebarSwipeTriggerPx: 56,
    sidebarSwipeMaximumVerticalDriftPx: 36,
    sidebarSwipeCancelNegativePx: -14,
  });
}

describe("MobileSidebarSwipeCoordinator", () => {
  it("does not start tracking when sidebar is already open", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: true,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 10,
      touchClientY: 10,
      safeAreaInsetLeftPx: 0,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 90,
      touchClientY: 10,
    });

    expect(output.shouldOpenSidebar).toBe(false);
    expect(output.reason).toBe("not-tracking");
  });

  it("does not start tracking when touch starts outside edge threshold", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 80,
      touchClientY: 10,
      safeAreaInsetLeftPx: 0,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 160,
      touchClientY: 10,
    });

    expect(output.shouldOpenSidebar).toBe(false);
    expect(output.reason).toBe("not-tracking");
  });

  it("does not start tracking when viewport width is outside mobile layout range", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 900,
      touchCount: 1,
      touchClientX: 8,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 90,
      touchClientY: 12,
    });

    expect(output.shouldOpenSidebar).toBe(false);
    expect(output.reason).toBe("not-tracking");
  });

  it("allows edge tracking when touch starts exactly on safe-area-adjusted edge threshold", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 42,
      touchClientY: 12,
      safeAreaInsetLeftPx: 10,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 104,
      touchClientY: 18,
    });

    expect(output.shouldOpenSidebar).toBe(true);
    expect(output.reason).toBe("trigger-reached");
  });

  it("opens sidebar when horizontal swipe crosses trigger within drift budget", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 8,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 70,
      touchClientY: 18,
    });

    expect(output.shouldOpenSidebar).toBe(true);
    expect(output.reason).toBe("trigger-reached");
  });

  it("cancels tracking when vertical drift exceeds budget", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 8,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 20,
      touchClientY: 80,
    });

    expect(output.shouldOpenSidebar).toBe(false);
    expect(output.reason).toBe("vertical-drift-cancelled");
  });

  it("cancels tracking when swipe moves left past cancel threshold", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 30,
      touchClientY: 30,
      safeAreaInsetLeftPx: 0,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 10,
      touchClientY: 32,
    });

    expect(output.shouldOpenSidebar).toBe(false);
    expect(output.reason).toBe("negative-horizontal-cancelled");
  });

  it("cancels tracking when touch count changes and keeps gesture closed until a new begin call", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 8,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0,
    });

    const firstOutput = coordinator.continueTracking({
      touchCount: 2,
      touchClientX: 40,
      touchClientY: 14,
    });
    expect(firstOutput.shouldOpenSidebar).toBe(false);
    expect(firstOutput.reason).toBe("touch-count-mismatch");

    const secondOutput = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 90,
      touchClientY: 14,
    });
    expect(secondOutput.shouldOpenSidebar).toBe(false);
    expect(secondOutput.reason).toBe("not-tracking");
  });

  it("resets tracking origin when beginTracking is called again before gesture completion", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 8,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0,
    });

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 20,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0,
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 70,
      touchClientY: 20,
    });

    expect(output.shouldOpenSidebar).toBe(false);
    expect(output.reason).toBe("tracking-in-progress");
  });
});
