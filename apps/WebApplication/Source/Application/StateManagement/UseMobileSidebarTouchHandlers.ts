import {
  useCallback,
  type Dispatch,
  type SetStateAction,
  type TouchEvent as ReactTouchEvent
} from "react";
import { MobileSidebarSwipeCoordinator } from "./MobileSidebarSwipeCoordinator";
import { RuntimeViewportSizingCoordinator } from "./RuntimeViewportSizingCoordinator";

export interface MobileSidebarTouchHandlers {
  endSidebarSwipeTracking: () => void;
  handleAppShellTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
  handleAppShellTouchMove: (event: ReactTouchEvent<HTMLDivElement>) => void;
}

export interface UseMobileSidebarTouchHandlersInput {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  mobileSidebarSwipeCoordinator: MobileSidebarSwipeCoordinator;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
}

export function useMobileSidebarTouchHandlers(
  input: UseMobileSidebarTouchHandlersInput
): MobileSidebarTouchHandlers {
  const endSidebarSwipeTracking = useCallback(() => {
    input.mobileSidebarSwipeCoordinator.endTracking();
  }, [input.mobileSidebarSwipeCoordinator]);

  const handleAppShellTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      input.mobileSidebarSwipeCoordinator.endTracking();
      return;
    }
    input.mobileSidebarSwipeCoordinator.beginTracking({
      mobileSidebarOpen: input.mobileSidebarOpen,
      viewportWidthPx: window.innerWidth,
      touchCount: event.touches.length,
      touchClientX: touch.clientX,
      touchClientY: touch.clientY,
      safeAreaInsetLeftPx: input.runtimeViewportSizingCoordinator.readSafeAreaInsetLeftPx()
    });
  }, [input.mobileSidebarOpen, input.mobileSidebarSwipeCoordinator, input.runtimeViewportSizingCoordinator]);

  const handleAppShellTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      input.mobileSidebarSwipeCoordinator.endTracking();
      return;
    }

    const swipeOutput = input.mobileSidebarSwipeCoordinator.continueTracking({
      touchCount: event.touches.length,
      touchClientX: touch.clientX,
      touchClientY: touch.clientY
    });
    if (swipeOutput.shouldOpenSidebar) {
      input.setMobileSidebarOpen(true);
    }
  }, [input.mobileSidebarSwipeCoordinator, input.setMobileSidebarOpen]);

  return {
    endSidebarSwipeTracking,
    handleAppShellTouchStart,
    handleAppShellTouchMove
  };
}
