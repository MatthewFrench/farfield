/**
 * Owns deterministic tracking for edge-originated sidebar-open swipes on mobile layouts.
 * Tracking is single-touch only and transitions through explicit states so gesture races
 * (multi-touch changes, opposite-direction movement, re-entry starts) resolve predictably.
 */
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
  reason?: MobileSidebarSwipeTrackingDecisionReason;
}

export type MobileSidebarSwipeTrackingStatus = "not-tracking" | "tracking";

export type MobileSidebarSwipeTrackingDecisionReason =
  | "not-tracking"
  | "touch-count-mismatch"
  | "vertical-drift-cancelled"
  | "negative-horizontal-cancelled"
  | "trigger-reached"
  | "tracking-in-progress";

interface MobileSidebarSwipeTrackingState {
  trackingStatus: MobileSidebarSwipeTrackingStatus;
  startX: number;
  startY: number;
}

const MOBILE_SIDEBAR_SWIPE_SINGLE_TOUCH_COUNT = 1;
const MOBILE_SIDEBAR_SWIPE_TRACKING_STATUS_NOT_TRACKING: MobileSidebarSwipeTrackingStatus = "not-tracking";
const MOBILE_SIDEBAR_SWIPE_TRACKING_STATUS_TRACKING: MobileSidebarSwipeTrackingStatus = "tracking";
const MOBILE_SIDEBAR_SWIPE_COORDINATE_RESET_PX = 0;

const MOBILE_SIDEBAR_SWIPE_OUTPUT_NOT_TRACKING: ContinueMobileSidebarSwipeTrackingOutput = {
  shouldOpenSidebar: false,
  reason: "not-tracking"
};
const MOBILE_SIDEBAR_SWIPE_OUTPUT_TOUCH_COUNT_MISMATCH: ContinueMobileSidebarSwipeTrackingOutput = {
  shouldOpenSidebar: false,
  reason: "touch-count-mismatch"
};
const MOBILE_SIDEBAR_SWIPE_OUTPUT_VERTICAL_DRIFT_CANCELLED: ContinueMobileSidebarSwipeTrackingOutput = {
  shouldOpenSidebar: false,
  reason: "vertical-drift-cancelled"
};
const MOBILE_SIDEBAR_SWIPE_OUTPUT_NEGATIVE_HORIZONTAL_CANCELLED:
  ContinueMobileSidebarSwipeTrackingOutput = {
    shouldOpenSidebar: false,
    reason: "negative-horizontal-cancelled"
  };
const MOBILE_SIDEBAR_SWIPE_OUTPUT_TRIGGER_REACHED: ContinueMobileSidebarSwipeTrackingOutput = {
  shouldOpenSidebar: true,
  reason: "trigger-reached"
};
const MOBILE_SIDEBAR_SWIPE_OUTPUT_TRACKING_IN_PROGRESS: ContinueMobileSidebarSwipeTrackingOutput = {
  shouldOpenSidebar: false,
  reason: "tracking-in-progress"
};

export class MobileSidebarSwipeCoordinator {
  private readonly configuration: MobileSidebarSwipeCoordinatorConfiguration;
  private readonly trackingState: MobileSidebarSwipeTrackingState;

  public constructor(configuration: MobileSidebarSwipeCoordinatorConfiguration) {
    this.configuration = configuration;
    this.trackingState = {
      trackingStatus: MOBILE_SIDEBAR_SWIPE_TRACKING_STATUS_NOT_TRACKING,
      startX: MOBILE_SIDEBAR_SWIPE_COORDINATE_RESET_PX,
      startY: MOBILE_SIDEBAR_SWIPE_COORDINATE_RESET_PX
    };
  }

  public beginTracking(input: BeginMobileSidebarSwipeTrackingInput): void {
    this.endTracking();

    if (!this.canBeginTracking(input)) {
      return;
    }

    const edgeThresholdPx = input.safeAreaInsetLeftPx + this.configuration.sidebarSwipeEdgePx;
    if (input.touchClientX > edgeThresholdPx) {
      return;
    }

    this.trackingState.trackingStatus = MOBILE_SIDEBAR_SWIPE_TRACKING_STATUS_TRACKING;
    this.trackingState.startX = input.touchClientX;
    this.trackingState.startY = input.touchClientY;
  }

  public continueTracking(
    input: ContinueMobileSidebarSwipeTrackingInput
  ): ContinueMobileSidebarSwipeTrackingOutput {
    if (
      this.trackingState.trackingStatus
      !== MOBILE_SIDEBAR_SWIPE_TRACKING_STATUS_TRACKING
    ) {
      return MOBILE_SIDEBAR_SWIPE_OUTPUT_NOT_TRACKING;
    }
    if (input.touchCount !== MOBILE_SIDEBAR_SWIPE_SINGLE_TOUCH_COUNT) {
      this.endTracking();
      return MOBILE_SIDEBAR_SWIPE_OUTPUT_TOUCH_COUNT_MISMATCH;
    }

    const deltaX = input.touchClientX - this.trackingState.startX;
    const deltaY = input.touchClientY - this.trackingState.startY;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);

    if (this.shouldCancelForVerticalDrift(absoluteDeltaX, absoluteDeltaY)) {
      this.endTracking();
      return MOBILE_SIDEBAR_SWIPE_OUTPUT_VERTICAL_DRIFT_CANCELLED;
    }
    if (this.shouldCancelForNegativeHorizontalDelta(deltaX)) {
      this.endTracking();
      return MOBILE_SIDEBAR_SWIPE_OUTPUT_NEGATIVE_HORIZONTAL_CANCELLED;
    }
    if (this.shouldOpenSidebar(deltaX, absoluteDeltaY)) {
      this.endTracking();
      return MOBILE_SIDEBAR_SWIPE_OUTPUT_TRIGGER_REACHED;
    }

    return MOBILE_SIDEBAR_SWIPE_OUTPUT_TRACKING_IN_PROGRESS;
  }

  public endTracking(): void {
    this.trackingState.trackingStatus = MOBILE_SIDEBAR_SWIPE_TRACKING_STATUS_NOT_TRACKING;
    this.trackingState.startX = MOBILE_SIDEBAR_SWIPE_COORDINATE_RESET_PX;
    this.trackingState.startY = MOBILE_SIDEBAR_SWIPE_COORDINATE_RESET_PX;
  }

  private canBeginTracking(input: BeginMobileSidebarSwipeTrackingInput): boolean {
    if (input.mobileSidebarOpen) {
      return false;
    }

    if (input.viewportWidthPx >= this.configuration.mobileLayoutMaximumWidthPx) {
      return false;
    }

    return input.touchCount === MOBILE_SIDEBAR_SWIPE_SINGLE_TOUCH_COUNT;
  }

  private shouldCancelForVerticalDrift(absoluteDeltaX: number, absoluteDeltaY: number): boolean {
    return (
      absoluteDeltaY > this.configuration.sidebarSwipeMaximumVerticalDriftPx
      && absoluteDeltaY > absoluteDeltaX
    );
  }

  private shouldCancelForNegativeHorizontalDelta(deltaX: number): boolean {
    return deltaX < this.configuration.sidebarSwipeCancelNegativePx;
  }

  private shouldOpenSidebar(deltaX: number, absoluteDeltaY: number): boolean {
    return (
      deltaX >= this.configuration.sidebarSwipeTriggerPx
      && absoluteDeltaY <= this.configuration.sidebarSwipeMaximumVerticalDriftPx
    );
  }
}
