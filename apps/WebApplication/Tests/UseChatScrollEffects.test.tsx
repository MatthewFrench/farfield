import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatScrollStateCoordinator } from "@/Features/Chat/StateManagement/ChatScrollStateCoordinator";
import { useChatScrollEffects } from "@/Features/Chat/StateManagement/UseChatScrollEffects";

interface ScrollEffectsHarnessSnapshot {
  isChatAtBottom: boolean;
  visibleChatItemLimit: number;
  scrollElement: HTMLDivElement | null;
}

interface ScrollEffectsHarnessProperties {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
  conversationItemCount: number;
  initialVisibleChatItemCount: number;
  initialIsChatAtBottom: boolean;
  forcedVisibleChatItemLimit: number | null;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
  onSnapshot: (snapshot: ScrollEffectsHarnessSnapshot) => void;
}

function ScrollEffectsHarness(properties: ScrollEffectsHarnessProperties): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chatContentRef = useRef<HTMLDivElement | null>(null);
  const [isChatAtBottom, setIsChatAtBottom] = useState<boolean>(properties.initialIsChatAtBottom);
  const isChatAtBottomRef = useRef<boolean>(properties.initialIsChatAtBottom);
  const [visibleChatItemLimit, setVisibleChatItemLimit] = useState<number>(
    properties.initialVisibleChatItemCount + 7,
  );

  useChatScrollEffects({
    activeTab: properties.activeTab,
    selectedThreadId: properties.selectedThreadId,
    conversationItemCount: properties.conversationItemCount,
    initialVisibleChatItemCount: properties.initialVisibleChatItemCount,
    scrollRef,
    chatContentRef,
    isChatAtBottom,
    isChatAtBottomRef,
    setIsChatAtBottom,
    setVisibleChatItemLimit,
    chatScrollStateCoordinator: properties.chatScrollStateCoordinator,
  });

  useEffect(() => {
    if (properties.forcedVisibleChatItemLimit !== null) {
      setVisibleChatItemLimit(properties.forcedVisibleChatItemLimit);
    }
  }, [properties.forcedVisibleChatItemLimit]);

  useEffect(() => {
    properties.onSnapshot({
      isChatAtBottom,
      visibleChatItemLimit,
      scrollElement: scrollRef.current,
    });
  }, [isChatAtBottom, properties, visibleChatItemLimit]);

  return (
    <div data-testid="chat-scroll-shell" ref={scrollRef}>
      <div data-testid="chat-scroll-content" ref={chatContentRef} />
    </div>
  );
}

function setScrollMetrics(
  scrollElement: HTMLDivElement,
  input: {
    scrollHeight: number;
    scrollTop: number;
    clientHeight: number;
  },
): void {
  Object.defineProperty(scrollElement, "scrollHeight", {
    configurable: true,
    writable: true,
    value: input.scrollHeight,
  });
  Object.defineProperty(scrollElement, "scrollTop", {
    configurable: true,
    writable: true,
    value: input.scrollTop,
  });
  Object.defineProperty(scrollElement, "clientHeight", {
    configurable: true,
    writable: true,
    value: input.clientHeight,
  });
}

function readScrollSnapshot(snapshotReference: {
  current: ScrollEffectsHarnessSnapshot | null;
}): ScrollEffectsHarnessSnapshot {
  const snapshot = snapshotReference.current;
  if (!snapshot) {
    throw new Error("Expected a chat scroll snapshot");
  }
  return snapshot;
}

