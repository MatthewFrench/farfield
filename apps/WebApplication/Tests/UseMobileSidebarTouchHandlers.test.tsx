import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BeginMobileSidebarSwipeTrackingInput,
  type ContinueMobileSidebarSwipeTrackingInput,
  type ContinueMobileSidebarSwipeTrackingOutput,
  MobileSidebarSwipeCoordinator,
} from "../Source/Application/StateManagement/MobileSidebarSwipeCoordinator";
import { RuntimeViewportSizingCoordinator } from "../Source/Application/StateManagement/RuntimeViewportSizingCoordinator";
import { useMobileSidebarTouchHandlers } from "../Source/Application/StateManagement/UseMobileSidebarTouchHandlers";

interface TouchHandlersHarnessProperties {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  mobileSidebarSwipeCoordinator: MobileSidebarSwipeCoordinator;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
}

class TestMobileSidebarSwipeCoordinator extends MobileSidebarSwipeCoordinator {
  public beginTrackingCalls: BeginMobileSidebarSwipeTrackingInput[] = [];
  public continueTrackingCalls: ContinueMobileSidebarSwipeTrackingInput[] = [];
  public endTrackingCallCount = 0;
  private nextContinueTrackingOutput: ContinueMobileSidebarSwipeTrackingOutput;

  public constructor() {
    super({
      mobileLayoutMaximumWidthPx: 768,
      sidebarSwipeEdgePx: 32,
      sidebarSwipeTriggerPx: 56,
      sidebarSwipeMaximumVerticalDriftPx: 36,
      sidebarSwipeCancelNegativePx: -14,
    });
    this.nextContinueTrackingOutput = { shouldOpenSidebar: false };
  }

  public setNextContinueTrackingOutput(output: ContinueMobileSidebarSwipeTrackingOutput): void {
    this.nextContinueTrackingOutput = output;
  }

  public override beginTracking(input: BeginMobileSidebarSwipeTrackingInput): void {
    this.beginTrackingCalls.push(input);
  }

  public override continueTracking(
    input: ContinueMobileSidebarSwipeTrackingInput,
  ): ContinueMobileSidebarSwipeTrackingOutput {
    this.continueTrackingCalls.push(input);
    return this.nextContinueTrackingOutput;
  }

  public override endTracking(): void {
    this.endTrackingCallCount += 1;
  }
}

function TouchHandlersHarness(properties: TouchHandlersHarnessProperties): React.JSX.Element {
  const touchHandlers = useMobileSidebarTouchHandlers({
    mobileSidebarOpen: properties.mobileSidebarOpen,
    setMobileSidebarOpen: properties.setMobileSidebarOpen,
    mobileSidebarSwipeCoordinator: properties.mobileSidebarSwipeCoordinator,
    runtimeViewportSizingCoordinator: properties.runtimeViewportSizingCoordinator,
  });

  return (
    <div
      data-testid="touch-shell"
      onTouchEnd={touchHandlers.endSidebarSwipeTracking}
      onTouchMove={touchHandlers.handleAppShellTouchMove}
      onTouchStart={touchHandlers.handleAppShellTouchStart}
    />
  );
}

const originalInnerWidth = window.innerWidth;

describe("useMobileSidebarTouchHandlers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it("forwards touch-start metadata to swipe tracking with safe-area ownership", () => {
    const mobileSidebarSwipeCoordinator = new TestMobileSidebarSwipeCoordinator();
    const runtimeViewportSizingCoordinator = new RuntimeViewportSizingCoordinator(120);
    vi.spyOn(runtimeViewportSizingCoordinator, "readSafeAreaInsetLeftPx").mockReturnValue(12);
    const setMobileSidebarOpen = vi.fn();

    render(
      <TouchHandlersHarness
        mobileSidebarOpen={false}
        setMobileSidebarOpen={setMobileSidebarOpen}
        mobileSidebarSwipeCoordinator={mobileSidebarSwipeCoordinator}
        runtimeViewportSizingCoordinator={runtimeViewportSizingCoordinator}
      />,
    );

    fireEvent.touchStart(screen.getByTestId("touch-shell"), {
      touches: [
        {
          clientX: 16,
          clientY: 20,
        },
      ],
    });

    expect(mobileSidebarSwipeCoordinator.beginTrackingCalls).toEqual([
      {
        mobileSidebarOpen: false,
        viewportWidthPx: 390,
        touchCount: 1,
        touchClientX: 16,
        touchClientY: 20,
        safeAreaInsetLeftPx: 12,
      },
    ]);
  });

  it("ends swipe tracking when touch-move events have no primary touch", () => {
    const mobileSidebarSwipeCoordinator = new TestMobileSidebarSwipeCoordinator();
    const runtimeViewportSizingCoordinator = new RuntimeViewportSizingCoordinator(120);
    const setMobileSidebarOpen = vi.fn();

    render(
      <TouchHandlersHarness
        mobileSidebarOpen={false}
        setMobileSidebarOpen={setMobileSidebarOpen}
        mobileSidebarSwipeCoordinator={mobileSidebarSwipeCoordinator}
        runtimeViewportSizingCoordinator={runtimeViewportSizingCoordinator}
      />,
    );

    fireEvent.touchMove(screen.getByTestId("touch-shell"), {
      touches: [],
    });

    expect(mobileSidebarSwipeCoordinator.endTrackingCallCount).toBe(1);
    expect(mobileSidebarSwipeCoordinator.continueTrackingCalls).toEqual([]);
    expect(setMobileSidebarOpen).not.toHaveBeenCalled();
  });

  it("opens the sidebar when swipe tracking reports a completed open gesture", () => {
    const mobileSidebarSwipeCoordinator = new TestMobileSidebarSwipeCoordinator();
    mobileSidebarSwipeCoordinator.setNextContinueTrackingOutput({
      shouldOpenSidebar: true,
    });
    const runtimeViewportSizingCoordinator = new RuntimeViewportSizingCoordinator(120);
    const setMobileSidebarOpen = vi.fn();

    render(
      <TouchHandlersHarness
        mobileSidebarOpen={false}
        setMobileSidebarOpen={setMobileSidebarOpen}
        mobileSidebarSwipeCoordinator={mobileSidebarSwipeCoordinator}
        runtimeViewportSizingCoordinator={runtimeViewportSizingCoordinator}
      />,
    );

    fireEvent.touchMove(screen.getByTestId("touch-shell"), {
      touches: [
        {
          clientX: 88,
          clientY: 24,
        },
      ],
    });

    expect(mobileSidebarSwipeCoordinator.continueTrackingCalls).toEqual([
      {
        touchCount: 1,
        touchClientX: 88,
        touchClientY: 24,
      },
    ]);
    expect(setMobileSidebarOpen).toHaveBeenCalledTimes(1);
    expect(setMobileSidebarOpen).toHaveBeenCalledWith(true);
  });
});
