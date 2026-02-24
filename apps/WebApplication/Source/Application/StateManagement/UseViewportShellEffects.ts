import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction
} from "react";
import { reportClientError } from "@/SharedUtilities/ClientErrors";
import { ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { PageTouchOverscrollGuardCoordinator } from "./PageTouchOverscrollGuardCoordinator";
import { RuntimeViewportSizingCoordinator } from "./RuntimeViewportSizingCoordinator";

export interface UseViewportShellEffectsInput {
  applicationShellElementRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  selectedThreadIdRef: MutableRefObject<string | null>;
  isChatAtBottomRef: MutableRefObject<boolean>;
  viewportKeyboardStateRef: MutableRefObject<boolean | null>;
  viewportTelemetryLastReportedAtRef: MutableRefObject<number>;
  keyboardOpenScrollRafRef: MutableRefObject<number | null>;
  setIsChatAtBottom: Dispatch<SetStateAction<boolean>>;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
  pageTouchOverscrollGuardCoordinator: PageTouchOverscrollGuardCoordinator;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
}

export function useViewportShellEffects(input: UseViewportShellEffectsInput): void {
  useEffect(() => {
    let rafId: number | null = null;

    const applyRuntimeViewportSizing = () => {
      const metrics = input.runtimeViewportSizingCoordinator.applyViewportSizingVariables();
      const rootClientHeight = input.applicationShellElementRef.current?.clientHeight ?? null;

      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }

      const previousKeyboardState = input.viewportKeyboardStateRef.current;
      input.viewportKeyboardStateRef.current = metrics.keyboardOpen;

      if (
        metrics.keyboardOpen
        && previousKeyboardState !== true
        && window.matchMedia("(pointer: coarse)").matches
        && input.activeTabRef.current === "chat"
      ) {
        if (input.keyboardOpenScrollRafRef.current !== null) {
          window.cancelAnimationFrame(input.keyboardOpenScrollRafRef.current);
        }

        input.keyboardOpenScrollRafRef.current = window.requestAnimationFrame(() => {
          input.keyboardOpenScrollRafRef.current = window.requestAnimationFrame(() => {
            const scroller = input.scrollRef.current;
            if (!scroller) {
              input.keyboardOpenScrollRafRef.current = null;
              return;
            }
            input.chatScrollStateCoordinator.pinToBottom(scroller);
            input.isChatAtBottomRef.current = true;
            input.setIsChatAtBottom(true);
            input.keyboardOpenScrollRafRef.current = null;
          });
        });
      }

      if (previousKeyboardState === metrics.keyboardOpen) {
        return;
      }

      const now = Date.now();
      if (now - input.viewportTelemetryLastReportedAtRef.current < 250) {
        return;
      }
      input.viewportTelemetryLastReportedAtRef.current = now;

      void reportClientError({
        source: "farfield-web",
        operation: "viewport-keyboard-transition",
        message: metrics.keyboardOpen ? "viewport keyboard opened" : "viewport keyboard closed",
        name: null,
        stack: null,
        requestId: null,
        threadId: input.selectedThreadIdRef.current,
        url: window.location.pathname + window.location.search,
        details: {
          eventType: "viewport-keyboard-transition",
          keyboardOpen: metrics.keyboardOpen,
          orientation: metrics.orientation,
          appHeightPx: metrics.appHeight,
          visualViewportHeightPx: Math.round(metrics.visualViewportHeight),
          layoutViewportHeightPx: Math.round(metrics.layoutViewportHeight),
          keyboardDeltaPx: Math.round(metrics.keyboardDelta),
          safeAreaInsetBottomPx: Math.round(metrics.safeAreaInsetBottom),
          documentClientHeightPx: document.documentElement.clientHeight,
          bodyClientHeightPx: document.body.clientHeight,
          rootClientHeightPx: rootClientHeight,
          pageYOffsetPx: window.pageYOffset,
          scrollYPx: window.scrollY
        },
        occurredAt: new Date(now).toISOString()
      }).catch(() => {});
    };

    const scheduleApply = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        applyRuntimeViewportSizing();
        rafId = null;
      });
    };

    scheduleApply();

    const visualViewport = window.visualViewport;
    window.addEventListener("resize", scheduleApply);
    window.addEventListener("orientationchange", scheduleApply);
    window.addEventListener("pageshow", scheduleApply);
    document.addEventListener("focusin", scheduleApply);
    document.addEventListener("focusout", scheduleApply);
    visualViewport?.addEventListener("resize", scheduleApply);
    visualViewport?.addEventListener("scroll", scheduleApply);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (input.keyboardOpenScrollRafRef.current !== null) {
        window.cancelAnimationFrame(input.keyboardOpenScrollRafRef.current);
      }
      window.removeEventListener("resize", scheduleApply);
      window.removeEventListener("orientationchange", scheduleApply);
      window.removeEventListener("pageshow", scheduleApply);
      document.removeEventListener("focusin", scheduleApply);
      document.removeEventListener("focusout", scheduleApply);
      visualViewport?.removeEventListener("resize", scheduleApply);
      visualViewport?.removeEventListener("scroll", scheduleApply);
      input.runtimeViewportSizingCoordinator.clearViewportSizingVariables();
    };
  }, [
    input.activeTabRef,
    input.applicationShellElementRef,
    input.chatScrollStateCoordinator,
    input.isChatAtBottomRef,
    input.keyboardOpenScrollRafRef,
    input.runtimeViewportSizingCoordinator,
    input.scrollRef,
    input.selectedThreadIdRef,
    input.setIsChatAtBottom,
    input.viewportKeyboardStateRef,
    input.viewportTelemetryLastReportedAtRef
  ]);

  useEffect(() => {
    const applicationShellElement = input.applicationShellElementRef.current;
    if (!applicationShellElement) {
      return;
    }
    return input.pageTouchOverscrollGuardCoordinator.install(applicationShellElement);
  }, [input.applicationShellElementRef, input.pageTouchOverscrollGuardCoordinator]);
}
