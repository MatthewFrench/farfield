import { describe, expect, it } from "vitest";
import { MobileSidebarSwipeCoordinator } from "../Source/Application/StateManagement/MobileSidebarSwipeCoordinator";

function createCoordinator(): MobileSidebarSwipeCoordinator {
  return new MobileSidebarSwipeCoordinator({
    mobileLayoutMaximumWidthPx: 768,
    sidebarSwipeEdgePx: 32,
    sidebarSwipeTriggerPx: 56,
    sidebarSwipeMaximumVerticalDriftPx: 36,
    sidebarSwipeCancelNegativePx: -14
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
      safeAreaInsetLeftPx: 0
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 90,
      touchClientY: 10
    });

    expect(output.shouldOpenSidebar).toBe(false);
  });

  it("does not start tracking when touch starts outside edge threshold", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 80,
      touchClientY: 10,
      safeAreaInsetLeftPx: 0
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 160,
      touchClientY: 10
    });

    expect(output.shouldOpenSidebar).toBe(false);
  });

  it("opens sidebar when horizontal swipe crosses trigger within drift budget", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 8,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 70,
      touchClientY: 18
    });

    expect(output.shouldOpenSidebar).toBe(true);
  });

  it("cancels tracking when vertical drift exceeds budget", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 8,
      touchClientY: 12,
      safeAreaInsetLeftPx: 0
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 20,
      touchClientY: 80
    });

    expect(output.shouldOpenSidebar).toBe(false);
  });

  it("cancels tracking when swipe moves left past cancel threshold", () => {
    const coordinator = createCoordinator();

    coordinator.beginTracking({
      mobileSidebarOpen: false,
      viewportWidthPx: 390,
      touchCount: 1,
      touchClientX: 30,
      touchClientY: 30,
      safeAreaInsetLeftPx: 0
    });

    const output = coordinator.continueTracking({
      touchCount: 1,
      touchClientX: 10,
      touchClientY: 32
    });

    expect(output.shouldOpenSidebar).toBe(false);
  });
});
