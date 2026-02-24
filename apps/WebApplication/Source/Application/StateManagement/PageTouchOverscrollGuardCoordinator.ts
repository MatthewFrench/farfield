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
    if (!window.matchMedia("(pointer: coarse)").matches) {
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
        >= this.scrollElement.scrollHeight - 1
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
    if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") {
      return false;
    }

    return element.scrollHeight > element.clientHeight + 1;
  }
}