describe("useChatScrollEffects", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        public observe(): void {}
        public disconnect(): void {}
        public unobserve(): void {}
      },
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("synchronizes bottom state from scroll events", async () => {
    const snapshotReference: { current: ScrollEffectsHarnessSnapshot | null } = {
      current: null,
    };
    const coordinator = new ChatScrollStateCoordinator(20);

    render(
      <ScrollEffectsHarness
        activeTab="chat"
        selectedThreadId="thread-1"
        conversationItemCount={1}
        initialVisibleChatItemCount={40}
        initialIsChatAtBottom={true}
        forcedVisibleChatItemLimit={null}
        chatScrollStateCoordinator={coordinator}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    const scrollElement = screen.getByTestId("chat-scroll-shell");
    if (!(scrollElement instanceof HTMLDivElement)) {
      throw new Error("Expected chat scroll shell to be rendered");
    }
    setScrollMetrics(scrollElement, {
      scrollHeight: 600,
      scrollTop: 200,
      clientHeight: 100,
    });

    fireEvent.scroll(scrollElement);

    await waitFor(() => {
      expect(snapshotReference.current?.isChatAtBottom).toBe(false);
    });
  });

  it("pins the chat viewport when new items appear while already at the bottom", async () => {
    const snapshotReference: { current: ScrollEffectsHarnessSnapshot | null } = {
      current: null,
    };
    const coordinator = new ChatScrollStateCoordinator(20);
    const pinToBottomSpy = vi.spyOn(coordinator, "pinToBottom");

    const { rerender } = render(
      <ScrollEffectsHarness
        activeTab="chat"
        selectedThreadId="thread-1"
        conversationItemCount={1}
        initialVisibleChatItemCount={40}
        initialIsChatAtBottom={true}
        forcedVisibleChatItemLimit={null}
        chatScrollStateCoordinator={coordinator}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(snapshotReference.current).not.toBeNull();
    });
    pinToBottomSpy.mockClear();

    rerender(
      <ScrollEffectsHarness
        activeTab="chat"
        selectedThreadId="thread-1"
        conversationItemCount={2}
        initialVisibleChatItemCount={40}
        initialIsChatAtBottom={true}
        forcedVisibleChatItemLimit={null}
        chatScrollStateCoordinator={coordinator}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(pinToBottomSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("resets bottom state and visible-limit state when thread selection changes", async () => {
    const snapshotReference: { current: ScrollEffectsHarnessSnapshot | null } = {
      current: null,
    };
    const coordinator = new ChatScrollStateCoordinator(20);
    const pinToBottomSpy = vi.spyOn(coordinator, "pinToBottom");

    const { rerender } = render(
      <ScrollEffectsHarness
        activeTab="chat"
        selectedThreadId="thread-1"
        conversationItemCount={1}
        initialVisibleChatItemCount={40}
        initialIsChatAtBottom={true}
        forcedVisibleChatItemLimit={null}
        chatScrollStateCoordinator={coordinator}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    rerender(
      <ScrollEffectsHarness
        activeTab="chat"
        selectedThreadId="thread-1"
        conversationItemCount={1}
        initialVisibleChatItemCount={40}
        initialIsChatAtBottom={true}
        forcedVisibleChatItemLimit={91}
        chatScrollStateCoordinator={coordinator}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(snapshotReference.current?.visibleChatItemLimit).toBe(91);
    });

    const scrollElement = readScrollSnapshot(snapshotReference).scrollElement;
    if (!scrollElement) {
      throw new Error("Expected chat scroll element to exist");
    }
    setScrollMetrics(scrollElement, {
      scrollHeight: 600,
      scrollTop: 120,
      clientHeight: 100,
    });

    fireEvent.scroll(scrollElement);
    await waitFor(() => {
      expect(snapshotReference.current?.isChatAtBottom).toBe(false);
    });

    const pinToBottomCallCountBeforeThreadChange = pinToBottomSpy.mock.calls.length;
    rerender(
      <ScrollEffectsHarness
        activeTab="chat"
        selectedThreadId="thread-2"
        conversationItemCount={1}
        initialVisibleChatItemCount={40}
        initialIsChatAtBottom={true}
        forcedVisibleChatItemLimit={null}
        chatScrollStateCoordinator={coordinator}
        onSnapshot={(snapshot) => {
          snapshotReference.current = snapshot;
        }}
      />,
    );

    await waitFor(() => {
      expect(snapshotReference.current?.visibleChatItemLimit).toBe(40);
      expect(snapshotReference.current?.isChatAtBottom).toBe(true);
    });
    expect(pinToBottomSpy.mock.calls.length).toBeGreaterThan(
      pinToBottomCallCountBeforeThreadChange,
    );
  });
});
