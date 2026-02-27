import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageTouchOverscrollGuardCoordinator } from "../Source/Application/StateManagement/PageTouchOverscrollGuardCoordinator";
import {
  type RuntimeViewportMetrics,
  RuntimeViewportSizingCoordinator,
} from "../Source/Application/StateManagement/RuntimeViewportSizingCoordinator";
import {
  type UseViewportShellEffectsInput,
  useViewportShellEffects,
} from "../Source/Application/StateManagement/UseViewportShellEffects";
import {
  type ChatScrollElementLike,
  ChatScrollStateCoordinator,
} from "../Source/Features/Chat/StateManagement/ChatScrollStateCoordinator";

interface HarnessProperties {
  input: UseViewportShellEffectsInput;
}

class TestRuntimeViewportSizingCoordinator extends RuntimeViewportSizingCoordinator {
  public clearViewportSizingVariablesCallCount = 0;
  private metrics: RuntimeViewportMetrics;

  public constructor(metrics: RuntimeViewportMetrics) {
    super(120);
    this.metrics = metrics;
  }

  public override applyViewportSizingVariables(): RuntimeViewportMetrics {
    return this.metrics;
  }

  public override clearViewportSizingVariables(): void {
    this.clearViewportSizingVariablesCallCount += 1;
  }
}

class TestPageTouchOverscrollGuardCoordinator extends PageTouchOverscrollGuardCoordinator {
  public installCallElements: HTMLElement[] = [];
  public cleanupCallCount = 0;

  public override install(applicationShellElement: HTMLElement): () => void {
    this.installCallElements.push(applicationShellElement);
    return () => {
      this.cleanupCallCount += 1;
    };
  }
}

class TestChatScrollStateCoordinator extends ChatScrollStateCoordinator {
  public pinToBottomCallCount = 0;
  public lastPinnedElement: ChatScrollElementLike | null = null;

  public constructor() {
    super(2);
  }

  public override pinToBottom(scrollElement: ChatScrollElementLike): void {
    this.pinToBottomCallCount += 1;
    this.lastPinnedElement = scrollElement;
  }
}

function Harness(properties: HarnessProperties): React.JSX.Element {
  useViewportShellEffects(properties.input);
  return <div data-testid="viewport-shell-effects-harness" />;
}

function createRuntimeViewportMetrics(keyboardOpen: boolean): RuntimeViewportMetrics {
  return {
    orientation: "portrait",
    appHeight: 800,
    visualViewportHeight: 800,
    layoutViewportHeight: 800,
    keyboardDelta: keyboardOpen ? 160 : 0,
    keyboardOpen,
    safeAreaInsetBottom: 0,
  };
}

function createMediaQueryList(matches: boolean, media: string): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
}

const originalMatchMedia = window.matchMedia;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
const originalScrollTo = window.scrollTo;
let queuedAnimationFrames: Map<number, FrameRequestCallback>;

function flushQueuedAnimationFrames(): void {
  const queuedEntries = Array.from(queuedAnimationFrames.entries());
  queuedAnimationFrames.clear();

  for (const [, callback] of queuedEntries) {
    callback(performance.now());
  }
}

describe("useViewportShellEffects", () => {
  beforeEach(() => {
    queuedAnimationFrames = new Map<number, FrameRequestCallback>();
    let animationFrameIdentifier = 0;
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: (callback: FrameRequestCallback): number => {
        animationFrameIdentifier += 1;
        queuedAnimationFrames.set(animationFrameIdentifier, callback);
        return animationFrameIdentifier;
      },
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: (identifier: number): void => {
        queuedAnimationFrames.delete(identifier);
      },
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => {
        if (query === "(pointer: coarse)") {
          return createMediaQueryList(true, query);
        }
        return createMediaQueryList(false, query);
      },
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalCancelAnimationFrame,
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      writable: true,
      value: originalScrollTo,
    });
  });

  it("installs the overscroll guard owner and clears viewport variables on cleanup", () => {
    const runtimeViewportSizingCoordinator = new TestRuntimeViewportSizingCoordinator(
      createRuntimeViewportMetrics(false),
    );
    const pageTouchOverscrollGuardCoordinator = new TestPageTouchOverscrollGuardCoordinator();
    const chatScrollStateCoordinator = new TestChatScrollStateCoordinator();

    const applicationShellElement = document.createElement("div");
    const scrollElement = document.createElement("div");

    const input: UseViewportShellEffectsInput = {
      applicationShellElementRef: { current: applicationShellElement },
      scrollRef: { current: scrollElement },
      activeTabRef: { current: "chat" },
      isChatAtBottomRef: { current: false },
      viewportKeyboardStateRef: { current: null },
      keyboardOpenScrollRafRef: { current: null },
      setIsChatAtBottom: vi.fn(),
      runtimeViewportSizingCoordinator,
      pageTouchOverscrollGuardCoordinator,
      chatScrollStateCoordinator,
    };

    const { unmount } = render(<Harness input={input} />);
    flushQueuedAnimationFrames();

    expect(pageTouchOverscrollGuardCoordinator.installCallElements).toEqual([
      applicationShellElement,
    ]);
    unmount();

    expect(pageTouchOverscrollGuardCoordinator.cleanupCallCount).toBe(1);
    expect(runtimeViewportSizingCoordinator.clearViewportSizingVariablesCallCount).toBe(1);
  });

  it("pins chat to bottom when keyboard opens on coarse pointers in chat tab", () => {
    const runtimeViewportSizingCoordinator = new TestRuntimeViewportSizingCoordinator(
      createRuntimeViewportMetrics(true),
    );
    const pageTouchOverscrollGuardCoordinator = new TestPageTouchOverscrollGuardCoordinator();
    const chatScrollStateCoordinator = new TestChatScrollStateCoordinator();

    const applicationShellElement = document.createElement("div");
    const scrollElement = document.createElement("div");
    Object.defineProperty(scrollElement, "scrollHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(scrollElement, "clientHeight", {
      configurable: true,
      value: 160,
    });
    Object.defineProperty(scrollElement, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });

    const setIsChatAtBottom = vi.fn();
    const isChatAtBottomRef = { current: false };
    const keyboardOpenScrollRafRef = { current: null };

    const input: UseViewportShellEffectsInput = {
      applicationShellElementRef: { current: applicationShellElement },
      scrollRef: { current: scrollElement },
      activeTabRef: { current: "chat" },
      isChatAtBottomRef,
      viewportKeyboardStateRef: { current: false },
      keyboardOpenScrollRafRef,
      setIsChatAtBottom,
      runtimeViewportSizingCoordinator,
      pageTouchOverscrollGuardCoordinator,
      chatScrollStateCoordinator,
    };

    render(<Harness input={input} />);
    flushQueuedAnimationFrames();
    flushQueuedAnimationFrames();
    flushQueuedAnimationFrames();

    expect(chatScrollStateCoordinator.pinToBottomCallCount).toBe(1);
    expect(chatScrollStateCoordinator.lastPinnedElement).toBe(scrollElement);
    expect(isChatAtBottomRef.current).toBe(true);
    expect(setIsChatAtBottom).toHaveBeenCalledWith(true);
    expect(keyboardOpenScrollRafRef.current).toBeNull();
  });
});
