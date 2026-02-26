import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction
} from "react";
import { ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { PageTouchOverscrollGuardCoordinator } from "./PageTouchOverscrollGuardCoordinator";
import { RuntimeViewportSizingCoordinator } from "./RuntimeViewportSizingCoordinator";

const POINTER_COARSE_MEDIA_QUERY = "(pointer: coarse)";

export interface UseViewportShellEffectsInput {
  applicationShellElementRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  activeTabRef: MutableRefObject<"chat" | "debug">;
  isChatAtBottomRef: MutableRefObject<boolean>;
  viewportKeyboardStateRef: MutableRefObject<boolean | null>;
  keyboardOpenScrollRafRef: MutableRefObject<number | null>;
  setIsChatAtBottom: Dispatch<SetStateAction<boolean>>;
  runtimeViewportSizingCoordinator: RuntimeViewportSizingCoordinator;
  pageTouchOverscrollGuardCoordinator: PageTouchOverscrollGuardCoordinator;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
}

function cancelScheduledKeyboardOpenPin(
  keyboardOpenScrollRafReference: MutableRefObject<number | null>
): void {
  const keyboardOpenScrollRafRef = keyboardOpenScrollRafReference;
  if (keyboardOpenScrollRafRef.current === null) {
    return;
  }
  window.cancelAnimationFrame(keyboardOpenScrollRafRef.current);
  keyboardOpenScrollRafRef.current = null;
}

function scheduleKeyboardOpenPin(
  keyboardOpenScrollRafReference: MutableRefObject<number | null>,
  callback: () => void
): void {
  const keyboardOpenScrollRafRef = keyboardOpenScrollRafReference;
  keyboardOpenScrollRafRef.current = window.requestAnimationFrame(() => {
    keyboardOpenScrollRafRef.current = window.requestAnimationFrame(() => {
      callback();
      keyboardOpenScrollRafRef.current = null;
    });
  });
}

export function useViewportShellEffects(input: UseViewportShellEffectsInput): void {
  useEffect(() => {
    let rafId: number | null = null;

    const applyRuntimeViewportSizing = () => {
      const metrics = input.runtimeViewportSizingCoordinator.applyViewportSizingVariables();

      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }

      const viewportKeyboardStateRef = input.viewportKeyboardStateRef;
      const previousKeyboardState = viewportKeyboardStateRef.current;
      viewportKeyboardStateRef.current = metrics.keyboardOpen;

      if (
        metrics.keyboardOpen
        && previousKeyboardState !== true
        && window.matchMedia(POINTER_COARSE_MEDIA_QUERY).matches
        && input.activeTabRef.current === "chat"
      ) {
        cancelScheduledKeyboardOpenPin(input.keyboardOpenScrollRafRef);
        scheduleKeyboardOpenPin(input.keyboardOpenScrollRafRef, () => {
          const scroller = input.scrollRef.current;
          if (!scroller) {
            return;
          }
          input.chatScrollStateCoordinator.pinToBottom(scroller);
          const isChatAtBottomRef = input.isChatAtBottomRef;
          isChatAtBottomRef.current = true;
          input.setIsChatAtBottom(true);
        });
      }

      if (previousKeyboardState === metrics.keyboardOpen) {
        return;
      }
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
      cancelScheduledKeyboardOpenPin(input.keyboardOpenScrollRafRef);
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
    input.chatScrollStateCoordinator,
    input.isChatAtBottomRef,
    input.keyboardOpenScrollRafRef,
    input.runtimeViewportSizingCoordinator,
    input.scrollRef,
    input.setIsChatAtBottom,
    input.viewportKeyboardStateRef
  ]);

  useEffect(() => {
    const applicationShellElement = input.applicationShellElementRef.current;
    if (!applicationShellElement) {
      return;
    }
    return input.pageTouchOverscrollGuardCoordinator.install(applicationShellElement);
  }, [input.applicationShellElementRef, input.pageTouchOverscrollGuardCoordinator]);
}
