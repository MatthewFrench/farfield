const COARSE_POINTER_MEDIA_QUERY = "(pointer: coarse)";
const SCROLLABLE_OVERFLOW_VALUES = new Set(["auto", "scroll", "overlay"]);
// Treat sub-pixel layout differences as being at the edge to avoid accidental overscroll.
const SCROLL_EDGE_EPSILON_PX = 1;

export class PageTouchOverscrollGuardCoordinator {
  private touchStartX: number;
  private touchStartY: number;
  private scrollElement: HTMLElement | null;

  public constructor() {
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.scrollElement = null;
  }

  public install(applicationShellElement: HTMLElement): () => void {
    if (!window.matchMedia(COARSE_POINTER_MEDIA_QUERY).matches) {
      return () => {};
    }

    const onTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.scrollElement = this.findScrollableAncestor(event.target, applicationShellElement);
    };

    const onTouchMove = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        return;
      }

      if (!this.scrollElement) {
        event.preventDefault();
        return;
      }

      const atTop = this.scrollElement.scrollTop <= 0;
      const atBottom = (
        this.scrollElement.scrollTop + this.scrollElement.clientHeight
        >= this.scrollElement.scrollHeight - SCROLL_EDGE_EPSILON_PX
      );
      const movingDown = deltaY > 0;
      const movingUp = deltaY < 0;

      if ((atTop && movingDown) || (atBottom && movingUp)) {
        event.preventDefault();
      }
    };

    const clearTouchState = (): void => {
      this.scrollElement = null;
    };

    applicationShellElement.addEventListener("touchstart", onTouchStart, { passive: true });
    applicationShellElement.addEventListener("touchmove", onTouchMove, { passive: false });
    applicationShellElement.addEventListener("touchend", clearTouchState, { passive: true });
    applicationShellElement.addEventListener("touchcancel", clearTouchState, { passive: true });

    return () => {
      applicationShellElement.removeEventListener("touchstart", onTouchStart);
      applicationShellElement.removeEventListener("touchmove", onTouchMove);
      applicationShellElement.removeEventListener("touchend", clearTouchState);
      applicationShellElement.removeEventListener("touchcancel", clearTouchState);
      this.scrollElement = null;
    };
  }

  private findScrollableAncestor(
    target: EventTarget | null,
    applicationShellElement: HTMLElement
  ): HTMLElement | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    let node: HTMLElement | null = target;
    while (node && node !== applicationShellElement) {
      if (this.canElementScrollVertically(node)) {
        return node;
      }
      node = node.parentElement;
    }

    return this.canElementScrollVertically(applicationShellElement) ? applicationShellElement : null;
  }

  private canElementScrollVertically(element: HTMLElement): boolean {
    const overflowY = window.getComputedStyle(element).overflowY;
    if (!SCROLLABLE_OVERFLOW_VALUES.has(overflowY)) {
      return false;
    }

    return element.scrollHeight > element.clientHeight + SCROLL_EDGE_EPSILON_PX;
  }
}
