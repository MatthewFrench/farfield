export interface MobileSidebarSwipeCoordinatorConfiguration {
  mobileLayoutMaximumWidthPx: number;
  sidebarSwipeEdgePx: number;
  sidebarSwipeTriggerPx: number;
  sidebarSwipeMaximumVerticalDriftPx: number;
  sidebarSwipeCancelNegativePx: number;
}

export interface BeginMobileSidebarSwipeTrackingInput {
  mobileSidebarOpen: boolean;
  viewportWidthPx: number;
  touchCount: number;
  touchClientX: number;
  touchClientY: number;
  safeAreaInsetLeftPx: number;
}

export interface ContinueMobileSidebarSwipeTrackingInput {
  touchCount: number;
  touchClientX: number;
  touchClientY: number;
}

export interface ContinueMobileSidebarSwipeTrackingOutput {
  shouldOpenSidebar: boolean;
}

interface MobileSidebarSwipeTrackingState {
  isTracking: boolean;
  startX: number;
  startY: number;
}

export class MobileSidebarSwipeCoordinator {
  private readonly configuration: MobileSidebarSwipeCoordinatorConfiguration;
  private readonly trackingState: MobileSidebarSwipeTrackingState;

  public constructor(configuration: MobileSidebarSwipeCoordinatorConfiguration) {
    this.configuration = configuration;
    this.trackingState = {
      isTracking: false,
      startX: 0,
      startY: 0
    };
  }

  public beginTracking(input: BeginMobileSidebarSwipeTrackingInput): void {
    this.endTracking();

    if (input.mobileSidebarOpen || input.viewportWidthPx >= this.configuration.mobileLayoutMaximumWidthPx) {
      return;
    }
    if (input.touchCount !== 1) {
      return;
    }

    const edgeThresholdPx = input.safeAreaInsetLeftPx + this.configuration.sidebarSwipeEdgePx;
    if (input.touchClientX > edgeThresholdPx) {
      return;
    }

    this.trackingState.isTracking = true;
    this.trackingState.startX = input.touchClientX;
    this.trackingState.startY = input.touchClientY;
  }

  public continueTracking(
    input: ContinueMobileSidebarSwipeTrackingInput
  ): ContinueMobileSidebarSwipeTrackingOutput {
    if (!this.trackingState.isTracking) {
      return { shouldOpenSidebar: false };
    }
    if (input.touchCount !== 1) {
      this.endTracking();
      return { shouldOpenSidebar: false };
    }

    const deltaX = input.touchClientX - this.trackingState.startX;
    const deltaY = input.touchClientY - this.trackingState.startY;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);

    if (
      absoluteDeltaY > this.configuration.sidebarSwipeMaximumVerticalDriftPx
      && absoluteDeltaY > absoluteDeltaX
    ) {
      this.endTracking();
      return { shouldOpenSidebar: false };
    }
    if (deltaX < this.configuration.sidebarSwipeCancelNegativePx) {
      this.endTracking();
      return { shouldOpenSidebar: false };
    }
    if (
      deltaX >= this.configuration.sidebarSwipeTriggerPx
      && absoluteDeltaY <= this.configuration.sidebarSwipeMaximumVerticalDriftPx
    ) {
      this.endTracking();
      return { shouldOpenSidebar: true };
    }

    return { shouldOpenSidebar: false };
  }

  public endTracking(): void {
    this.trackingState.isTracking = false;
  }
}
